from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Melding(Base):
    """Onderhoudsmelding of klacht ingediend door een eigenaar of beheerder."""
    __tablename__ = "meldingen"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    # dak | kozijnen | gevel | installaties | gemeenschappelijk | overig
    category: Mapped[str] = mapped_column(String(50), default="overig")
    # laag | normaal | hoog | spoed
    urgency: Mapped[str] = mapped_column(String(20), default="normaal")
    # nieuw | in_behandeling | opgelost | afgesloten
    status: Mapped[str] = mapped_column(String(30), default="nieuw")
    photo_path: Mapped[str | None] = mapped_column(String(500))
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)  # interne notitie beheerder
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
