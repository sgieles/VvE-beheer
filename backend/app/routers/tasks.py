from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.action_item import ActionItem
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.schemas.tasks import ActionItemCreate, ActionItemOut, ActionItemUpdate

router = APIRouter(prefix="/api/vves/{vve_id}/tasks", tags=["tasks"])


def _check(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[ActionItemOut])
def list_tasks(
    vve_id: int,
    meeting_id: int | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    q = db.query(ActionItem).filter(ActionItem.vve_id == vve_id)
    if meeting_id is not None:
        q = q.filter(ActionItem.meeting_id == meeting_id)
    if status:
        q = q.filter(ActionItem.status == status)
    return q.order_by(ActionItem.due_date.asc().nullslast(), ActionItem.created_at.asc()).all()


@router.post("", response_model=ActionItemOut, status_code=201)
def create_task(
    vve_id: int,
    data: ActionItemCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    task = ActionItem(vve_id=vve_id, created_by_id=current_user.id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=ActionItemOut)
def update_task(
    vve_id: int,
    task_id: int,
    data: ActionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    task = db.query(ActionItem).filter(ActionItem.id == task_id, ActionItem.vve_id == vve_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Actie niet gevonden")
    allowed_statuses = {"open", "in_progress", "done"}
    for field, value in data.model_dump(exclude_none=True).items():
        if field == "status" and value not in allowed_statuses:
            raise HTTPException(status_code=400, detail=f"Ongeldige status: {value}")
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    vve_id: int,
    task_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    task = db.query(ActionItem).filter(ActionItem.id == task_id, ActionItem.vve_id == vve_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Actie niet gevonden")
    db.delete(task)
    db.commit()
