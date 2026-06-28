from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base, SessionLocal
from app.routers import auth, users, financial, meetings
import app.models  # noqa: F401

STATIC_DIR = Path(__file__).parent.parent / "static"


def _seed_admin_if_needed():
    from app.models.vve import VvE
    from app.models.user import User
    from app.core.security import get_password_hash
    from app.core.config import settings

    if not settings.ADMIN_USERNAME or not settings.ADMIN_PASSWORD:
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if existing:
            # Corrigeer legacy .local email uit eerdere seed
            if existing.email.endswith(".local"):
                existing.email = f"{settings.ADMIN_USERNAME}@vvebeheer.nl"
                db.commit()
            return
        vve = db.query(VvE).first()
        if not vve:
            vve = VvE(name="Mijn VvE", contribution_frequency="monthly")
            db.add(vve)
            db.flush()
        db.add(User(
            vve_id=vve.id,
            username=settings.ADMIN_USERNAME,
            email=f"{settings.ADMIN_USERNAME}@vvebeheer.nl",
            full_name="Beheerder",
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            role="platform_admin",
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_admin_if_needed()
    yield


app = FastAPI(
    title="VvE Beheer Platform",
    description="Platform voor zelfbeheer van Verenigingen van Eigenaren",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(financial.router)
app.include_router(meetings.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "VvE Beheer Platform"}


# Serveer de React SPA (moet NA alle /api routes staan)
if STATIC_DIR.exists():
    _assets = STATIC_DIR / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path:
            target = STATIC_DIR / full_path
            if target.exists() and target.is_file():
                return FileResponse(target)
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return {"message": "Frontend niet gevonden — start de dev server op poort 5173"}
