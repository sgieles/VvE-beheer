from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.vve import VvE
from app.models.vve_access import UserVvEAccess
from app.core.security import get_password_hash
from app.core.dependencies import (
    get_current_user, get_current_beheerder, get_current_platform_admin,
    require_vve_access, get_accessible_vve_ids,
)
from app.schemas.users import UserCreate, UserUpdate, UserOut, VvECreate, VvEOut

router = APIRouter(prefix="/api", tags=["users"])


# --- VvE overzicht (admin + multi-beheerder) ---

@router.get("/vves", response_model=list[VvEOut])
def list_vves(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Geeft alle VvE's terug die de gebruiker mag zien."""
    ids = get_accessible_vve_ids(current_user, db)
    return db.query(VvE).filter(VvE.id.in_(ids), VvE.is_active == True).all()


@router.post("/vves", response_model=VvEOut, status_code=status.HTTP_201_CREATED)
def create_vve(
    data: VvECreate,
    current_user: User = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    """Alleen platform admin kan een nieuwe VvE aanmaken."""
    vve = VvE(**data.model_dump())
    db.add(vve)
    db.commit()
    db.refresh(vve)
    return vve


@router.get("/vves/{vve_id}", response_model=VvEOut)
def get_vve(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_vve_access(vve_id, current_user, db)
    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    if not vve:
        raise HTTPException(status_code=404, detail="VvE niet gevonden")
    return vve


@router.patch("/vves/{vve_id}", response_model=VvEOut)
def update_vve(
    vve_id: int,
    data: VvECreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    require_vve_access(vve_id, current_user, db)
    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    if not vve:
        raise HTTPException(status_code=404, detail="VvE niet gevonden")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(vve, field, value)
    db.commit()
    db.refresh(vve)
    return vve


# --- Beheerder koppelen aan extra VvE's (admin only) ---

@router.post("/vves/{vve_id}/assign-beheerder/{user_id}", status_code=status.HTTP_201_CREATED)
def assign_beheerder(
    vve_id: int,
    user_id: int,
    current_user: User = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    """Wijs een beheerder toe aan een VvE (platform admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    if user.role not in ("beheerder", "platform_admin"):
        # Upgrade naar beheerder als nog eigenaar
        user.role = "beheerder"
    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    if not vve:
        raise HTTPException(status_code=404, detail="VvE niet gevonden")
    existing = db.query(UserVvEAccess).filter(
        UserVvEAccess.user_id == user_id, UserVvEAccess.vve_id == vve_id
    ).first()
    if not existing:
        db.add(UserVvEAccess(user_id=user_id, vve_id=vve_id))
    # Zorg dat vve_id ook primary is als dit de eerste VvE is
    if user.vve_id is None:
        user.vve_id = vve_id
    db.commit()
    return {"ok": True, "user_id": user_id, "vve_id": vve_id}


@router.delete("/vves/{vve_id}/assign-beheerder/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_beheerder(
    vve_id: int,
    user_id: int,
    current_user: User = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    db.query(UserVvEAccess).filter(
        UserVvEAccess.user_id == user_id, UserVvEAccess.vve_id == vve_id
    ).delete()
    db.commit()


# --- Leden ---

@router.get("/vves/{vve_id}/members", response_model=list[UserOut])
def list_members(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_vve_access(vve_id, current_user, db)
    return db.query(User).filter(User.vve_id == vve_id).all()


@router.post("/vves/{vve_id}/members", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_member(
    vve_id: int,
    data: UserCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    require_vve_access(vve_id, current_user, db)
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Gebruikersnaam al in gebruik")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mailadres al in gebruik")
    user = User(
        vve_id=vve_id,
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        aandeel=data.aandeel,
        appartement_nummer=data.appartement_nummer,
        address=data.address,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/vves/{vve_id}/members/{user_id}", response_model=UserOut)
def update_member(
    vve_id: int,
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    require_vve_access(vve_id, current_user, db)
    user = db.query(User).filter(User.id == user_id, User.vve_id == vve_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Lid niet gevonden")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/vves/{vve_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_member(
    vve_id: int,
    user_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    require_vve_access(vve_id, current_user, db)
    user = db.query(User).filter(User.id == user_id, User.vve_id == vve_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Lid niet gevonden")
    user.is_active = False
    db.commit()
