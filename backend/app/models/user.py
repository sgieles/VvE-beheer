from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # platform_admin heeft geen vve_id (None)
    vve_id: Mapped[int | None] = mapped_column(ForeignKey("vves.id"), index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(
        Enum("platform_admin", "beheerder", "eigenaar", name="user_role_enum"),
        default="eigenaar",
    )
    # Aandeel in de VvE als breuk (bijv. 0.25 = 25%)
    # Kan null zijn voor beheerder zonder eigendom
    aandeel: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    # Appartementsrecht / bouwnummer voor identificatie
    appartement_nummer: Mapped[str | None] = mapped_column(String(50))
    # Adres van de woning (straat + huisnummer)
    address: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    vve: Mapped["VvE"] = relationship(back_populates="users")  # noqa: F821
