import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import Task
from ..schemas import BulkImportRequest, BulkImportResponse, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def make_id() -> str:
    return f"task_{uuid.uuid4().hex[:12]}"


@router.get("", response_model=List[TaskOut])
async def get_tasks(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.user_id == user_id).order_by(Task.entry_timestamp)
    )
    return result.scalars().all()


@router.post("", response_model=TaskOut)
async def create_task(
    body: TaskCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task_id = body.id or make_id()
    now = datetime.utcnow()
    task = Task(
        id=task_id,
        user_id=user_id,
        num=body.num,
        title=body.title,
        bucket=body.bucket,
        weightage=body.weightage,
        time_horizon=body.time_horizon,
        life_area=body.life_area,
        ch=body.ch,
        multitask=body.multitask,
        origin_bucket=body.origin_bucket or body.bucket,
        state_history=body.state_history or [{"bucket": body.bucket, "timestamp": now.isoformat()}],
        completed=body.completed or False,
        completed_timestamp=body.completed_timestamp,
        entry_timestamp=body.entry_timestamp or now,
        aging_days=body.aging_days or 0,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(task, field, val)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Task).where(Task.id == task_id, Task.user_id == user_id))
    await db.commit()
    return {"ok": True}


@router.post("/import", response_model=BulkImportResponse)
async def bulk_import(
    body: BulkImportRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.user_id == user_id))
    existing = {t.id: t for t in result.scalars().all()}
    added = updated = completed_count = 0

    for raw in body.tasks:
        tid = raw.get("id") or make_id()
        if tid in existing:
            t = existing[tid]
            if raw.get("completed") and not t.completed:
                t.completed = True
                t.completed_timestamp = datetime.utcnow()
                completed_count += 1
            bk = raw.get("bucket")
            if bk and bk != t.bucket:
                if bk == "Immediate":
                    bk = "Karya"
                t.bucket = bk
                updated += 1
        else:
            bucket = raw.get("bucket", "Karya")
            if bucket == "Immediate":
                bucket = "Karya"
            ob = raw.get("origin_bucket") or raw.get("originBucket") or bucket
            if ob == "Immediate":
                ob = "Karya"
            sh = (
                raw.get("state_history")
                or raw.get("stateHistory")
                or [{"bucket": bucket, "timestamp": datetime.utcnow().isoformat()}]
            )
            # Normalise state_history entries
            for entry in sh:
                if isinstance(entry, dict) and entry.get("bucket") == "Immediate":
                    entry["bucket"] = "Karya"

            t = Task(
                id=tid,
                user_id=user_id,
                num=raw.get("num"),
                title=raw.get("title", ""),
                bucket=bucket,
                weightage=raw.get("weightage"),
                time_horizon=(
                    raw.get("time_horizon")
                    or raw.get("timeHorizon")
                    or raw.get("timeHorizonType")
                ),
                life_area=raw.get("life_area") or raw.get("lifeArea"),
                ch=raw.get("ch"),
                multitask=raw.get("multitask"),
                origin_bucket=ob,
                state_history=sh,
                transition_count=raw.get("transition_count") or raw.get("transitionCount") or 0,
                completed=raw.get("completed", False),
                completed_timestamp=(
                    raw.get("completed_timestamp")
                    or raw.get("completedTimestamp")
                    or raw.get("completionDate")
                ),
                entry_timestamp=(
                    raw.get("entry_timestamp")
                    or raw.get("entryTimestamp")
                    or datetime.utcnow()
                ),
                aging_days=raw.get("aging_days") or raw.get("agingDays") or 0,
            )
            db.add(t)
            added += 1

    await db.commit()
    return BulkImportResponse(added=added, updated=updated, completed_count=completed_count)


@router.delete("", response_model=dict)
async def clear_completed(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Task).where(Task.user_id == user_id, Task.completed == True))
    await db.commit()
    return {"ok": True}
