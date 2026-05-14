import os
import shutil
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.meeting import Meeting, AgendaItem, MeetingMinutes
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.core.config import settings
from app.schemas.meetings import (
    MeetingCreate, MeetingOut,
    AgendaItemCreate, AgendaItemOut, AgendaItemOrder,
    MinutesCreate, MinutesOut,
)

router = APIRouter(prefix="/api/vves/{vve_id}/meetings", tags=["meetings"])


def _check_vve_access(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


# --- Vergaderingen ---

@router.get("", response_model=list[MeetingOut])
def list_meetings(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    return db.query(Meeting).filter(Meeting.vve_id == vve_id).order_by(Meeting.meeting_date.desc()).all()


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def create_meeting(
    vve_id: int,
    data: MeetingCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    meeting = Meeting(vve_id=vve_id, created_by_id=current_user.id, **data.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(vve_id: int, meeting_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.vve_id == vve_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Vergadering niet gevonden")
    return meeting


@router.post("/{meeting_id}/create-teams-meeting", response_model=MeetingOut)
async def create_teams_meeting(
    vve_id: int,
    meeting_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    """Maak een Teams meeting aan en stuur uitnodigingen naar alle leden."""
    _check_vve_access(vve_id, current_user, db)
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.vve_id == vve_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Vergadering niet gevonden")
    if meeting.teams_url:
        raise HTTPException(status_code=400, detail="Teams meeting al aangemaakt")

    members = db.query(User).filter(User.vve_id == vve_id, User.is_active == True).all()
    attendee_emails = [m.email for m in members if m.email]

    from app.services.teams_service import create_teams_meeting as _create, send_meeting_invitation
    from app.models.vve import VvE
    vve = db.query(VvE).filter(VvE.id == vve_id).first()

    end_dt = meeting.meeting_date + timedelta(hours=2)
    try:
        result = await _create(
            subject=meeting.title,
            start_dt=meeting.meeting_date,
            end_dt=end_dt,
            organizer_email=current_user.email,
            attendee_emails=attendee_emails,
        )
        meeting.teams_url = result["join_url"]
        meeting.teams_meeting_id = result["meeting_id"]

        await send_meeting_invitation(
            subject=meeting.title,
            body=f"U bent uitgenodigd voor de vergadering van {vve.name if vve else 'de VvE'}.",
            start_dt=meeting.meeting_date,
            end_dt=end_dt,
            organizer_email=current_user.email,
            attendee_emails=attendee_emails,
            teams_url=result["join_url"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Teams integratie fout: {str(e)}")

    db.commit()
    db.refresh(meeting)
    return meeting


# --- Agendapunten ---

@router.get("/agenda/pending", response_model=list[AgendaItemOut])
def list_pending_agenda_items(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Nog niet gekoppelde agendapunten (verzamelbak)."""
    _check_vve_access(vve_id, current_user, db)
    return db.query(AgendaItem).filter(
        AgendaItem.vve_id == vve_id, AgendaItem.meeting_id.is_(None)
    ).order_by(AgendaItem.submitted_at).all()


@router.post("/agenda", response_model=AgendaItemOut, status_code=status.HTTP_201_CREATED)
def submit_agenda_item(
    vve_id: int,
    data: AgendaItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ieder lid kan een agendapunt indienen."""
    _check_vve_access(vve_id, current_user, db)
    item = AgendaItem(vve_id=vve_id, submitted_by_id=current_user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{meeting_id}/agenda", response_model=list[AgendaItemOut])
def get_meeting_agenda(vve_id: int, meeting_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    return db.query(AgendaItem).filter(
        AgendaItem.vve_id == vve_id, AgendaItem.meeting_id == meeting_id
    ).order_by(AgendaItem.order_index, AgendaItem.submitted_at).all()


@router.post("/{meeting_id}/agenda/compile", response_model=list[AgendaItemOut])
def compile_agenda(
    vve_id: int,
    meeting_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    """1-klik: koppel alle ingediende agendapunten aan deze vergadering."""
    _check_vve_access(vve_id, current_user, db)
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.vve_id == vve_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Vergadering niet gevonden")

    pending = db.query(AgendaItem).filter(
        AgendaItem.vve_id == vve_id, AgendaItem.meeting_id.is_(None)
    ).order_by(AgendaItem.submitted_at).all()

    # Bepaal volgende beschikbare order_index
    existing_max = db.query(AgendaItem).filter(
        AgendaItem.meeting_id == meeting_id
    ).count()

    for i, item in enumerate(pending):
        item.meeting_id = meeting_id
        item.is_included = True
        item.order_index = existing_max + i + 1

    db.commit()
    return db.query(AgendaItem).filter(AgendaItem.meeting_id == meeting_id).order_by(AgendaItem.order_index).all()


@router.patch("/{meeting_id}/agenda/reorder")
def reorder_agenda(
    vve_id: int,
    meeting_id: int,
    data: AgendaItemOrder,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    """Sla de volgorde van agendapunten op."""
    _check_vve_access(vve_id, current_user, db)
    for index, item_id in enumerate(data.item_ids):
        db.query(AgendaItem).filter(
            AgendaItem.id == item_id, AgendaItem.meeting_id == meeting_id
        ).update({"order_index": index + 1})
    db.commit()
    return {"ok": True}


# --- Notulen ---

@router.get("/{meeting_id}/minutes", response_model=list[MinutesOut])
def get_minutes(vve_id: int, meeting_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    query = db.query(MeetingMinutes).filter(
        MeetingMinutes.meeting_id == meeting_id, MeetingMinutes.vve_id == vve_id
    )
    # Leden zien alleen goedgekeurde notulen
    if current_user.role == "eigenaar":
        query = query.filter(MeetingMinutes.is_approved == True)
    return query.all()


@router.post("/{meeting_id}/minutes", response_model=MinutesOut, status_code=status.HTTP_201_CREATED)
async def upload_minutes(
    vve_id: int,
    meeting_id: int,
    content: str | None = None,
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    doc_path = None
    if file:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "minutes", str(vve_id))
        os.makedirs(upload_dir, exist_ok=True)
        stored_name = f"{meeting_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        doc_path = os.path.join(upload_dir, stored_name)
        with open(doc_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

    minutes = MeetingMinutes(
        vve_id=vve_id,
        meeting_id=meeting_id,
        content=content,
        document_path=doc_path,
        uploaded_by_id=current_user.id,
    )
    db.add(minutes)
    db.commit()
    db.refresh(minutes)
    return minutes


@router.patch("/{meeting_id}/minutes/{minutes_id}", response_model=MinutesOut)
def update_minutes(
    vve_id: int,
    meeting_id: int,
    minutes_id: int,
    data: MinutesCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id, MeetingMinutes.meeting_id == meeting_id
    ).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="Notulen niet gevonden")
    if minutes.is_approved:
        raise HTTPException(status_code=400, detail="Goedgekeurde notulen kunnen niet meer bewerkt worden")
    minutes.content = data.content
    db.commit()
    db.refresh(minutes)
    return minutes


@router.post("/{meeting_id}/minutes/{minutes_id}/approve", response_model=MinutesOut)
def approve_minutes(
    vve_id: int,
    meeting_id: int,
    minutes_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id, MeetingMinutes.meeting_id == meeting_id
    ).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="Notulen niet gevonden")
    minutes.is_approved = True
    minutes.approved_at = datetime.now(timezone.utc)
    minutes.approved_by_id = current_user.id
    db.commit()
    db.refresh(minutes)
    return minutes
