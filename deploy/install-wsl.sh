#!/usr/bin/env bash
# 백엔드(FastAPI) 설치: 커밋된 코드(HEAD)만 실행용 폴더에 복사하고 systemd 사용자 서비스를 재시작한다.
# 사용: 프로젝트 루트에서 bash deploy/install-wsl.sh   (sudo 불필요)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/today-menu-app"
UNIT_DIR="$HOME/.config/systemd/user"
SERVICE="today-menu-api.service"

cd "$REPO"
for f in backend/main.py requirements.txt deploy/systemd/user/$SERVICE; do
    git cat-file -e "HEAD:$f" 2>/dev/null || { echo "오류: $f 가 커밋(HEAD)에 없습니다. 먼저 커밋하세요." >&2; exit 1; }
done
[ -f "$REPO/.env" ] || { echo "오류: $REPO/.env 가 없습니다. .env.example 을 참고해 직접 만드세요." >&2; exit 1; }

echo "[1/4] HEAD 코드를 $APP_DIR 로 복사"
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR/backend"
git archive HEAD backend requirements.txt | tar -x -C "$APP_DIR"

echo "[2/4] 가상환경과 패키지 설치"
[ -x "$APP_DIR/.venv/bin/python" ] || python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

echo "[3/4] systemd 서비스 파일 설치"
mkdir -p "$UNIT_DIR"
git show "HEAD:deploy/systemd/user/$SERVICE" > "$UNIT_DIR/$SERVICE"
systemctl --user daemon-reload
systemctl --user enable "$SERVICE"

echo "[4/4] 서비스 재시작"
systemctl --user restart "$SERVICE"
sleep 2
systemctl --user --no-pager status "$SERVICE" | head -n 5 || true
echo "시작 실패 시: journalctl --user -u $SERVICE -n 30 --no-pager"
