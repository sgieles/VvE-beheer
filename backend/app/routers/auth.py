from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.schemas.auth import Token
from app.schemas.users import UserMe

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == form_data.username) | (User.username == form_data.username),
        User.is_active == True,
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Onjuiste gebruikersnaam of wachtwoord",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.id), "vve_id": user.vve_id, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserMe)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.refresh(current_user)
    _ = current_user.vve  # force eager load van de relatie
    return current_user


@router.patch("/me", response_model=UserMe)
def update_me(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.email is not None:
        conflict = db.query(User).filter(
            User.email == data.email, User.id != current_user.id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="E-mailadres al in gebruik")
        current_user.email = str(data.email)
    if data.full_name is not None:
        current_user.full_name = data.full_name
    db.commit()
    db.refresh(current_user)
    _ = current_user.vve
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Huidig wachtwoord onjuist")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Nieuw wachtwoord moet minimaal 8 tekens zijn")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
