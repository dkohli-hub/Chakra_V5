import json
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/chakra"
    SECRET_KEY: str = "change-me-in-production-use-random-32-chars"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4"
    OPENROUTER_VISION_MODEL: str = "google/gemini-flash-1.5"
    USER_ACCOUNTS: str = '[{"id":"dk","password":"CHANGE_ME_1","displayName":"DK"}]'

    def get_user_accounts(self):
        return json.loads(self.USER_ACCOUNTS)

    class Config:
        env_file = ".env"


settings = Settings()
