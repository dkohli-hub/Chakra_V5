from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration for the Chakra MCP connector.

    Every value comes from the environment (Render) or a local .env file.
    Nothing here is secret at rest in the repo.
    """

    # The existing Chakra FastAPI backend, e.g. https://chakra-v5-backend.onrender.com
    CHAKRA_API_URL: str = "http://localhost:8000"

    # MUST match the Chakra backend's SECRET_KEY. Used only to mint a short-lived
    # read token so we can call the app's own GET /tasks endpoint.
    SECRET_KEY: str = "change-me"

    # The Chakra login id whose tasks this connector exposes. Tasks are scoped to
    # this id by the backend itself, so the connector cannot leak another user's rows.
    CHAKRA_USER_ID: str = "dk"
    CHAKRA_DISPLAY_NAME: str = "DK"

    # Static bearer token. Used if Claude's connector dialog accepts a raw token.
    MCP_ACCESS_TOKEN: str = ""

    # Password typed on the OAuth consent screen. Defaults to MCP_ACCESS_TOKEN.
    MCP_LOGIN_PASSWORD: str = ""

    # Signs the OAuth codes and access tokens this server issues.
    # Defaults to SECRET_KEY, but set it separately in production.
    MCP_SECRET: str = ""

    # Public https URL of THIS service, e.g. https://chakra-mcp.onrender.com
    # Leave blank to derive it from the incoming request.
    PUBLIC_URL: str = ""

    # Timezone for displaying timestamps. Handles DST automatically.
    TIMEZONE: str = "America/Chicago"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

if not settings.MCP_LOGIN_PASSWORD:
    settings.MCP_LOGIN_PASSWORD = settings.MCP_ACCESS_TOKEN
if not settings.MCP_SECRET:
    settings.MCP_SECRET = settings.SECRET_KEY
