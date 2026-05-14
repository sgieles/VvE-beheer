from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.schemas.auth import Token
from app.schemas.users import UserMe

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username, User.is_active == True).first()
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
    return current_user
