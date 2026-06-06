---
name: halaqa
description: >-
  Deploy, develop, and debug the Halaqa Quran teacher platform on the VPS.
  Use when working on halaqa.abdeljawad.com, quran-tester-app, halaqa-api,
  attendance QR scanning, Telegram notifications, QR print, migrations, or
  anything under /home/deploy/halaqa_git.
---

# Halaqa Platform Skill

## Quick start

1. Edit code in `/home/deploy/halaqa_git/` (not stale copies elsewhere).
2. Rsync to `halaqa_src_current`, build with `VITE_BUILD_TAG`, rsync `dist/` to `public_html/`.
3. Run `npm run migrate` + `pm2 restart halaqa-api` if backend/DB changed.
4. Commit and push to `main` only when the user asks.

## Before any deploy

- [ ] Build succeeds (`npm run build` in quran-tester-app)
- [ ] New `VITE_BUILD_TAG` set
- [ ] `public_html` rsynced
- [ ] No secrets in git

## Domain areas

| Area | Key paths |
|------|-----------|
| QR attendance scan | `attendanceScanner.js`, `Attendance.jsx` |
| QR print | `QRPrint.jsx`, `qrAttendance.js` (`QR_FORMATS`, `QR_STICKER_SIZES`) |
| Message log | `MessageLog.jsx`, `notificationService.js`, migration `021_*` |
| Tests | `TestView.jsx`, `labels.js` |
| Telegram | `Broadcast.jsx`, `GuardiansManage.jsx`, `notificationService.js` |

## Detailed reference

Read [reference.md](reference.md) for full VPS layout, feature list, API notes, weekly attendance cron, and troubleshooting.
