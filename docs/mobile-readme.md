## Mobile App Context (for local agent)

This is a concise snapshot of the Halaqa product to align mobile development. It excludes server deployment details; focus is on app behavior, data model, and offline-first needs.

### Product Overview
- Purpose: Quran testing/assessment tool for sheikhs with their students.
- Core flows:
  - Students: add/edit/delete, current_naqza tracking, avatars (capture/crop).
  - Testing: pick random thumun by naqza/juz/five_hizb/quarter/half/full; record fatha prompts, hesitation, pass/fail, score.
  - History: per-student history and weekly/overview.
  - Freestyle/guest: free randomizer without auth; logged-in freestyle mirrors guest filters.
  - Backup: export/import all user data (students, sessions, avatars) for offline use.

### Data Model (for mobile SQLite)
- Users: id, username, email, token (if you support auth), created_at.
- Students: id, user_id, number (1–30), name, current_naqza, photo_uri, date_of_birth, created_at, updated_at.
- Sessions: id, student_id, attempt_at, week_start_date (Saturday start), attempt_day (sun–sat), mode (naqza|juz|five_hizb|quarter|half|full), selected_naqza, selected_juz, selected_five_hizb, selected_quran_quarter, selected_quran_half, thumun_id, surah_number, hizb, juz, naqza, fatha_prompts, taradud_count, passed, score, created_at, updated_at.
- Thumun data: seeded from `quran-thumun-data.json` (bundle it).
- Outbox (optional): for queuing WhatsApp sends.
- Meta: schema version, last backup time, build tag, etc.

### Scoring / Progression
- Pass if `fatha_prompts < 4`; score bands match the current web logic (60–100 pass, 0–59 fail).
- In the web backend, progression increments current_naqza on pass; keep parity or confirm the final rule you want for mobile.
- Week starts Saturday; derive `attempt_day` from local time; set `week_start_date` accordingly.

### Backup Format (current web)
- JSON v1 includes: user meta, students, sessions, photos (Base64 avatars 128/256/512) when `photos=1`.
- Designed for offline import: restore avatars to `/uploads/students/<id>/avatar-*.jpg` (mobile: save to FileSystem and store URI).
- For the mobile app, you can accept the same JSON and map to SQLite + file storage. Consider gzipped JSON to keep size small.

### API Surface (reference)
- Auth: /auth/register, /auth/login, /auth/me, /auth/forgot, /auth/reset.
- Students: CRUD + /students/:id/photo.
- Sessions: create, per-student history, weekly, overview, edit time, delete.
- Backup: /backup/export?photos=1, /backup/import.
- CORS allows `https://halaqa.abdeljawad.com`; mobile should call API_URL configured per env or stay offline-first.

### Offline-First Plan (mobile)
- SQLite for students/sessions/outbox/thumun_data/meta.
- FileSystem for avatars; store URIs in the student record.
- Export/import: zip or gzipped JSON + avatars; allow merge/replace; optional passphrase.
- Optional outbound-only sync: queue “send to guardian” via WhatsApp gateway when online.

### UI Parity Notes
- Keep Freestyle filters (naqza, juz, five_hizb groups of 5, quarter, half, full).
- Guest mode available without auth; logged-in users can also use freestyle.
- Arabic RTL defaults; theme toggle; font scale; high contrast.
- Version marker: include a visible build tag to identify builds.

### Build Targets (suggested)
- Expo (React Native) or your chosen stack; reuse logic for randomizer, scoring, filters, backup import/export.
- Env/config: API_URL (optional), BUILD_TAG, and feature flags for sync/on-prem.

### Next Actions for the mobile agent
- Implement SQLite schema per above; seed thumun data.
- Port scoring, week start (Saturday), and randomizer filters as in the web app.
- Add backup import/export (JSON + avatars) compatible with web v1.
- Add Freestyle filters and history/overview screens.
- Add visible build tag in UI for clarity.

