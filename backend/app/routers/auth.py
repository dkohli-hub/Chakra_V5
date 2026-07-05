from fastapi import APIRouter, HTTPException
from jose import jwt
from datetime import datetime, timedelta
from ..schemas import LoginRequest, LoginResponse
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def create_token(user_id: str, display_name: str) -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    return jwt.encode(
        {"sub": user_id, "name": display_name, "exp": expire},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    users = settings.get_user_accounts()
    match = next(
        (u for u in users if u["id"].lower() == req.user_id.lower() and u["password"] == req.password),
        None,
    )
    if not match:
        raise HTTPException(status_code=401, detail="Incorrect ID or password")
    token = create_token(match["id"], match["displayName"])
    return LoginResponse(access_token=token, user_id=match["id"], display_name=match["displayName"])
