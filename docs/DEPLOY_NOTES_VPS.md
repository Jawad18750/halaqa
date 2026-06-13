## Canonical Paths
- Frontend source: `/home/deploy/halaqa_src_current/quran-tester-app`
- Backend source: `/home/deploy/halaqa_src_current/server`
- Live docroot symlink: `/home/deploy/halaqa_current` → points to frontend `dist/`
- Backend symlink: `/home/deploy/halaqa_api_current` (currently points to same canonical server)
- Old source archived: `/home/deploy/halaqa_src_old_20251204`

## Frontend Build/Deploy
1) envs (inline when building):
   - `VITE_API_URL=https://api.halaqa.abdeljawad.com`
   - `VITE_BUILD_TAG=<timestamp>` (e.g., `2025-12-04T22-05Z`)
2) Commands:
   ```
   cd /home/deploy/halaqa_src_current/quran-tester-app
   VITE_API_URL=https://api.halaqa.abdeljawad.com VITE_BUILD_TAG=YYYY-MM-DDTHH-MMZ npm install
   VITE_API_URL=https://api.halaqa.abdeljawad.com VITE_BUILD_TAG=YYYY-MM-DDTHH-MMZ npm run build
   ln -sfn /home/deploy/halaqa_src_current/quran-tester-app/dist /home/deploy/halaqa_current
   ```
3) Bundle shows build tag in bottom-left (`الإصدار: <tag>`).

## Backend Start/Deploy
1) `.env` in `/home/deploy/halaqa_src_current/server/.env`:
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=postgres://halaqa_app:...@127.0.0.1:5432/halaqa_prod
   JWT_SECRET=...
   ```
2) Install deps:
   ```
   cd /home/deploy/halaqa_src_current/server
   npm install --omit=dev
   ```
3) Start with PM2:
   ```
   pm2 start src/index.js --name halaqa-api --update-env
   pm2 save
   ```
4) Health check: `curl http://localhost:4000/health` → `{"ok":true,"db":true}`

## Backup Feature
- Routes (auth required):
  - `GET /backup/export?photos=1` (responds gzipped JSON; includes students, sessions, photos Base64)
  - `POST /backup/import` (accepts same JSON; restores avatars to `/uploads/students/<id>/avatar-*.jpg`)
- Default export includes photos; set `photos=0` to skip (payload smaller).
- Import upserts students/sessions for the current user only.

## Caching
- `index.html` contains no-cache headers; if UI looks stale, hard refresh or incognito.

## PM2
- Saved config at `/root/.pm2/dump.pm2` via `pm2 save`.
- If reboot: `pm2 resurrect` (or `pm2 startup` if needed).

## Weekly Attendance Telegram
- Weekly parent attendance summaries are sent by script, not by the API process itself.
- Cron (installed): Saturday 20:00 Africa/Tripoli — summarizes the **previous** halaqa week (Sat→Fri), not the week in progress.
- Manual run:
  ```
  cd /home/deploy/halaqa_src_current/server
  npm run attendance:weekly
  ```
- Optional scoped run:
  ```
  npm run attendance:weekly -- --username=sheikh
  npm run attendance:weekly -- --from=YYYY-MM-DD --to=YYYY-MM-DD
  ```
- Cron example (this VPS runs in UTC; Tripoli is UTC+2, so use 18:00 UTC for 20:00 Tripoli):
  ```
  0 18 * * 6 cd /home/deploy/halaqa_src_current/server && /usr/bin/npm run attendance:weekly >> /var/log/halaqa-attendance-weekly.log 2>&1
  ```
- Messages are sent only for student/guardian links with `notify_weekly_attendance = true`, and still respect Telegram opt-out.

## Logs
- PM2 logs: `/root/.pm2/logs/halaqa-api-out.log` and `...-error.log`
- Quick tail: `pm2 logs halaqa-api --lines 100`

## Known Good Releases (reference)
- Frontend canonical: `/home/deploy/halaqa_src_current/quran-tester-app/dist` (current)
- Backend canonical: `/home/deploy/halaqa_src_current/server` (current)
