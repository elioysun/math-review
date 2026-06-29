#!/usr/bin/env bash
set -euo pipefail

ECS_USER="${ECS_USER:-admin}"
ECS_HOST="${ECS_HOST:-47.254.252.144}"
SERVICE_NAME="${SERVICE_NAME:-math-review}"
SSH_TARGET="${ECS_USER}@${ECS_HOST}"

expect_status() {
  local url="$1"
  local expected="$2"
  local status

  status="$(curl -sS -o /tmp/math-review-verify-check.out -w '%{http_code}' --max-time 10 "$url")"
  if [ "$status" != "$expected" ]; then
    printf 'Expected %s from %s, got %s\n' "$expected" "$url" "$status" >&2
    sed -n '1,40p' /tmp/math-review-verify-check.out >&2 || true
    exit 1
  fi
}

command -v ssh >/dev/null 2>&1 || {
  printf 'Missing required command: ssh\n' >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  printf 'Missing required command: curl\n' >&2
  exit 1
}

ssh "$SSH_TARGET" "SERVICE_NAME='${SERVICE_NAME}' bash -s" <<'REMOTE'
set -euo pipefail

expect_status() {
  local url="$1"
  local expected="$2"
  local status

  status="$(curl -sS -o /tmp/math-review-verify-remote.out -w '%{http_code}' --max-time 5 "$url")"
  if [ "$status" != "$expected" ]; then
    printf 'Expected %s from %s, got %s\n' "$expected" "$url" "$status" >&2
    sed -n '1,40p' /tmp/math-review-verify-remote.out >&2 || true
    exit 1
  fi
}

systemctl is-active --quiet math-review
unit="$(systemctl cat math-review)"
printf '%s\n' "$unit" | grep -q 'spa_static_server.py'
if printf '%s\n' "$unit" | grep -q 'python3 -m http.server 80'; then
  printf 'math-review unit must not use python3 -m http.server 80\n' >&2
  exit 1
fi

if ps -eo args= | grep -q '[p]ython3 -m http.server 80'; then
  printf 'Unmanaged python3 -m http.server 80 process is running\n' >&2
  exit 1
fi

ss -ltn 'sport = :80' | grep -q ':80'
expect_status http://127.0.0.1/ 200
expect_status http://127.0.0.1/problems 200
expect_status http://127.0.0.1/review 200
expect_status http://127.0.0.1/assets/not-found.js 404
REMOTE

expect_status "http://${ECS_HOST}/" 200
expect_status "http://${ECS_HOST}/problems" 200
expect_status "http://${ECS_HOST}/review" 200
expect_status "http://${ECS_HOST}/assets/not-found.js" 404

printf 'math-review ECS verification passed\n'
