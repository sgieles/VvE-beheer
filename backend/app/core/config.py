from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-this-to-a-long-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "sqlite:///./vve_beheer.db"

    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = ""

    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = ".env"


settings = Settings()
