# Halaqa - حلقة

Arabic-first, phone-first platform for Sheikhs to manage students, run weekly Halaqa tests, and track progress using the Naqza/Juz system.

Source: مصحف ليبيا برواية قالون عن نافع (Libyan Mushaf — Qalun narration)

---

## 📖 What is This?

The app allows a Sheikh to manage a roster of students (numbers 1–30), run weekly tests by randomizing Thumuns from a specific Naqza or Juz, record results (Fatha prompts and Taradud), and automatically handle Naqza progression on pass. Entire UI is Arabic (RTL), mobile-first, with dark mode.

### Phase 2 Highlights
- Authentication (register/login/JWT)
- Students CRUD (name, notes, number 1–30 unique; number editable)
- Test UI (student-facing): randomize within Naqza or Juz, anti immediate repeat
- Scoring policy (Option D + bounds): pass if Fatha ≤ 3; 4th = fail; Taradud counted only; passed scores clamped 60–100; failed 0–59; grade bands
- Immediate progression on pass; Sunday fail stays same Naqza
- Per-student history + weekly overview
- Unified Arabic styling, drawer with icons, RTL, dark mode, high contrast
- Canonical labels everywhere: “n - اسم النقزة/اسم الجزء/اسم الثمن”

---

## 📚 Quran Structure Reference

```
The Quran is divided into:
├── 30 Juz (أجزاء)
│   ├── 60 Hizb (أحزاب) - 2 per Juz
│   │   ├── 120 Quarters (أرباع) - 2 per Hizb
│   │   │   └── 480 Thumun (أثمان) - 8 per Hizب (2 per Quarter)
│   │   │
│   │   └── 20 Naqza (نقزات) - 3 Hizb per Naqza
```

---

## 📁 Monorepo Layout

```
QuranTester/
├── quran-tester-app/                 # Frontend (React + Vite)
│   └── public/quran-thumun-data.json # Canonical Quran division data (480 ثمن)
└── server/                           # Backend (Node.js + Express + PostgreSQL)
    └── src/db/migrations/            # SQL migrations
```

---

## 🔧 Local Development

Prereqs: Node 20+, Docker (for Postgres), pnpm/npm, Git.

### Backend
```bash
cd server
cp .env.example .env      # Set DATABASE_URL, JWT_SECRET, PORT=4000
docker compose up -d      # start local PostgreSQL
npm i
npm run migrate           # run SQL migrations
npm run seed              # optional sample data
npm run dev               # http://localhost:4000/health
```

### Frontend
```bash
cd quran-tester-app
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm i
npm run dev               # http://localhost:5173
```

---

## 🔌 API (summary)

Base URL: `http://localhost:4000` (prod behind reverse proxy)

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET/POST/PATCH/DELETE /students`
- `POST /sessions` (record test)
- `GET /sessions/student/:id` (history)
- `GET /sessions/weekly` (current week overview)

Authentication: Bearer JWT (set in `Authorization` header).

---

## 🧠 Scoring Rules (Option D)

- Pass/fail is decided only by Fatha: pass if Fatha ≤ 3; fail if Fatha ≥ 4
- When passed: score = 100 − tiered Fatha penalty − mild hesitation penalty, clamped [60, 100]
  - Fatha penalty: 0→0, 1→10, 2→20, 3→30
  - Hesitation penalty: 1 per hesitation beyond 3, capped at 10
- When failed: score clamped to [0, 59] (severity considers Fatha beyond 4 and hesitation)
- Grade bands: ≥90 ممتاز, ≥80 جيد جدًا, ≥70 جيد, ≥60 مقبول, else راسب

---

## 🌐 Production Deployment (VPS + CyberPanel)

We now deploy both frontend (static SPA) and backend API (Node/Express + PostgreSQL). GitHub Actions builds and uploads both artifacts via rsync, runs DB migrations, and (re)starts PM2.

### 1) GitHub Secrets (Repository → Settings → Secrets and variables → Actions)

- `VPS_HOST` — your server host/IP
- `VPS_USER` — SSH user (e.g., deploy)
- `VPS_SSH_KEY` — private key (PEM) whose public part is in `~/.ssh/authorized_keys`
- `VPS_FRONT_PATH` — e.g., `/home/deploy/halaqa`
- `VPS_API_PATH` — e.g., `/home/deploy/halaqa_api`
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — strong secret
- `NODE_ENV` — `production`

### 2) One‑time VPS Prep

```bash
# Node + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g pm2

# Release layout
sudo mkdir -p /home/deploy/halaqa_releases /home/deploy/halaqa_current
sudo mkdir -p /home/deploy/halaqa_api_releases /home/deploy/halaqa_api_current
sudo chown -R deploy:deploy /home/deploy

# Web root symlink via CyberPanel docroot to .../halaqa_current
```

### 3) Reverse Proxy (example; use subdomain or `/api` prefix)

Proxy `/api` to `127.0.0.1:4000` or serve API on `api.example.com`.

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:4000/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Set frontend `.env` (`VITE_API_URL`) to the public API base (e.g., `https://halaqa.example.com/api`).

### 4) GitHub Actions Workflow

Workflow path: `.github/workflows/deploy.yml`

It:
- Builds frontend (Vite)
- Uploads `artifact_frontend` to `${VPS_FRONT_PATH}_releases/<ts>` and flips `_current`
- Uploads backend to `${VPS_API_PATH}_releases/<ts>`
- Installs backend deps, writes `.env`, runs migrations, flips `_current`
- Starts/restarts PM2 app `halaqa-api`

---

## 🧭 UI Notes

- Entirely Arabic, RTL layout, IBM Plex Sans Arabic
- Mobile‑first layout; dark mode + high contrast modes
- Off‑canvas drawer contains navigation + icons
- Long text uses smart clamping with “عرض المزيد/عرض أقل”

---

## 🗂️ Data Source

Canonical file for divisions and labels:
`quran-tester-app/public/quran-thumun-data.json` (480 ثُمُن with ids, names, surah, hizb, quarter, juz, naqza).

---

## License

Private project (© 2025). All rights reserved.

---

**Last Updated**: October 2, 2025  
**Version**: 0.2.0 (Phase 2)

