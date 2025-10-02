# Halaqa Server (Phase 2)

## Local Development

1) Environment
```bash
cd server
cp .env.example .env
```

2) Database (Docker Postgres 16)
```bash
docker compose up -d
```

3) Install & Migrate & Seed
```bash
npm install
npm run migrate
npm run seed
```

4) Run API
```bash
npm run dev
# Server: http://localhost:${PORT:-4000}
# Health: GET /health
```

## Endpoints
- POST /auth/register { username, password }
- POST /auth/login { username, password }
- GET  /auth/me (Bearer token)
- GET  /students
- POST /students { number(1-30), name, notes }
- PATCH /students/:id { number?, name?, notes?, current_naqza? }
- DELETE /students/:id
- POST /sessions { studentId, attemptDay('sat'|'sun'), mode('naqza'|'juz'), selectedNaqza?, selectedJuz?, thumunId, fathaPrompts, taradudCount, passed, score }
- GET  /sessions/student/:id
- GET  /sessions/weekly

## Frontend Setup
```bash
cd ../quran-tester-app
cp .env.example .env # ensure VITE_API_URL points to your server
npm install
npm run dev
```

## Notes
- Canonical data loaded from `quran-tester-app/public/quran-thumun-data.json`.
- Progression: first pass in a week (Sat/Sun) decrements `current_naqza` once.
