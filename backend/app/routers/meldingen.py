import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.melding import Melding
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.core.config import settings
from app.schemas.meldingen import MeldingCreate, MeldingOut, MeldingUpdate

router = APIRouter(prefix="/api/vves/{vve_id}/meldingen", tags=["meldingen"])

ALLOWED_STATUSES = {"nieuw", "in_behandeling", "opgelost", "afgesloten"}
ALLOWED_URGENCIES = {"laag", "normaal", "hoog", "spoed"}


def _check(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[MeldingOut])
def list_meldingen(
    vve_id: int,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    q = db.query(Melding).filter(Melding.vve_id == vve_id)
    # Eigenaren zien alleen hun eigen meldingen
    if current_user.role == "eigenaar":
        q = q.filter(Melding.reporter_id == current_user.id)
    if status:
        q = q.filter(Melding.status == status)
    return q.order_by(Melding.reported_at.desc()).all()


@router.post("", response_model=MeldingOut, status_code=status.HTTP_201_CREATED)
async def create_melding(
    vve_id: int,
    title: str,
    description: str | None = None,
    category: str = "overig",
    urgency: str = "normaal",
    photo: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    if urgency not in ALLOWED_URGENCIES:
        raise HTTPException(status_code=400, detail=f"Ongeldige urgentie: {urgency}")

    photo_path = None
    if photo and photo.filename:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "meldingen", str(vve_id))
        os.makedirs(upload_dir, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        stored = f"{ts}_{photo.filename}"
        photo_path = os.path.join(upload_dir, stored)
        with open(photo_path, "wb") as f:
            shutil.copyfileobj(photo.file, f)

    melding = Melding(
        vve_id=vve_id,
        title=title,
        description=description,
        category=category,
        urgency=urgency,
        photo_path=photo_path,
        reporter_id=current_user.id,
    )
    db.add(melding)
    db.commit()
    db.refresh(melding)
    return melding


@router.patch("/{melding_id}", response_model=MeldingOut)
def update_melding(
    vve_id: int,
    melding_id: int,
    data: MeldingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    melding = db.query(Melding).filter(Melding.id == melding_id, Melding.vve_id == vve_id).first()
    if not melding:
        raise HTTPException(status_code=404, detail="Melding niet gevonden")

    # Eigenaren kunnen status niet zelf wijzigen
    is_beheerder = current_user.role in {"beheerder", "platform_admin"}
    if not is_beheerder and melding.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")

    if data.status is not None:
        if not is_beheerder:
            raise HTTPException(status_code=403, detail="Alleen beheerders mogen de status wijzigen")
        if data.status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"Ongeldige status: {data.status}")
        melding.status = data.status
        if data.status == "opgelost" and not melding.resolved_at:
            melding.resolved_at = datetime.now(timezone.utc)
        elif data.status != "opgelost":
            melding.resolved_at = None

    if data.notes is not None and is_beheerder:
        melding.notes = data.notes
    if data.assigned_to_id is not None and is_beheerder:
        melding.assigned_to_id = data.assigned_to_id
    if data.urgency is not None:
        if data.urgency not in ALLOWED_URGENCIES:
            raise HTTPException(status_code=400, detail=f"Ongeldige urgentie: {data.urgency}")
        melding.urgency = data.urgency

    db.commit()
    db.refresh(melding)
    return melding


@router.delete("/{melding_id}", status_code=204)
def delete_melding(
    vve_id: int,
    melding_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    melding = db.query(Melding).filter(Melding.id == melding_id, Melding.vve_id == vve_id).first()
    if not melding:
        raise HTTPException(status_code=404, detail="Melding niet gevonden")
    if melding.photo_path and os.path.exists(melding.photo_path):
        os.remove(melding.photo_path)
    db.delete(melding)
    db.commit()


@router.get("/stats", response_model=dict)
def melding_stats(
    vve_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    q = db.query(Melding).filter(Melding.vve_id == vve_id)
    if current_user.role == "eigenaar":
        q = q.filter(Melding.reporter_id == current_user.id)
    all_m = q.all()
    return {
        "nieuw": sum(1 for m in all_m if m.status == "nieuw"),
        "in_behandeling": sum(1 for m in all_m if m.status == "in_behandeling"),
        "opgelost": sum(1 for m in all_m if m.status == "opgelost"),
        "afgesloten": sum(1 for m in all_m if m.status == "afgesloten"),
        "spoed": sum(1 for m in all_m if m.urgency == "spoed" and m.status not in {"opgelost", "afgesloten"}),
    }
