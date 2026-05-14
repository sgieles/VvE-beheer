from datetime import datetime
from pydantic import BaseModel


class MeetingCreate(BaseModel):
    title: str
    meeting_date: datetime
    location: str | None = None


class MeetingOut(BaseModel):
    id: int
    vve_id: int
    title: str
    meeting_date: datetime
    location: str | None
    teams_url: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgendaItemCreate(BaseModel):
    title: str
    description: str | None = None


class AgendaItemOut(BaseModel):
    id: int
    vve_id: int
    meeting_id: int | None
    submitted_by_id: int
    title: str
    description: str | None
    submitted_at: datetime
    is_included: bool
    order_index: int | None

    model_config = {"from_attributes": True}


class AgendaItemOrder(BaseModel):
    item_ids: list[int]  # volgorde bepaalt order_index


class MinutesCreate(BaseModel):
    content: str | None = None


class MinutesOut(BaseModel):
    id: int
    vve_id: int
    meeting_id: int
    content: str | None
    document_path: str | None
    uploaded_at: datetime
    uploaded_by_id: int
    is_approved: bool
    approved_at: datetime | None
    approved_by_id: int | None

    model_config = {"from_attributes": True}
