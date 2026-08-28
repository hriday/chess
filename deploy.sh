#!/usr/bin/env bash
set -euo pipefail
SERVER="${DEPLOY_SERVER:?Set DEPLOY_SERVER, e.g. root@your.server.ip}"
APP_DIR=/opt/chess/app

npm test && npm run build   # never ship a red build

rsync -az --delete \
  --exclude .git --exclude node_modules --exclude .next --exclude .env --exclude key \
  ./ "$SERVER:$APP_DIR/"

ssh "$SERVER" "
  set -e
  cd \"$APP_DIR\"
  chown -R chess:chess \"$APP_DIR\"
  systemctl stop chess
  sudo -u chess npm ci --no-audit --no-fund
  sudo -u chess bash -c 'set -a; source .env; set +a; npx drizzle-kit migrate'
  sudo -u chess npm run build
  systemctl start chess
  sleep 3
  curl -sf http://localhost:3001/ > /dev/null && echo 'DEPLOY OK' || (journalctl -u chess -n 50; exit 1)
"
