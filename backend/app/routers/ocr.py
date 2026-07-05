import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from ..config import settings
from ..schemas import OCRRequest, OCRResponse

router = APIRouter(prefix="/ocr", tags=["ocr"])
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/scan", response_model=OCRResponse)
async def scan_image(
    body: OCRRequest,
    user_id: str = Depends(get_current_user),
):
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY not configured")

    payload = {
        "model": settings.OPENROUTER_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{body.image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": "Extract all text from this image. Return only the raw extracted text, preserving line breaks. No commentary, no formatting, just the text."
                    }
                ]
            }
        ],
        "max_tokens": 2048,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Vision model error: {resp.text}")

    try:
        text = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        text = ""

    return OCRResponse(text=text)
