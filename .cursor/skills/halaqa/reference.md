# Halaqa — Full Reference

## Product

**Halaqa (حلقة)** — Quran circle management for teachers (Sheikhs). Students, randomized memorization tests (نقزة/جزء/أحزاب), session logging, weekly dashboards, guardian Telegram messaging, QR attendance.

- **Live:** https://halaqa.abdeljawad.com
- **API:** https://api.halaqa.abdeljawad.com
- **GitHub:** github.com:Jawad18750/halaqa.git (branch `main`)
- **Owner:** Abdeljawad Elmiladi (Jawad18750)

Methodology envisioned by Sheikh Abdulrahman Al-Ghiryani (Jamia al-Shabsh, Tripoli, Libya).

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, Vite 7, plain CSS (`index.css`), RTL Arabic |
| Backend | Node.js + Express, PostgreSQL |
| Auth | JWT |
| Process | PM2 `halaqa-api` port 4000 |
| Notifications | Telegram bot |
| QR print | `qrcode` npm package |
| QR scan | `attendanceScanner.js` — BarcodeDetector + jsQR + ZXing |

---

## VPS layout

| Path | Purpose |
|------|---------|
| `/home/deploy/halaqa_git/` | Git repo — source of truth for commits |
| `/home/deploy/halaqa_src_current/quran-tester-app/` | Production frontend source |
| `/home/deploy/halaqa_src_current/server/` | Production backend source |
| `/home/deploy/halaqa_current` | Symlink → `dist/` |
| `/home/halaqa.abdeljawad.com/public_html/` | Live static site |
| `/home/deploy/halaqa_api_current` | Backend symlink |
| `/home/deploy/halaqa_uploads` | Student photos |

**PM2:** `halaqa-api` · **Health:** `curl http://localhost:4000/health`

---

## Deploy workflow

### Frontend

```bash
SRC=/home/deploy/halaqa_git
DST=/home/deploy/halaqa_src_current
BUILD_TAG=$(date -u +%Y-%m-%dT%H-%MZ)

rsync -a --exclude node_modules --exclude dist --exclude .DS_Store \
  "$SRC/quran-tester-app/" "$DST/quran-tester-app/"

cd "$DST/quran-tester-app"
VITE_API_URL=https://api.halaqa.abdeljawad.com \
VITE_BUILD_TAG="$BUILD_TAG" npm run build

ln -sfn "$DST/quran-tester-app/dist" /home/deploy/halaqa_current
rsync -a --delete "$DST/quran-tester-app/dist/" /home/halaqa.abdeljawad.com/public_html/
cp "$DST/quran-tester-app/public/.htaccess" /home/halaqa.abdeljawad.com/public_html/.htaccess 2>/dev/null || true
```

Cache bust: `VITE_BUILD_TAG` → `appVersion.js` + meta in `index.html`. Footer shows `الإصدار: <tag>`.

### Backend

```bash
rsync -a --exclude node_modules --exclude .env --exclude uploads \
  "$SRC/server/" "$DST/server/"
cd "$DST/server" && npm install --omit=dev && npm run migrate
pm2 restart halaqa-api --update-env
```

`.env` lives in `server/.env` (never commit): `DATABASE_URL`, `JWT_SECRET`, `PORT=4000`, Telegram tokens, etc.

---

## Frontend views (`App.jsx`)

| View id | Component | Notes |
|---------|-----------|-------|
| dashboard | Dashboard | Home |
| students | Students / StudentProfile | |
| test | TestView | Use `formatQalamOrdinal` from labels.js |
| attendance | Attendance | QR scan + manual |
| attendanceLog | AttendanceOverview | |
| qrcodes | QRPrint | Print stickers |
| guardians | GuardiansManage | Telegram linking |
| broadcast | Broadcast | Send messages |
| messageLog | MessageLog | سجل الرسائل |
| backup | Backup | Import/export |
| settings | Settings | Halaqa name, sheikh, masjid |
| freestyle | FreestyleRandomizer | |
| weekly / leaderboard | WeeklyOverview / WeeklyLeaderboard | |

Nav: `Drawer.jsx`. API: `src/api.js`.

---

## QR attendance

1. Each student has `qr_token` (32-char hex).
2. Teacher prints via `QRPrint.jsx`.
3. Scans in `Attendance.jsx` via `startAttendanceScanner()`.

**Scanner fix:** Must use `attendanceScanner.js` (not raw ZXing video callback). Native apps work on small stickers because they crop+zoom; our scanner does the same with `ImageBitmap` crops.

**Print formats** (`qrAttendance.js` → `QR_FORMATS`):
- `grid` — A4 dense grids (5×4, 4×3, 3×3, 2×2)
- `large` — bigger stickers (3×3, 2×2)
- `custom` — student scope + `QR_STICKER_SIZES` (35–90mm) + 1/page, 2×2, 3×3

**Student scope** (all formats): `QR_STUDENT_SCOPES` — all / selected / one.

Stickers are content-sized (border hugs QR + label, not full grid cell height).

---

## Backend highlights

- `server/src/routes/` — auth, students, sessions, attendance, notifications, backup
- `server/src/lib/notificationService.js` — Telegram send + notification log (message_body, batch_id)
- Migrations through `021_notification_log_enhancements.sql`
- Backup: `GET /backup/export`, `POST /backup/import`
- Weekly attendance Telegram: Saturday 20:00 Tripoli — `npm run attendance:weekly`

---

## Conventions

- Arabic RTL; digits: `ar-EG-u-nu-latn`
- Primary device: Samsung A50 Android Chrome
- Small focused diffs; match existing style
- Git commit/push only when user asks
- Never commit `.env`, credentials, uploads
- TestView: import `formatQalamOrdinal` — never bare `QALAM_ORDINALS`

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Stale UI | Hard refresh; verify `VITE_BUILD_TAG` in index.html |
| QR won't scan | `Attendance.jsx` imports `startAttendanceScanner`; BarcodeDetector path on Chrome Android |
| Test screen crash | Missing import from `labels.js` |
| Build fail | Syntax in JSX; run `npm run build` before deploy |
| DB errors | `npm run migrate` on server |

---

## Logs

```bash
pm2 logs halaqa-api --lines 100
```

Docs: `docs/DEPLOY_NOTES_VPS.md`
