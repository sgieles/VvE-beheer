from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Appartement(Base):
    __tablename__ = "appartementen"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    naam: Mapped[str] = mapped_column(String(200), nullable=False)
    nummer: Mapped[str | None] = mapped_column(String(20))
    eigenaar_naam: Mapped[str | None] = mapped_column(String(200))
    aandeel: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=Decimal("1"))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    vve: Mapped["VvE"] = relationship(back_populates="appartementen")  # noqa: F821
