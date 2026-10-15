from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from backend.auth import get_current_user, reject_owner_param
from backend.db import get_db
from backend.schemas import FavoriteIn, RestaurantCreate, RestaurantOut, RestaurantTagsIn
from backend.services.tags import attach_tags

# 로그인 필수. 모든 조회·수정·삭제는 로그인한 사용자의 식당만 대상으로 한다(남의 식당 id 는 404).
router = APIRouter(
    prefix="/api/restaurants",
    tags=["restaurants"],
    dependencies=[Depends(get_current_user), Depends(reject_owner_param)],
)

COLUMNS = "id, name, category, price_range, location, memo, is_favorite, status, owner_id, created_at"
NOT_FOUND = "식당을 찾을 수 없습니다"


def _get_or_404(db: Session, restaurant_id: int, owner_id: int) -> dict:
    row = db.execute(
        text(f"SELECT {COLUMNS} FROM restaurants WHERE id = :id AND owner_id = :owner"),
        {"id": restaurant_id, "owner": owner_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return attach_tags(db, [dict(row)])[0]


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(
    category: Optional[str] = Query(default=None, max_length=20),
    price_range: Optional[int] = Query(default=None, ge=1, le=3),
    status: Optional[Literal["WANT", "VISITED"]] = None,
    q: Optional[str] = Query(default=None, max_length=100),
    tag_id: Optional[int] = None,
    favorite: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    conditions = ["owner_id = :owner"]
    params: dict = {"owner": user["id"]}
    if category:
        conditions.append("category = :category")
        params["category"] = category
    if price_range is not None:
        conditions.append("price_range = :price_range")
        params["price_range"] = price_range
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if q and q.strip():
        # 검색어 안의 % _ 는 글자 그대로 찾는다.
        escaped = q.strip().replace("|", "||").replace("%", "|%").replace("_", "|_")
        conditions.append("name LIKE :q ESCAPE '|'")
        params["q"] = f"%{escaped}%"

    if tag_id is not None:
        conditions.append("id IN (SELECT restaurant_id FROM restaurant_tags WHERE tag_id = :tag_id)")
        params["tag_id"] = tag_id
    if favorite:  # true 일 때만 거른다. 안 주거나 false 면 전체
        conditions.append("is_favorite = TRUE")

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.execute(text(f"SELECT {COLUMNS} FROM restaurants{where} ORDER BY id DESC"), params).mappings().all()
    return attach_tags(db, [dict(r) for r in rows])


@router.post("", response_model=RestaurantOut, status_code=201)
def create_restaurant(body: RestaurantCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    result = db.execute(
        text(
            "INSERT INTO restaurants (name, category, price_range, location, memo, owner_id) "
            "VALUES (:name, :category, :price_range, :location, :memo, :owner)"
        ),
        {**body.model_dump(), "owner": user["id"]},  # 소유자는 요청이 아니라 로그인 사용자로 정한다
    )
    new_id = result.lastrowid
    row = db.execute(text(f"SELECT {COLUMNS} FROM restaurants WHERE id = :id"), {"id": new_id}).mappings().one()
    db.commit()
    return attach_tags(db, [dict(row)])[0]


@router.get("/{restaurant_id}", response_model=RestaurantOut)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    return _get_or_404(db, restaurant_id, user["id"])


@router.put("/{restaurant_id}", response_model=RestaurantOut)
def update_restaurant(
    restaurant_id: int, body: RestaurantCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)
):
    _get_or_404(db, restaurant_id, user["id"])
    db.execute(
        text(
            "UPDATE restaurants SET name = :name, category = :category, price_range = :price_range, "
            "location = :location, memo = :memo WHERE id = :id AND owner_id = :owner"
        ),
        {**body.model_dump(), "id": restaurant_id, "owner": user["id"]},
    )
    db.commit()
    return _get_or_404(db, restaurant_id, user["id"])


@router.delete("/{restaurant_id}", status_code=204)
def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    _get_or_404(db, restaurant_id, user["id"])
    db.execute(text("DELETE FROM restaurants WHERE id = :id AND owner_id = :owner"), {"id": restaurant_id, "owner": user["id"]})
    db.commit()
    return Response(status_code=204)


@router.put("/{restaurant_id}/tags", response_model=RestaurantOut)
def replace_restaurant_tags(
    restaurant_id: int, body: RestaurantTagsIn, db: Session = Depends(get_db), user: dict = Depends(get_current_user)
):
    _get_or_404(db, restaurant_id, user["id"])
    tag_ids = list(dict.fromkeys(body.tag_ids))  # 중복은 한 번만, 순서는 유지
    if tag_ids:
        found = db.execute(
            # 내 태그만 붙일 수 있다. 남의 태그 id 는 없는 태그와 똑같이 422 로 거절한다.
            text("SELECT id FROM tags WHERE id IN :ids AND owner_id = :owner").bindparams(bindparam("ids", expanding=True)),
            {"ids": tag_ids, "owner": user["id"]},
        ).scalars().all()
        if len(found) != len(tag_ids):
            raise HTTPException(status_code=422, detail="존재하지 않는 태그가 있습니다")
    db.execute(text("DELETE FROM restaurant_tags WHERE restaurant_id = :id"), {"id": restaurant_id})
    for tag_id in tag_ids:
        db.execute(
            text("INSERT INTO restaurant_tags (restaurant_id, tag_id) VALUES (:rid, :tid)"),
            {"rid": restaurant_id, "tid": tag_id},
        )
    db.commit()
    return _get_or_404(db, restaurant_id, user["id"])


@router.put("/{restaurant_id}/favorite", response_model=RestaurantOut)
def set_favorite(
    restaurant_id: int, body: FavoriteIn, db: Session = Depends(get_db), user: dict = Depends(get_current_user)
):
    _get_or_404(db, restaurant_id, user["id"])
    db.execute(
        text("UPDATE restaurants SET is_favorite = :fav WHERE id = :id AND owner_id = :owner"),
        {"fav": body.is_favorite, "id": restaurant_id, "owner": user["id"]},
    )
    db.commit()
    return _get_or_404(db, restaurant_id, user["id"])
