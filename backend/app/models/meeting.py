from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    meeting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str | None] = mapped_column(String(300))
    teams_url: Mapped[str | None] = mapped_column(String(1000))
    teams_meeting_id: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        Enum("planned", "in_progress", "completed", name="meeting_status_enum"),
        default="planned",
    )
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    vve: Mapped["VvE"] = relationship(back_populates="meetings")  # noqa: F821
    agenda_items: Mapped[list["AgendaItem"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    minutes: Mapped[list["MeetingMinutes"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")


class AgendaItem(Base):
    __tablename__ = "agenda_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    # None = nog niet gekoppeld aan een vergadering (in de verzamelbak)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"), index=True)
    submitted_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Opgenomen in definitieve agenda door beheerder
    is_included: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int | None] = mapped_column(Integer)

    meeting: Mapped["Meeting | None"] = relationship(back_populates="agenda_items")


class MeetingMinutes(Base):
    __tablename__ = "meeting_minutes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    content: Mapped[str | None] = mapped_column(Text)  # bewerkbare tekst
    document_path: Mapped[str | None] = mapped_column(String(500))  # geüpload bestand
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    meeting: Mapped["Meeting"] = relationship(back_populates="minutes")
