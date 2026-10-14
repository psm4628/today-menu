from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session


def attach_tags(db: Session, rows: list[dict]) -> list[dict]:
    """식당 행 목록에 tags(id, name 목록)를 붙인다. 태그는 식당마다 따로 묻지 않고 한 번에 모아 가져온다."""
    for row in rows:
        row["tags"] = []
    if not rows:
        return rows
    by_id = {row["id"]: row for row in rows}
    query = text(
        "SELECT rt.restaurant_id, t.id, t.name FROM restaurant_tags rt "
        "JOIN tags t ON t.id = rt.tag_id WHERE rt.restaurant_id IN :ids ORDER BY t.name, t.id"
    ).bindparams(bindparam("ids", expanding=True))
    for restaurant_id, tag_id, tag_name in db.execute(query, {"ids": list(by_id)}):
        by_id[restaurant_id]["tags"].append({"id": tag_id, "name": tag_name})
    return rows
