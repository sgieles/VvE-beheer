from datetime import datetime
from pydantic import BaseModel


class MeldingCreate(BaseModel):
    title: str
    description: str | None = None
    category: str = "overig"
    urgency: str = "normaal"


class MeldingUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    assigned_to_id: int | None = None
    urgency: str | None = None


class MeldingOut(BaseModel):
    id: int
    vve_id: int
    title: str
    description: str | None
    category: str
    urgency: str
    status: str
    photo_path: str | None
    reporter_id: int
    assigned_to_id: int | None
    notes: str | None
    reported_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}
