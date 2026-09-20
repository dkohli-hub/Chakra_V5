"""Bearer-token auth for the MCP endpoint.

Two credentials are accepted, so the build does not depend on which one Claude's
connector dialog offers:

  1. MCP_ACCESS_TOKEN  — a static shared secret, if a raw token field is available.
  2. An OAuth access token issued by app/oauth.py, if the dialog requires OAuth.
"""

import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import settings

ALGORITHM = "HS256"

# Paths that must stay reachable without a token, or the OAuth flow cannot start.
PUBLIC_PREFIXES = ("/.well-known", "/oauth", "/health")


def public_base_url(request: Request) -> str:
    """The externally visible base URL of this service."""
    if settings.PUBLIC_URL:
        return settings.PUBLIC_URL.rstrip("/")
    # Render terminates TLS at the edge, so trust its forwarded scheme.
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{scheme}://{host}"


def issue_access_token(ttl_days: int = 30) -> str:
    return jwt.encode(
        {
            "sub": settings.CHAKRA_USER_ID,
            "typ": "mcp_access",
            "jti": secrets.token_hex(8),
            "exp": datetime.now(timezone.utc) + timedelta(days=ttl_days),
        },
        settings.MCP_SECRET,
        algorithm=ALGORITHM,
    )


def issue_refresh_token(ttl_days: int = 365) -> str:
    return jwt.encode(
        {
            "sub": settings.CHAKRA_USER_ID,
            "typ": "mcp_refresh",
            "jti": secrets.token_hex(8),
            "exp": datetime.now(timezone.utc) + timedelta(days=ttl_days),
        },
        settings.MCP_SECRET,
        algorithm=ALGORITHM,
    )


def verify_token(token: str, expected_typ: str = "mcp_access") -> bool:
    if not token:
        return False
    if settings.MCP_ACCESS_TOKEN and secrets.compare_digest(
        token, settings.MCP_ACCESS_TOKEN
    ):
        return True
    try:
        payload = jwt.decode(token, settings.MCP_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return False
    return payload.get("typ") == expected_typ


class BearerAuthMiddleware(BaseHTTPMiddleware):
    """Rejects unauthenticated calls to /mcp with an RFC 9728 challenge.

    The WWW-Authenticate header is what tells Claude where to discover the OAuth
    server. Without it the client has no way to begin the flow.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path == "/" or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
        else:
            # Fallback for clients that cannot set a custom header.
            token = request.query_params.get("token", "")

        if not verify_token(token):
            base = public_base_url(request)
            return JSONResponse(
                {"error": "invalid_token", "error_description": "Missing or invalid access token"},
                status_code=401,
                headers={
                    "WWW-Authenticate": (
                        'Bearer error="invalid_token", '
                        f'resource_metadata="{base}/.well-known/oauth-protected-resource"'
                    )
                },
            )
        return await call_next(request)
