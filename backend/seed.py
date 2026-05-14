"""
Seed script: maak een demo VvE aan met beheerder en twee eigenaren.
Gebruik: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
import app.models  # noqa — registreer alle modellen
from app.models.vve import VvE
from app.models.user import User
from app.models.vve_access import UserVvEAccess
from app.core.security import get_password_hash
from decimal import Decimal

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Platform admin (geen vve_id)
admin = db.query(User).filter(User.username == "admin").first()
if not admin:
    admin = User(
        vve_id=None,
        username="admin",
        email="admin@platform.nl",
        full_name="Platform Beheerder",
        hashed_password=get_password_hash("admin123"),
        role="platform_admin",
    )
    db.add(admin)
    db.flush()
    print(f"Admin aangemaakt: admin / admin123")
else:
    print(f"Admin bestaat al (id={admin.id})")

# VvE aanmaken (skip als al bestaat)
vve = db.query(VvE).filter(VvE.name == "VvE De Zonnehof").first()
if not vve:
    vve = VvE(name="VvE De Zonnehof", address="Zonnelaan 1, 1234 AB Amsterdam", contribution_frequency="monthly")
    db.add(vve)
    db.flush()

    beheerder = User(
        vve_id=vve.id,
        username="beheerder",
        email="beheerder@zonnehof.nl",
        full_name="Jan de Beheerder",
        hashed_password=get_password_hash("beheerder123"),
        role="beheerder",
        aandeel=Decimal("0.2"),
        appartement_nummer="A01",
        address="Zonnelaan 1A, 1234 AB Amsterdam",
    )
    db.add(beheerder)
    db.flush()
    # Koppel beheerder ook via UserVvEAccess
    db.add(UserVvEAccess(user_id=beheerder.id, vve_id=vve.id))

    db.add(User(
        vve_id=vve.id, username="eigenaar1", email="eigenaar1@zonnehof.nl",
        full_name="Marie Janssen", hashed_password=get_password_hash("eigenaar123"),
        role="eigenaar", aandeel=Decimal("0.4"), appartement_nummer="A02",
        address="Zonnelaan 1B, 1234 AB Amsterdam",
    ))
    db.add(User(
        vve_id=vve.id, username="eigenaar2", email="eigenaar2@zonnehof.nl",
        full_name="Piet Pietersen", hashed_password=get_password_hash("eigenaar123"),
        role="eigenaar", aandeel=Decimal("0.4"), appartement_nummer="A03",
        address="Zonnelaan 1C, 1234 AB Amsterdam",
    ))
    db.commit()
    print(f"VvE aangemaakt: {vve.name} (id={vve.id})")
    print(f"  beheerder / beheerder123")
    print(f"  eigenaar1 / eigenaar123")
    print(f"  eigenaar2 / eigenaar123")
else:
    db.commit()
    print(f"VvE bestaat al: {vve.name} (id={vve.id})")

db.close()
