from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.appartement import Appartement
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.schemas.appartementen import AppartementCreate, AppartementUpdate, AppartementOut

router = APIRouter(prefix="/api/vves/{vve_id}/appartementen", tags=["appartementen"])


def _check_access(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[AppartementOut])
def list_appartementen(
    vve_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_access(vve_id, current_user, db)
    return (
        db.query(Appartement)
        .filter(Appartement.vve_id == vve_id)
        .order_by(Appartement.nummer, Appartement.naam)
        .all()
    )


@router.post("", response_model=AppartementOut, status_code=status.HTTP_201_CREATED)
def create_appartement(
    vve_id: int,
    data: AppartementCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_access(vve_id, current_user, db)
    app_ = Appartement(vve_id=vve_id, **data.model_dump())
    db.add(app_)
    db.commit()
    db.refresh(app_)
    return app_


@router.patch("/{appartement_id}", response_model=AppartementOut)
def update_appartement(
    vve_id: int,
    appartement_id: int,
    data: AppartementUpdate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_access(vve_id, current_user, db)
    app_ = db.query(Appartement).filter(
        Appartement.id == appartement_id, Appartement.vve_id == vve_id
    ).first()
    if not app_:
        raise HTTPException(status_code=404, detail="Appartement niet gevonden")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(app_, field, value)
    db.commit()
    db.refresh(app_)
    return app_


@router.delete("/{appartement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appartement(
    vve_id: int,
    appartement_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_access(vve_id, current_user, db)
    app_ = db.query(Appartement).filter(
        Appartement.id == appartement_id, Appartement.vve_id == vve_id
    ).first()
    if not app_:
        raise HTTPException(status_code=404, detail="Appartement niet gevonden")
    db.delete(app_)
    db.commit()
