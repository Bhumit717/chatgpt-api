#!/bin/sh
# aurora token bootstrap: materialise the credential files aurora expects.
set -e

: "${AUTHORIZATION:?AUTHORIZATION (API key) is required}"
: "${REFRESH_TOKEN:=}"
: "${SESSION_TOKEN:=}"
: "${ACCESS_TOKEN:=}"

mkdir -p /data
cd /data

[ -n "$REFRESH_TOKEN" ] && printf '%s' "$REFRESH_TOKEN" > /data/refresh_tokens.txt
[ -n "$SESSION_TOKEN" ] && printf '%s' "$SESSION_TOKEN" > /data/session_tokens.txt
[ -n "$ACCESS_TOKEN" ] && printf '%s' "$ACCESS_TOKEN" > /data/access_tokens.txt

if [ ! -f /data/refresh_tokens.txt ] && [ ! -f /data/session_tokens.txt ] && [ ! -f /data/access_tokens.txt ]; then
  echo "FATAL: no credential provided (set REFRESH_TOKEN, SESSION_TOKEN or ACCESS_TOKEN)" >&2
  exit 1
fi

chmod 600 /data/*tokens.txt 2>/dev/null || true

echo "aurora starting; credentials:"
ls -l /data | grep tokens || true

export SERVER_HOST=0.0.0.0
export SERVER_PORT="${PORT:-8080}"
export Authorization="$AUTHORIZATION"
export STREAM_MODE="${STREAM_MODE:-true}"
export ENABLE_HISTORY="${ENABLE_HISTORY:-true}"
export ENABLE_EXTERNAL_TOKEN="${ENABLE_EXTERNAL_TOKEN:-true}"

exec /usr/local/bin/aurora
