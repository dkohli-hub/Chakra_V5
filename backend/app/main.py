from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import auth, llm, ocr, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Chakra V5 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(llm.router)
app.include_router(ocr.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/accounts")
async def debug_accounts():
    from .config import settings
    try:
        accounts = settings.get_user_accounts()
        return {"count": len(accounts), "ids": [u["id"] for u in accounts]}
    except Exception as e:
        return {"error": str(e), "raw": settings.USER_ACCOUNTS[:100]}
