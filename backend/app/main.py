from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, users, financial, meetings

# Importeer alle modellen zodat SQLAlchemy de tabellen aanmaakt
import app.models  # noqa: F401

app = FastAPI(
    title="VvE Beheer Platform",
    description="Platform voor zelfbeheer van Verenigingen van Eigenaren",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Maak alle tabellen aan bij opstarten
Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(financial.router)
app.include_router(meetings.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "VvE Beheer Platform"}
