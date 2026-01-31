# Halaqa (حلقة) — Quran Testing & Management Platform

**Halaqa** is an open-source platform designed to empower Quran teachers (Sheikhs) to manage their students and conduct weekly memorization tests with ease. It follows a structured system of **"Nafzats"** and **"Ajza"** (Portions), providing a historical record for every student and a comprehensive weekly dashboard.

The platform is fully localized in Arabic and follows a **Mobile-First** design approach to suit the needs of teachers during active sessions.

🌍 **Live Demo:** [halaqa.abdeljawad.com](https://halaqa.abdeljawad.com/)

---

## 💡 Concept & Vision

The core methodology and logic of this platform were envisioned by **Sheikh Abdulrahman Al-Ghiryani** at the *Jamia al-Shabsh* school (Tripoli, Libya). His goal was to modernize the traditional "pen and paper" tracking system into a digital tool that preserves the student's progress and ensures fair, randomized testing.

Developed by **Abdeljawad Elmiladi**.

---

## ✨ Key Features

* **Teacher Accounts:** Secure registration and login (Username/Email) using JWT.
* **Student Management:** Profiles including unique IDs, names, birth dates, and photos.
* **Progress Tracking:** Each student has a "Nafza" (current level) that automatically decreases upon passing tests.
* **Dynamic Randomized Testing:**
* Test based on current **Nafza** (default).
* Test based on a specific **Juz** (Part).
* Test across 5 Ahzab, 1/4 Quran, 1/2 Quran, or the full Quran.
* **Smart Randomization:** Ensures the same *Thumun* (1/8th of a Hizb) is not repeated consecutively.


* **Detailed Session Logging:** Records the selected *Thumun*, number of *Fathas* (prompts), *Taraddud* (hesitations), pass/fail status, numerical grade, and timestamp.
* **Historical Records:** Editable session logs (within 30 days) and a chronological view of all attempts.
* **Reporting:** Export progress and reports to **PDF** and **Excel**.
* **Guest Mode:** Perform tests without needing an account.

---

## 📏 Testing Logic & Grading

The system reflects real-world *Halaqa* rules:

* **Fatha (Prompts):** Up to 3 prompts allowed. On the 4th, the student fails the test automatically.
* **Taraddud (Hesitation):** Tracked for progress monitoring but does not cause failure.
* **Grading Scale:**
* **Pass:** Score between 60–100 (weighted by prompts and hesitations).
* **Fail:** Score below 60.


* **Rankings:** Excellent (ممتاز), Very Good, Good, Pass, Weak.
* **Weekly Progression:** A successful test results in a `-1` reduction to the current Nafza. If a student fails on the primary testing day (Sunday), they remain at the same level for the following week.

---

## 🏗️ Project Structure

```text
QuranTester/
├─ quran-tester-app/         # Frontend (React 18 + Vite)
│  ├─ src/components/        # UI Components (Auth, Students, TestView, etc.)
│  └─ public/                # Static assets & quran-thumun-data.json (480 entries)
├─ server/                   # Backend (Node.js + Express + PostgreSQL)
│  ├─ src/routes/            # API Endpoints (Auth, Students, Sessions)
│  ├─ src/db/migrations/     # SQL Database Migrations
│  └─ src/uploads/           # Student Profile Pictures
└─ deployment/               # Manual deployment package scripts

```

---

## 🚀 Local Setup

### Prerequisites

* **Node.js 20+**
* **PostgreSQL 13+**
* **Docker** (Recommended for running Postgres)

### Backend Configuration

```bash
cd server
cp .env.example .env      # Configure DATABASE_URL, JWT_SECRET, PORT, and SMTP
docker compose up -d      # Start local PostgreSQL
npm install
npm run migrate           # Run database migrations
npm run seed              # Optional: Seed dummy data
npm run dev               # Starts server at http://localhost:4000

```

### Frontend Configuration

```bash
cd quran-tester-app
cp .env.example .env      # Set VITE_API_URL=http://localhost:4000
npm install
npm run dev               # Starts UI at http://localhost:5173

```

---

## 🔒 Security & Data Integrity

* **Multi-tenancy:** Data is isolated; each teacher can only see and manage their own students.
* **Privacy:** Student photos are stored locally in a protected `/uploads` directory.
* **Authentication:** All requests (excluding Login/Guest) require a valid JWT in the Authorization header.

---

## 🛠️ Contribution

As an open-source project, contributions are highly welcome!

1. **Open an Issue:** Describe the bug or the feature you'd like to suggest.
2. **Submit a Pull Request:** After testing your changes locally, submit a PR for review.

---

## 📜 License

This project is open-source. You are free to use and modify it, provided that credit is given to the original source.

---

## 🙏 Acknowledgments & Prayers

This system was born from the vision of **Sheikh Abdulrahman Al-Ghiryani**. I ask Allah to accept this work and make it a source of benefit for the Quran community.

Please keep me, my parents, and my family in your prayers.
