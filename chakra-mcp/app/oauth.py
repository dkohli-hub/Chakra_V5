"""Minimal OAuth 2.1 authorization server for a single user.

Claude's custom-connector dialog drives an OAuth flow: discovery, dynamic client
registration, authorization code + PKCE, then token exchange. This implements the
smallest conformant surface that satisfies it.

There is exactly one "user" (DK), authenticated by a single password on the
consent screen. Codes and tokens are signed JWTs rather than rows in a table, so
the service stays stateless and survives Render restarts without re-auth.
"""

import base64
import hashlib
import html
import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from jose import JWTError, jwt
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse
from starlette.routing import Route

from .auth import ALGORITHM, issue_access_token, issue_refresh_token, public_base_url
from .config import settings

ACCESS_TOKEN_TTL_DAYS = 30


def _err(code: str, description: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": code, "error_description": description}, status_code=status)


# --- Discovery -------------------------------------------------------------

async def protected_resource_metadata(request: Request) -> JSONResponse:
    """RFC 9728 - tells the client which authorization server guards this resource."""
    base = public_base_url(request)
    return JSONResponse(
        {
            "resource": f"{base}/mcp",
            "authorization_servers": [base],
            "bearer_methods_supported": ["header"],
        }
    )


async def authorization_server_metadata(request: Request) -> JSONResponse:
    """RFC 8414 - the endpoints and capabilities of this authorization server."""
    base = public_base_url(request)
    return JSONResponse(
        {
            "issuer": base,
            "authorization_endpoint": f"{base}/oauth/authorize",
            "token_endpoint": f"{base}/oauth/token",
            "registration_endpoint": f"{base}/oauth/register",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
            "scopes_supported": ["chakra:read"],
        }
    )


# --- Dynamic client registration (RFC 7591) --------------------------------

async def register(request: Request) -> JSONResponse:
    """Accept any client. Auth is the consent-screen password, not client identity."""
    try:
        body = await request.json()
    except (json.JSONDecodeError, ValueError):
        body = {}
    client_id = f"chakra-{secrets.token_hex(8)}"
    return JSONResponse(
        {
            "client_id": client_id,
            "client_id_issued_at": int(datetime.now(timezone.utc).timestamp()),
            "redirect_uris": body.get("redirect_uris", []),
            "client_name": body.get("client_name", "Claude"),
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
        },
        status_code=201,
    )


# --- Authorization ---------------------------------------------------------

_CONSENT_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Chakra</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh;
         margin: 0; background: #f6f5f3; color: #1a1a18; }
  @media (prefers-color-scheme: dark) { body { background: #1a1a18; color: #f6f5f3; } }
  .card { width: 100%; max-width: 360px; padding: 32px 28px; border-radius: 14px;
          background: rgba(127,127,127,0.09); }
  h1 { font-size: 19px; margin: 0 0 6px; }
  p { font-size: 14px; opacity: .72; margin: 0 0 22px; line-height: 1.5; }
  input { width: 100%; box-sizing: border-box; padding: 11px 13px; font-size: 15px;
          border-radius: 8px; border: 1px solid rgba(127,127,127,.4);
          background: rgba(127,127,127,.08); color: inherit; }
  button { width: 100%; margin-top: 14px; padding: 11px; font-size: 15px; font-weight: 600;
           border: 0; border-radius: 8px; background: #c15f3c; color: #fff; cursor: pointer; }
  .err { color: #c0392b; font-size: 13px; margin-bottom: 14px; }
</style></head>
<body><form class="card" method="post" action="/oauth/authorize">
  <h1>Connect Chakra to Claude</h1>
  <p>Grants Claude read-only access to __USER__'s tasks.</p>
  __ERROR__
  <input type="password" name="password" placeholder="Access password" autofocus required>
  <button type="submit">Allow access</button>
  __HIDDEN__
</form></body></html>
"""


def _render_consent(params: dict, error: str = "") -> HTMLResponse:
    hidden = "".join(
        f'<input type="hidden" name="{html.escape(k)}" value="{html.escape(v)}">'
        for k, v in params.items()
        if v
    )
    page = (
        _CONSENT_PAGE.replace("__USER__", html.escape(settings.CHAKRA_DISPLAY_NAME))
        .replace("__HIDDEN__", hidden)
        .replace(
            "__ERROR__",
            f'<div class="err">{html.escape(error)}</div>' if error else "",
        )
    )
    return HTMLResponse(page, status_code=401 if error else 200)


_PASSTHROUGH = (
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
    "scope",
    "resource",
)


async def authorize_get(request: Request):
    q = request.query_params
    if q.get("response_type") != "code":
        return _err("unsupported_response_type", "Only response_type=code is supported")
    if not q.get("redirect_uri"):
        return _err("invalid_request", "redirect_uri is required")
    if q.get("code_challenge_method", "S256") != "S256":
        return _err("invalid_request", "Only PKCE method S256 is supported")
    if not q.get("code_challenge"):
        return _err("invalid_request", "code_challenge is required (PKCE)")
    return _render_consent({k: q.get(k, "") for k in _PASSTHROUGH})


async def authorize_post(request: Request):
    form = await request.form()
    params = {k: str(form.get(k, "")) for k in _PASSTHROUGH}
    password = str(form.get("password", ""))

    if not settings.MCP_LOGIN_PASSWORD or not secrets.compare_digest(
        password, settings.MCP_LOGIN_PASSWORD
    ):
        return _render_consent(params, "Incorrect password. Try again.")

    code = jwt.encode(
        {
            "typ": "code",
            "redirect_uri": params["redirect_uri"],
            "code_challenge": params["code_challenge"],
            "client_id": params["client_id"],
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.MCP_SECRET,
        algorithm=ALGORITHM,
    )
    query = {"code": code}
    if params.get("state"):
        query["state"] = params["state"]
    sep = "&" if "?" in params["redirect_uri"] else "?"
    return RedirectResponse(
        f"{params['redirect_uri']}{sep}{urlencode(query)}", status_code=302
    )


# --- Token exchange --------------------------------------------------------

def _pkce_ok(verifier: str, challenge: str) -> bool:
    if not verifier or not challenge:
        return False
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    computed = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return secrets.compare_digest(computed, challenge)


def _token_response() -> JSONResponse:
    return JSONResponse(
        {
            "access_token": issue_access_token(ACCESS_TOKEN_TTL_DAYS),
            "token_type": "Bearer",
            "expires_in": ACCESS_TOKEN_TTL_DAYS * 24 * 3600,
            "refresh_token": issue_refresh_token(),
            "scope": "chakra:read",
        },
        headers={"Cache-Control": "no-store"},
    )


async def token(request: Request) -> JSONResponse:
    form = await request.form()
    grant_type = str(form.get("grant_type", ""))

    if grant_type == "authorization_code":
        try:
            claims = jwt.decode(
                str(form.get("code", "")), settings.MCP_SECRET, algorithms=[ALGORITHM]
            )
        except JWTError:
            return _err("invalid_grant", "Authorization code is invalid or expired")
        if claims.get("typ") != "code":
            return _err("invalid_grant", "Wrong token type presented as a code")
        redirect_uri = str(form.get("redirect_uri", ""))
        if redirect_uri and redirect_uri != claims.get("redirect_uri"):
            return _err("invalid_grant", "redirect_uri does not match the authorization request")
        if not _pkce_ok(str(form.get("code_verifier", "")), claims.get("code_challenge", "")):
            return _err("invalid_grant", "PKCE verification failed")
        return _token_response()

    if grant_type == "refresh_token":
        try:
            claims = jwt.decode(
                str(form.get("refresh_token", "")),
                settings.MCP_SECRET,
                algorithms=[ALGORITHM],
            )
        except JWTError:
            return _err("invalid_grant", "Refresh token is invalid or expired")
        if claims.get("typ") != "mcp_refresh":
            return _err("invalid_grant", "Wrong token type presented as a refresh token")
        return _token_response()

    return _err("unsupported_grant_type", f"Unsupported grant_type: {grant_type!r}")


# Claude may probe either the bare well-known path or one suffixed with the
# resource path, so both are served.
routes = [
    Route("/.well-known/oauth-protected-resource", protected_resource_metadata, methods=["GET"]),
    Route("/.well-known/oauth-protected-resource/mcp", protected_resource_metadata, methods=["GET"]),
    Route("/.well-known/oauth-authorization-server", authorization_server_metadata, methods=["GET"]),
    Route("/.well-known/oauth-authorization-server/mcp", authorization_server_metadata, methods=["GET"]),
    Route("/oauth/register", register, methods=["POST"]),
    Route("/oauth/authorize", authorize_get, methods=["GET"]),
    Route("/oauth/authorize", authorize_post, methods=["POST"]),
    Route("/oauth/token", token, methods=["POST"]),
]
