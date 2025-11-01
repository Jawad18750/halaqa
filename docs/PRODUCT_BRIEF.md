# Product Brief — QuranTester

## Project Overview
QuranTester is a bilingual (Arabic-first) platform that enables Qur’an teachers to manage students, run weekly memorization tests, and track progress using the naqza system. The solution combines a responsive React frontend and an Express/PostgreSQL backend, delivering detailed reporting, exports, and secure authentication flows.

## Target Audience
- Primary: Qur’an teachers (e.g., Sheikh Abdulrahman Al-Gharyani) who conduct regular memorization sessions.
- Secondary: Administrative helpers who assist in managing student data and reviewing performance.

## Primary Benefits & Features
- Student management with profile photos, birth dates, and naqza tracking.
- Randomized testing flows (naqza, juz’, five ahzab, quarter, half, full Qur’an) with guest mode.
- Automatic grading based on fatha count (<4 pass, ≥4 fail) plus descriptive score labels.
- Detailed history and date-range overview with inline time edits (≤30 days).
- PDF/Excel exports using `public/quran.png`, showing thumun as “id - name” and naqza.
- Email/username sign-in, password reset via email, JWT-protected APIs.
- Mobile-first UI with consistent card widths, centered free-mode controls, and overflow guards.

## High-Level Tech & Architecture
- Frontend: React 18 + Vite, Zustand state, i18n helpers, `react-easy-crop` for avatars, custom PDF/Excel exporters.
- Backend: Node.js (Express), PostgreSQL with SQL migrations, JWT auth, bcrypt, Nodemailer, multer (memory) + sharp for image processing.
- Infrastructure: Dockerized Postgres for local dev, static student uploads served with caching, PM2 for production runtime, manual/VPS deployment package alongside GitHub Actions.

