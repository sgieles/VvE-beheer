from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.routers import auth, users, financial, meetings
from app.routers import appartementen
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


def _run_migrations():
    """Voeg nieuwe kolommen toe aan bestaande tabellen zonder Alembic."""
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE vves ADD COLUMN IF NOT EXISTS share_denominator INTEGER DEFAULT 1"
            ))
            conn.commit()
        except Exception:
            conn.rollback()


def _seed_demo_data_if_needed():
    """Maak de Kinderdijkstraat demo-VvE aan als die nog niet bestaat (idempotent)."""
    from app.models.vve import VvE
    from app.models.appartement import Appartement
    from app.models.financial import MJOPUpload, MJOPItem, ReserveFondsEntry, ContributionPlan
    from app.models.user import User
    from decimal import Decimal
    from datetime import date as dt_date

    db = SessionLocal()
    try:
        if db.query(VvE).filter(VvE.name == "Kinderdijkstraat 57-63").first():
            return

        admin = db.query(User).first()

        vve = VvE(
            name="Kinderdijkstraat 57-63",
            address="Kinderdijkstraat 57-63, 1079 DX Amsterdam",
            contribution_frequency="monthly",
            share_denominator=32,
        )
        db.add(vve)
        db.flush()

        if admin:
            admin.vve_id = vve.id

        for naam, nummer, aandeel in [
            ("Kinderdijkstraat 57-H", "57-H", 2),
            ("Kinderdijkstraat 57-1", "57-1", 3),
            ("Kinderdijkstraat 57-2", "57-2", 3),
            ("Kinderdijkstraat 59-H", "59-H", 2),
            ("Kinderdijkstraat 59-1", "59-1", 3),
            ("Kinderdijkstraat 59-2", "59-2", 3),
            ("Kinderdijkstraat 61-H", "61-H", 2),
            ("Kinderdijkstraat 61-1", "61-1", 3),
            ("Kinderdijkstraat 61-2", "61-2", 3),
            ("Kinderdijkstraat 63-H", "63-H", 2),
            ("Kinderdijkstraat 63-1", "63-1", 3),
            ("Kinderdijkstraat 63-2", "63-2", 3),
        ]:
            db.add(Appartement(
                vve_id=vve.id, naam=naam, nummer=nummer, aandeel=Decimal(str(aandeel))
            ))

        db.add(ContributionPlan(
            vve_id=vve.id,
            amount_per_period=Decimal("1840.00"),
            effective_from=dt_date(2021, 1, 1),
            notes="€57,50 per 1/32 aandeel",
        ))

        db.add(ReserveFondsEntry(
            vve_id=vve.id,
            entry_date=dt_date(2021, 1, 1),
            amount=Decimal("45000.00"),
            description="Openingssaldo 2021",
        ))

        mjop = MJOPUpload(
            vve_id=vve.id,
            original_filename="MJOP 2021-19.pdf",
            stored_filename="seed_mjop_2021-19.pdf",
            status="active",
            uploaded_by_id=admin.id if admin else 1,
        )
        db.add(mjop)
        db.flush()

        for jaar, omschrijving, categorie, bedrag in [
            (2022, "Schilderwerk kozijnen buitenzijde (alle panden)", "kozijnen", 8500),
            (2023, "Dakbedekking pand nr. 57 – gedeeltelijk herstel", "dak", 4200),
            (2024, "Voegwerk gevel alle panden", "gevel", 18500),
            (2025, "Schilderwerk trappenhuis alle panden", "gevel", 6800),
            (2026, "Dakbedekking pand nr. 59 – vervanging", "dak", 14800),
            (2027, "Intercomsysteem vernieuwen (alle panden)", "installaties", 5200),
            (2028, "Schilderwerk kozijnen + kitten (alle panden)", "kozijnen", 9200),
            (2029, "Dakbedekking pand nr. 61 – vervanging", "dak", 15500),
            (2030, "Gevelreiniging en impregnering alle panden", "gevel", 7400),
            (2031, "CV-ketel vervanging gemeenschappelijke ruimtes", "installaties", 4100),
            (2032, "Dakbedekking pand nr. 63 – vervanging", "dak", 16200),
            (2033, "Schilderwerk kozijnen buitenzijde (alle panden)", "kozijnen", 9800),
            (2034, "Beglazing vervanging raamkozijnen", "kozijnen", 22000),
            (2035, "Centrale verwarmingsinstallatie renovatie", "installaties", 18500),
            (2036, "Voegwerk gevel alle panden", "gevel", 20000),
            (2038, "Dakbedekking alle panden – volledige vervanging", "dak", 65000),
            (2039, "Toegangsdeuren vernieuwen (alle panden)", "gevel", 14000),
            (2040, "Ventilatiesysteem renovatie", "installaties", 11500),
        ]:
            db.add(MJOPItem(
                vve_id=vve.id,
                mjop_upload_id=mjop.id,
                description=omschrijving,
                category=categorie,
                planned_year=jaar,
                planned_amount=Decimal(str(bedrag)),
            ))

        db.commit()
        print("Demo data aangemaakt: Kinderdijkstraat 57-63")
    except Exception as e:
        db.rollback()
        print(f"Demo seed mislukt: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _seed_admin_if_needed()
    _seed_demo_data_if_needed()
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
app.include_router(appartementen.router)


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
