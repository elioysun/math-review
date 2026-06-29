#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ECS_USER="${ECS_USER:-admin}"
ECS_HOST="${ECS_HOST:-47.254.252.144}"
REMOTE_ROOT="${REMOTE_ROOT:-/www/wwwroot/math-review}"
REMOTE_DIST="${REMOTE_DIST:-${REMOTE_ROOT}/dist}"
REMOTE_STAGE="${REMOTE_STAGE:-/tmp/math-review-dist}"
SERVICE_NAME="${SERVICE_NAME:-math-review}"
WEB_OWNER="${WEB_OWNER:-www:www}"
SSH_TARGET="${ECS_USER}@${ECS_HOST}"

log() {
  printf '[deploy_ecs] %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

expect_status() {
  local url="$1"
  local expected="$2"
  local status

  status="$(curl -sS -o /tmp/math-review-deploy-check.out -w '%{http_code}' --max-time 10 "$url")"
  if [ "$status" != "$expected" ]; then
    printf 'Expected %s from %s, got %s\n' "$expected" "$url" "$status" >&2
    sed -n '1,40p' /tmp/math-review-deploy-check.out >&2 || true
    exit 1
  fi
}

require_command pnpm
require_command ssh
require_command scp
require_command tar
require_command curl
require_command python3

log "building local dist"
pnpm build
python3 -m py_compile deploy/spa_static_server.py

log "uploading dist and service files to ${SSH_TARGET}"
ssh "$SSH_TARGET" "rm -rf '${REMOTE_STAGE}' && mkdir -p '${REMOTE_STAGE}'"
COPYFILE_DISABLE=1 tar -C dist -czf - . | ssh "$SSH_TARGET" "tar -xzf - -C '${REMOTE_STAGE}'"
scp deploy/spa_static_server.py deploy/math-review.service "${SSH_TARGET}:~/"

log "installing service and publishing dist"
ssh "$SSH_TARGET" \
  "REMOTE_ROOT='${REMOTE_ROOT}' REMOTE_DIST='${REMOTE_DIST}' REMOTE_STAGE='${REMOTE_STAGE}' SERVICE_NAME='${SERVICE_NAME}' WEB_OWNER='${WEB_OWNER}' bash -s" <<'REMOTE'
set -euo pipefail

expect_status() {
  local url="$1"
  local expected="$2"
  local status

  status="$(curl -sS -o /tmp/math-review-remote-check.out -w '%{http_code}' --max-time 5 "$url")"
  if [ "$status" != "$expected" ]; then
    printf 'Expected %s from %s, got %s\n' "$expected" "$url" "$status" >&2
    sed -n '1,40p' /tmp/math-review-remote-check.out >&2 || true
    exit 1
  fi
}

test -f "${REMOTE_STAGE}/index.html"
test -d "${REMOTE_STAGE}/assets"
/usr/bin/python3 -m py_compile ~/spa_static_server.py

timestamp="$(date +%Y%m%d-%H%M%S)"
REMOTE_NEXT="${REMOTE_DIST}.next.${timestamp}"
REMOTE_PREVIOUS="${REMOTE_DIST}.previous"
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  sudo cp "/etc/systemd/system/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service.bak.${timestamp}"
fi
if [ -f "${REMOTE_ROOT}/spa_static_server.py" ]; then
  sudo cp "${REMOTE_ROOT}/spa_static_server.py" "${REMOTE_ROOT}/spa_static_server.py.bak.${timestamp}"
fi

sudo mkdir -p "${REMOTE_ROOT}"
sudo rm -rf "${REMOTE_NEXT}"
sudo mkdir -p "${REMOTE_NEXT}"
tar -C "${REMOTE_STAGE}" -czf - . | sudo tar -xzf - -C "${REMOTE_NEXT}"
if [ -n "${WEB_OWNER}" ]; then
  sudo chown -R "${WEB_OWNER}" "${REMOTE_NEXT}"
fi

sudo rm -rf "${REMOTE_PREVIOUS}"
if [ -d "${REMOTE_DIST}" ]; then
  sudo mv "${REMOTE_DIST}" "${REMOTE_PREVIOUS}"
fi
sudo mv "${REMOTE_NEXT}" "${REMOTE_DIST}"

sudo cp ~/spa_static_server.py "${REMOTE_ROOT}/spa_static_server.py"
sudo chmod 755 "${REMOTE_ROOT}/spa_static_server.py"
sudo cp ~/math-review.service "/etc/systemd/system/${SERVICE_NAME}.service"
sudo chown root:root "/etc/systemd/system/${SERVICE_NAME}.service"
sudo chmod 644 "/etc/systemd/system/${SERVICE_NAME}.service"
sudo /usr/bin/python3 -m py_compile "${REMOTE_ROOT}/spa_static_server.py"

pids="$(ps -eo pid=,ppid=,args= | awk '$0 ~ /[p]ython3 -m http[.]server 80/ { if ($1 > 1) print $1; if ($2 > 1) print $2 }' | sort -un | tr '\n' ' ')"
if [ -n "${pids// }" ]; then
  printf 'Stopping unmanaged python3 -m http.server 80 process(es): %s\n' "${pids}"
  sudo kill ${pids} || true
  sleep 1
fi

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sleep 2
sudo systemctl is-active --quiet "${SERVICE_NAME}"

expect_status http://127.0.0.1/ 200
expect_status http://127.0.0.1/problems 200
expect_status http://127.0.0.1/review 200
expect_status http://127.0.0.1/assets/not-found.js 404
REMOTE

log "checking public routes"
expect_status "http://${ECS_HOST}/" 200
expect_status "http://${ECS_HOST}/problems" 200
expect_status "http://${ECS_HOST}/review" 200
expect_status "http://${ECS_HOST}/assets/not-found.js" 404

log "deployment verified"
