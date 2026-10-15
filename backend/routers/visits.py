from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.auth import get_current_user, reject_owner_param
from backend.db import get_db
from backend.schemas import VisitCreate, VisitOut

# 로그인 필수. 내 식당의 방문 기록만 다룬다(남의 식당은 404).
router = APIRouter(
    prefix="/api/restaurants",
    tags=["visits"],
    dependencies=[Depends(get_current_user), Depends(reject_owner_param)],
)

NOT_FOUND = "식당을 찾을 수 없습니다"
VISIT_COLUMNS = "id, restaurant_id, visited_at, rating, comment"


def _ensure_restaurant(db: Session, restaurant_id: int, owner_id: int) -> None:
    found = db.execute(
        text("SELECT id FROM restaurants WHERE id = :id AND owner_id = :owner"), {"id": restaurant_id, "owner": owner_id}
    ).first()
    if found is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)


@router.post("/{restaurant_id}/visits", response_model=VisitOut, status_code=201)
def create_visit(
    restaurant_id: int, body: VisitCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)
):
    _ensure_restaurant(db, restaurant_id, user["id"])
    # 방문 기록 추가와 식당 상태 변경은 한 트랜잭션이다. 중간에 실패하면 둘 다 반영되지 않는다.
    try:
        result = db.execute(
            text(
                "INSERT INTO visits (restaurant_id, visited_at, rating, comment) "
                "VALUES (:restaurant_id, :visited_at, :rating, :comment)"
            ),
            {"restaurant_id": restaurant_id, **body.model_dump()},
        )
        db.execute(text("UPDATE restaurants SET status = 'VISITED' WHERE id = :id"), {"id": restaurant_id})
        row = db.execute(
            text(f"SELECT {VISIT_COLUMNS} FROM visits WHERE id = :id"), {"id": result.lastrowid}
        ).mappings().one()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return dict(row)


@router.get("/{restaurant_id}/visits", response_model=list[VisitOut])
def list_visits(restaurant_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    _ensure_restaurant(db, restaurant_id, user["id"])
    rows = db.execute(
        text(f"SELECT {VISIT_COLUMNS} FROM visits WHERE restaurant_id = :id ORDER BY visited_at DESC, id DESC"),
        {"id": restaurant_id},
    ).mappings().all()
    return [dict(r) for r in rows]
