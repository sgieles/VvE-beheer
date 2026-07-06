from datetime import datetime, date
from pydantic import BaseModel


class ActionItemCreate(BaseModel):
    title: str
    description: str | None = None
    meeting_id: int | None = None
    assigned_to_id: int | None = None
    due_date: date | None = None


class ActionItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assigned_to_id: int | None = None
    due_date: date | None = None


class ActionItemOut(BaseModel):
    id: int
    vve_id: int
    meeting_id: int | None
    title: str
    description: str | None
    assigned_to_id: int | None
    due_date: date | None
    status: str
    created_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
