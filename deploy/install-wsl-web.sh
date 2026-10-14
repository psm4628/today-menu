#!/usr/bin/env bash
# 화면과 Nginx 설치: 커밋된 코드(HEAD)의 설정과 화면 파일을 복사하고 Nginx 를 reload 한다.
# 사용: 프로젝트 루트에서 bash deploy/install-wsl-web.sh   (sudo 암호를 물을 수 있음)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="/var/www/today-menu"
CONF_NAME="today-menu.conf"
CONF_DEST="/etc/nginx/conf.d/$CONF_NAME"

cd "$REPO"
git cat-file -e "HEAD:deploy/nginx/$CONF_NAME" 2>/dev/null || { echo "오류: deploy/nginx/$CONF_NAME 가 커밋(HEAD)에 없습니다. 먼저 커밋하세요." >&2; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "[1/4] 화면 파일 준비"
if [ -n "$(git ls-tree -r --name-only HEAD frontend/dist)" ]; then
    git archive HEAD frontend/dist | tar -x -C "$STAGE"
    cp -r "$STAGE/frontend/dist/." "$STAGE/"
    rm -rf "$STAGE/frontend"
    echo "  HEAD 의 frontend/dist 사용"
elif [ -f "$REPO/frontend/dist/index.html" ]; then
    cp -r "$REPO/frontend/dist/." "$STAGE/"
    echo "  주의: 빌드 결과물이 커밋되지 않아 작업 폴더의 frontend/dist 를 사용"
else
    cat > "$STAGE/index.html" <<'HTML'
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>오늘 뭐 먹지?</title></head>
<body>
<h1>오늘 뭐 먹지?</h1>
<p>화면이 아직 빌드되지 않았습니다. (임시 안내 페이지)</p>
<p>API 상태: <a href="/api/health">/api/health</a></p>
</body>
</html>
HTML
    echo "  frontend/dist 가 없어 임시 안내 index.html 사용"
fi

echo "[2/4] $WEB_ROOT 로 복사 (sudo)"
sudo mkdir -p "$WEB_ROOT"
sudo find "$WEB_ROOT" -mindepth 1 -delete
sudo cp -r "$STAGE/." "$WEB_ROOT/"
sudo chmod -R a+rX "$WEB_ROOT"

echo "[3/4] Nginx 설정 설치 (sudo)"
git show "HEAD:deploy/nginx/$CONF_NAME" | sudo tee "$CONF_DEST" > /dev/null

echo "[4/4] 설정 검사 후 reload (sudo)"
sudo nginx -t
sudo nginx -s reload 2>/dev/null || sudo systemctl reload nginx
echo "확인: curl -i http://127.0.0.1:8081/   curl -i http://127.0.0.1:8081/api/health"
