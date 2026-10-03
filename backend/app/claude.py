import anthropic
from fastapi import HTTPException

from .config import settings

_client = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        # The page gives up after ~9 s and falls back to its keyword reader,
        # so keep each attempt short and retry at most once.
        _client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY, timeout=15.0, max_retries=1
        )
    return _client


async def claude_generate(prompt: str, max_tokens: int = 700) -> str:
    """Send one user turn to Claude and return the reply text."""
    try:
        response = await _get_client().messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=502, detail="Claude error: invalid API key")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=502, detail="Claude error: rate limited")
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Claude error: {e.message}")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Claude error: could not connect")
    return "".join(block.text for block in response.content if block.type == "text")
