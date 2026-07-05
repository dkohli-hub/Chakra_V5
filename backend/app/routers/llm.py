import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from ..config import settings
from ..schemas import LLMRequest, LLMResponse

router = APIRouter(prefix="/llm", tags=["llm"])
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/parse", response_model=LLMResponse)
async def parse_tasks(
    body: LLMRequest,
    user_id: str = Depends(get_current_user),
):
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="LLM not configured — set OPENROUTER_API_KEY")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://chakra-app-ui.onrender.com",
                "X-Title": "Chakra V5",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": body.prompt}],
            },
        )
    data = resp.json()
    if "error" in data:
        raise HTTPException(status_code=502, detail=data["error"].get("message", "LLM error"))
    text = data["choices"][0]["message"]["content"]
    return LLMResponse(text=text)
