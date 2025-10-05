#!/usr/bin/env bash
set -euo pipefail
# Usage: ./bootstrap.sh <DATABASE_URL> <JWT_SECRET> [PORT=4000] [API_HOST=http://localhost:4000] [SERVE_PORT=8080]
DB_URL=${1:-}
JWT=${2:-}
PORT=${3:-4000}
API_URL=${4:-http://localhost:4000}
SERVE_PORT=${5:-8080}
if [[ -z "$DB_URL" || -z "$JWT" ]]; then
  echo "Usage: $0 <DATABASE_URL> <JWT_SECRET> [PORT] [API_HOST] [SERVE_PORT]" >&2
  exit 1
fi
# API
pushd server >/dev/null
npm install --omit=dev
cat > .env <<EONV
NODE_ENV=production
PORT=$PORT
DATABASE_URL=$DB_URL
JWT_SECRET=$JWT
THUMUN_DATA_PATH=$(pwd)/data/quran-thumun-data.json
EONV
node src/db/migrate.js
pm2 start src/index.js --name halaqa-api --update-env --cwd $(pwd) || pm2 restart halaqa-api --update-env
popd >/dev/null
# Frontend
pushd quran-tester-app >/dev/null
npm install
VITE_API_URL=$API_URL npm run build
npx serve -s dist -l $SERVE_PORT &
popd >/dev/null
echo "API: $API_URL, Frontend: http://localhost:$SERVE_PORT"
