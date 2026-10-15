from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.auth import get_current_user, reject_owner_param
from backend.db import get_db
from backend.schemas import RestaurantOut
from backend.services.tags import attach_tags

# 로그인 필수. 후보는 로그인한 사용자의 식당만이다.
router = APIRouter(
    prefix="/api/recommend",
    tags=["recommend"],
    dependencies=[Depends(get_current_user), Depends(reject_owner_param)],
)

COLUMNS = "id, name, category, price_range, location, memo, is_favorite, status, owner_id, created_at"


@router.get("", response_model=RestaurantOut)
def recommend(
    category: Optional[str] = Query(default=None, max_length=20),
    price_range: Optional[int] = Query(default=None, ge=1, le=3),
    status: Optional[Literal["WANT", "VISITED"]] = None,
    tag_id: Optional[int] = None,
    favorite: Optional[bool] = None,
    exclude_id: Optional[int] = None,
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
    if tag_id is not None:
        conditions.append("id IN (SELECT restaurant_id FROM restaurant_tags WHERE tag_id = :tag_id)")
        params["tag_id"] = tag_id
    if favorite:  # true 일 때만 거른다
        conditions.append("is_favorite = TRUE")

    def pick(extra: list[str], extra_params: dict):
        where = f" WHERE {' AND '.join(conditions + extra)}" if conditions or extra else ""
        sql = f"SELECT {COLUMNS} FROM restaurants{where} ORDER BY RAND() LIMIT 1"
        return db.execute(text(sql), {**params, **extra_params}).mappings().first()

    # 직전 결과는 먼저 제외하고 뽑고, 후보가 그 식당 하나뿐이면 제외 없이 다시 뽑는다.
    row = None
    if exclude_id is not None:
        row = pick(["id <> :exclude_id"], {"exclude_id": exclude_id})
    if row is None:
        row = pick([], {})
    if row is None:
        raise HTTPException(status_code=404, detail="조건에 맞는 식당이 없습니다")
    return attach_tags(db, [dict(row)])[0]
