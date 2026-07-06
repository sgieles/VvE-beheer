from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.announcement import Announcement
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access

router = APIRouter(prefix="/api/vves/{vve_id}/announcements", tags=["announcements"])


class AnnouncementCreate(BaseModel):
    title: str
    content: str | None = None
    is_pinned: bool = False


class AnnouncementOut(BaseModel):
    id: int
    vve_id: int
    title: str
    content: str | None
    is_pinned: bool
    created_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


def _check_vve_access(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(
    vve_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    return (
        db.query(Announcement)
        .filter(Announcement.vve_id == vve_id)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .all()
    )


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    vve_id: int,
    data: AnnouncementCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    ann = Announcement(
        vve_id=vve_id,
        title=data.title,
        content=data.content,
        is_pinned=data.is_pinned,
        created_by_id=current_user.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@router.patch("/{ann_id}", response_model=AnnouncementOut)
def update_announcement(
    vve_id: int,
    ann_id: int,
    data: AnnouncementCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    ann = db.query(Announcement).filter(
        Announcement.id == ann_id, Announcement.vve_id == vve_id
    ).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Aankondiging niet gevonden")
    ann.title = data.title
    ann.content = data.content
    ann.is_pinned = data.is_pinned
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    vve_id: int,
    ann_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    ann = db.query(Announcement).filter(
        Announcement.id == ann_id, Announcement.vve_id == vve_id
    ).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Aankondiging niet gevonden")
    db.delete(ann)
    db.commit()
