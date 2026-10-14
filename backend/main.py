from fastapi import FastAPI

app = FastAPI(title="오늘 뭐 먹지?")


@app.get("/api/health")
def health():
    return {"status": "ok"}
