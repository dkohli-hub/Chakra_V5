import httpx
from fastapi import HTTPException

from .config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


async def gemini_generate(parts: list, timeout: float = 60) -> str:
    """Send one user turn to Gemini and return the reply text.

    `parts` uses Gemini's format, e.g. [{"text": "..."}] or
    [{"inline_data": {"mime_type": "image/jpeg", "data": b64}}, {"text": "..."}].
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            GEMINI_URL.format(model=settings.GEMINI_MODEL),
            headers={"x-goog-api-key": settings.GEMINI_API_KEY},
            json={"contents": [{"role": "user", "parts": parts}]},
        )
    data = resp.json() if resp.content else {}
    if resp.status_code != 200:
        msg = (data.get("error") or {}).get("message") or resp.text[:300]
        raise HTTPException(status_code=502, detail=f"Gemini error: {msg}")
    try:
        reply = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        return ""
    # Skip the model's internal reasoning parts; keep only the answer.
    return "".join(p.get("text", "") for p in reply if not p.get("thought"))
