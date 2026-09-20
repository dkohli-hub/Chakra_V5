"""ASGI entrypoint: the MCP endpoint, its auth gate, and the OAuth endpoints."""

from urllib.parse import urlparse

from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from . import oauth
from .auth import BearerAuthMiddleware
from .config import settings
from .server import mcp


def _transport_security() -> TransportSecuritySettings:
    """Allow the public Render host through the SDK's DNS-rebinding protection.

    The protection defaults to on with an empty allowlist, which rejects every
    request once deployed. With no PUBLIC_URL set we are running locally, so it
    is switched off rather than guessed at.
    """
    if not settings.PUBLIC_URL:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    host = urlparse(settings.PUBLIC_URL).netloc
    return TransportSecuritySettings(
        allowed_hosts=[host, f"{host}:443"],
        allowed_origins=[settings.PUBLIC_URL.rstrip("/")],
    )


async def health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "chakra-mcp"})


# stateless_http keeps each request self-contained, so Render can restart or run
# multiple workers without Claude losing its session.
app = mcp.streamable_http_app(
    streamable_http_path="/mcp",
    stateless_http=True,
    transport_security=_transport_security(),
)

app.router.routes.extend(oauth.routes)
app.router.routes.append(Route("/health", health, methods=["GET"]))
app.add_middleware(BearerAuthMiddleware)
