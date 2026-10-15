from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import get_current_user, reject_owner_param
from backend.db import get_db
from backend.schemas import TagCreate, TagOut

# 로그인 필수. 태그는 사용자별이라 내 태그만 보고 만든다.
router = APIRouter(
    prefix="/api/tags",
    tags=["tags"],
    dependencies=[Depends(get_current_user), Depends(reject_owner_param)],
)


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    rows = db.execute(
        text("SELECT id, name FROM tags WHERE owner_id = :owner ORDER BY name, id"), {"owner": user["id"]}
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("", response_model=TagOut, status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    taken = HTTPException(status_code=409, detail="이미 있는 태그입니다")
    # 이름 중복은 내 태그 안에서만 검사한다(다른 사용자가 같은 이름을 써도 된다).
    if db.execute(
        text("SELECT id FROM tags WHERE owner_id = :owner AND name = :name"), {"owner": user["id"], "name": body.name}
    ).first():
        raise taken
    try:
        result = db.execute(
            text("INSERT INTO tags (name, owner_id) VALUES (:name, :owner)"), {"name": body.name, "owner": user["id"]}
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise taken
    return {"id": result.lastrowid, "name": body.name}
