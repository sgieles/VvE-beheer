from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | in_progress | done
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
