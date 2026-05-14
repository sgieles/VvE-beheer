from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.vve_access import UserVvEAccess

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ongeldige inloggegevens",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_beheerder(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("beheerder", "platform_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geen beheerdersrechten")
    return current_user


def get_current_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geen platform admin rechten")
    return current_user


def check_vve_access(vve_id: int, user: User, db: Session) -> bool:
    """Geeft True als de gebruiker toegang heeft tot deze VvE."""
    if user.role == "platform_admin":
        return True
    if user.vve_id == vve_id:
        return True
    # Controleer extra toegangen (beheerder meerdere VvE's)
    return db.query(UserVvEAccess).filter(
        UserVvEAccess.user_id == user.id,
        UserVvEAccess.vve_id == vve_id,
    ).first() is not None


def require_vve_access(vve_id: int, user: User, db: Session):
    """Gooit 403 als gebruiker geen toegang heeft tot de VvE."""
    if not check_vve_access(vve_id, user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geen toegang tot deze VvE")


def get_accessible_vve_ids(user: User, db: Session) -> list[int]:
    """Geeft alle VvE-IDs terug die de gebruiker mag zien."""
    from app.models.vve import VvE
    if user.role == "platform_admin":
        return [v.id for v in db.query(VvE.id).all()]
    ids = set()
    if user.vve_id:
        ids.add(user.vve_id)
    extra = db.query(UserVvEAccess.vve_id).filter(UserVvEAccess.user_id == user.id).all()
    ids.update(r.vve_id for r in extra)
    return list(ids)
