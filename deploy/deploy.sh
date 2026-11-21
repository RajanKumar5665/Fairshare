#!/usr/bin/env bash
# Runs ON the EC2 server for every deploy (called by GitHub Actions).
# Expects the release to be unpacked already in /var/www/fairshare/releases/<id>/
#   backend/  frontend-dist/  deploy/
# Usage: bash deploy.sh <release-id>
set -euo pipefail

RELEASE_ID="${1:?release id required}"
APP_DIR=/var/www/fairshare
RELEASE="$APP_DIR/releases/$RELEASE_ID"
ENV_FILE="$APP_DIR/shared/backend.env"
KEEP=5

[ -d "$RELEASE/backend" ] || { echo "Release $RELEASE not found"; exit 1; }
if [ ! -s "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE is empty. Fill in the production secrets first (see DEPLOY.md)."
  exit 1
fi

echo "==> Installing backend dependencies"
cd "$RELEASE/backend"
ln -sfn "$ENV_FILE" .env
npm ci --omit=dev --no-audit --no-fund

PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

echo "==> Switching to release $RELEASE_ID"
ln -sfn "$RELEASE" "$APP_DIR/current.tmp"
mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"

pm2 startOrReload "$RELEASE/deploy/ecosystem.config.cjs" --update-env
pm2 save >/dev/null

echo "==> Health check"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null; then
    echo "API is healthy ✓"
    # Keep only the newest releases
    ls -1dt "$APP_DIR"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

echo "!! API did not become healthy. Last log lines:"
pm2 logs fairshare-api --lines 40 --nostream || true
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$RELEASE" ]; then
  echo "==> Rolling back to $PREVIOUS"
  ln -sfn "$PREVIOUS" "$APP_DIR/current.tmp"
  mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
  pm2 startOrReload "$PREVIOUS/deploy/ecosystem.config.cjs" --update-env
  pm2 save >/dev/null
fi
exit 1
