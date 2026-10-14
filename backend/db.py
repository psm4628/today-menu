import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class DBConfigError(RuntimeError):
    """DB 접속 설정이 .env에 없을 때 발생한다."""


def _build_url() -> URL:
    values = {k: os.getenv(k) for k in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")}
    if not all(values.values()):
        raise DBConfigError("DB 접속 설정이 없습니다")
    return URL.create(
        "mysql+pymysql",
        username=values["DB_USER"],
        password=values["DB_PASSWORD"],
        host=values["DB_HOST"],
        port=int(values["DB_PORT"]),
        database=values["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


_engine = None
_SessionLocal = None


def get_db():
    """요청마다 DB 세션을 열고 끝나면 닫는다. 엔진은 처음 쓸 때 만든다."""
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(_build_url(), pool_pre_ping=True, connect_args={"connect_timeout": 5})
        _SessionLocal = sessionmaker(bind=_engine)
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
