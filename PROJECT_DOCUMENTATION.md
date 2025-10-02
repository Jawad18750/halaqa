# Halaqa - حلقة
## Project Documentation

### Project Overview

A web application to help sheikhs test students' Quran memorization using the traditional Naqza system. The app randomly selects Thumuns (eighths) from specified Naqzas or Juz for testing during weekly Halaqa sessions.

**Source**: مصحف ليبيا برواية قالون عن نافع (Libyan Mushaf - Qalun narration from Nafi')  
**Page Reference**: Mushaf Madani numbering (604 pages)

---

## Quran Structure

### Hierarchical Organization

```
30 Juz (أجزاء)
├── 60 Hizb (أحزاب) - 2 Hizb per Juz
│   ├── 120 Quarters (أرباع) - 2 Quarters per Hizb
│   │   └── 240 Thumun (أثمان) - 2 Thumun per Quarter
│   │
│   └── 20 Naqza (نقزات) - 3 Hizb per Naqza
```

### Key Measurements
- **Juz (جزء)**: Main division, 30 total
- **Hizb (حزب)**: Half a Juz, 60 total
- **Quarter (ربع)**: Half a Hizb, 120 total  
- **Thumun (ثُمُن)**: Eighth (8 per Hizb; 2 per Quarter), 480 total
- **Naqza (نقزة)**: 3 consecutive Hizbs, 20 total (60 ÷ 3 = 20)

### Naqza System
Each Naqza covers 3 Hizbs:
- **Naqza 1**: Hizb 1, 2, 3
- **Naqza 2**: Hizb 4, 5, 6
- **Naqza 3**: Hizb 7, 8, 9
- ... and so on until Naqza 20 (Hizb 58, 59, 60)

---

## Core Features

### Phase 1: Random Selection Tool (MVP)
**Status**: To be implemented first
**Tech Stack**: React + Vite (client-side only, no backend)

#### Features:
1. **Naqza Selection**
   - Dropdown to select from 20 Naqzas
   - Optional: Single Juz selection for younger students
   
2. **Random Thumun Generator**
   - Button to generate random Thumun from selected Naqza
   - Display format:
     ```
     الثُمُن [NUMBER] من [THUMUN_NAME]
     الحزب [HIZB_NUMBER]
     صفحة [PAGE_NUMBER]
     من سورة [SURAH_NAME]
     ```

3. **Arabic RTL Interface**
   - Full Arabic language
   - Right-to-left text direction
   - Clean, simple design

4. **Thumun Display Information**
   - Thumun number (1-240)
   - Thumun name (opening words from Quran)
   - Hizb number
   - Page number (Sahifa)
   - Surah name

#### Technical Details:
- **Framework**: React 18+ with Vite
- **Styling**: CSS with RTL support (`dir="rtl"`)
- **State Management**: React hooks (useState, useEffect)
- **Data Storage**: Static JSON file with all 480 Thumuns
- **No Backend**: Purely client-side application

---

### Phase 2: Student Management System
**Status**: Future enhancement (after Phase 1 is validated)
**Tech Stack**: Node.js + Express + PostgreSQL + React

#### Features:
1. **Sheikh Authentication**
   - Login system for sheikh/teacher
   - Secure session management

2. **Student Profiles**
   - Add/edit/delete students
   - Student name, age, level
   - Photo (optional)

3. **Halaqa Tracking**
   - Record test date (weekly Saturday sessions)
   - Selected Naqza or Juz
   - Random Thumun selected
   - Mistakes count (0-3 maximum)
   - Pass/Fail status
   - Notes field

4. **History & Reports**
   - View student progress over time
   - Which Thumuns tested per student
   - Success rate statistics
   - Weak areas identification

5. **Open/Free Mode**
   - App still works without login
   - No data saved in free mode
   - Full functionality accessible

#### Database Schema (Planned):
```sql
-- Users (Sheikhs)
users
├── id (PK)
├── username
├── password_hash
├── full_name
└── created_at

-- Students
students
├── id (PK)
├── user_id (FK to users)
├── name
├── age
├── level
└── created_at

-- Halaqa Sessions
halaqa_sessions
├── id (PK)
├── student_id (FK to students)
├── session_date
├── naqza_number (1-20)
├── thumun_number (1-240)
├── mistakes_count (0-3)
├── passed (boolean)
├── notes
└── created_at
```

---

## Terminology

### Arabic Terms (العربية)
| Term | Arabic | Plural | Description |
|------|--------|--------|-------------|
| Juz | جزء | أجزاء | Main division (30 total) |
| Hizb | حزب | أحزاب | Half of Juz (60 total) |
| Quarter | ربع | أرباع | Quarter mark (120 total) |
| Thumun | ثُمُن | أثمان | Eighth mark (240 total) |
| Naqza | نقزة | نقزات | 3 Hizbs together (20 total) |
| Halaqa | حلقة | حلقات | Study circle/test session |
| Surah | سورة | سور | Chapter of Quran |
| Sahifa | صفحة | صفحات | Page number |

### English Terms
- **Sheikh**: Teacher/instructor conducting the test
- **Student**: Person being tested (طالب)
- **Mistake**: Error in recitation (خطأ)
- **Test**: Memorization assessment during Halaqa

---

## Thumun Naming Convention

Each Thumun is identified by its **opening words** from the Quran (not positional names).

### Example Format:
```
الثُمُن 1 - ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ
من سورة الفاتحة
صفحة 1
الحزب 1
النقزة 1
```

**Display Components:**
1. **Thumun Name**: First 3-5 words from where it begins (e.g., "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ")
2. **Surah Name**: Which chapter (e.g., "سورة الفاتحة")
3. **Page Number**: Mushaf page (e.g., "صفحة 1")
4. **Hizb Number**: Which Hizb (e.g., "الحزب 1")
5. **Naqza Number**: Which Naqza (e.g., "النقزة 1")

All 240 Thumun names and details are stored in: `quran-thumun-data.json`

---

## Development Phases

### Phase 1 Checklist (MVP)
- [ ] Project setup (Vite + React)
- [ ] Create `quran-thumun-data.json` with all 480 Thumuns
- [ ] Design Arabic RTL UI
- [ ] Implement Naqza selector dropdown
- [ ] Implement random Thumun generator
- [ ] Display Thumun details beautifully
- [ ] Add Juz selection option (for younger students)
- [ ] Test with real data
- [ ] Get Sheikh feedback and iterate

### Phase 2 Checklist (Future)
- [ ] Backend API setup (Node.js + Express)
- [ ] Database schema implementation (PostgreSQL)
- [ ] User authentication (Sheikh login)
- [ ] Student CRUD operations
- [ ] Halaqa session recording
- [ ] History and reports
- [ ] Deploy to production

---

## Deployment Plan

### Development (Local)
- **Location**: `/Volumes/ExtremeSSD/Projects/QuranTester/`
- **Environment**: Local machine (macOS)
- **Tools**: VS Code, Node.js, npm/yarn

### Production (Future)
- **Frontend**: Vercel or Netlify (free hosting)
- **Backend**: Your Ubuntu VPS with CyberPanel
- **Database**: PostgreSQL on VPS or Supabase (managed)
- **Domain**: Available (to be configured)
- **SSL**: Let's Encrypt (via CyberPanel)

---

## Technical Stack Summary

### Phase 1 (Current Focus)
```
Frontend:
├── React 18+
├── Vite (build tool)
├── CSS (RTL styling)
└── JSON (data storage)

No Backend Needed
```

### Phase 2 (Future)
```
Frontend:
├── React 18+
├── Vite
├── Axios (API calls)
└── React Router

Backend:
├── Node.js 18+
├── Express.js
├── PostgreSQL
├── JWT (authentication)
└── bcrypt (password hashing)
```

---

## Data Source

All Quran structural data (Thumuns, Hizbs, Naqzas) extracted from:
- **Source**: مصحف ليبيا برواية قالون عن نافع (Libyan Mushaf - Qalun narration from Nafi')
- **PDF**: `فهرس الاثمان والأحزاب والنقزات.pdf` (25 pages, 240 Thumuns)
- **Author**: مصحف الدانى (Mushaf Ad-Dani)
- **Page Reference**: Mushaf Madani (مصحف المدينة) page numbering (604 pages)
- **Images**: Exported as JPEGs in `فهرس الاثمان والأحزاب والنقزات/` folder (25 images)

---

## User Flow (Phase 1)

### Sheikh Testing Flow:
```
1. Open App
   ↓
2. Select Naqza (1-20) OR Select Juz (1-30)
   ↓
3. Click "اختر ثُمُناً عشوائياً" (Select Random Thumun)
   ↓
4. App displays:
   - Thumun name
   - Surah name
   - Page number
   - Hizb number
   ↓
5. Sheikh asks student to recite from that point
   ↓
6. Click again for new random selection
```

---

## Design Considerations

### Arabic Typography
- **Font**: Use web-safe Arabic fonts
  - Primary: `'Traditional Arabic', 'Scheherazade', 'Arial'`
  - Quranic text: Consider `'Amiri Quran', 'KFGQPC Uthmanic Script HAFS'`
- **Size**: Large, readable text (18px+ for body, 24px+ for Thumun names)
- **Line Height**: 1.8 minimum for Arabic readability

### Color Scheme (Suggested)
- **Primary**: Deep Green (#1B5E20) - Islamic tradition
- **Secondary**: Gold (#FFC107) - Mushaf aesthetic
- **Background**: Light Cream (#FFF8E1) - easy on eyes
- **Text**: Dark Gray (#212121) - high contrast
- **Accent**: Teal (#00897B) - Quranic blue

### Responsive Design
- **Desktop**: Primary target (Sheikh using laptop/desktop)
- **Tablet**: Fully supported
- **Mobile**: Supported but secondary

---

## Future Enhancements (Ideas)

### Phase 3+
- [ ] Audio recitation integration (play Thumun)
- [ ] Multiple Mushaf styles (Madani, Uthmani, etc.)
- [ ] Export reports as PDF
- [ ] WhatsApp integration for sharing results
- [ ] Multi-language support (English + Arabic)
- [ ] Offline PWA support
- [ ] Voice recognition for automatic error detection (advanced)
- [ ] Gamification for students (badges, progress bars)

---

## Contributing

This is a personal project for Sheikh's Halaqa. 

**Development Notes:**
- Keep code clean and well-commented
- Follow Arabic naming conventions for UI
- Test with real Sheikh feedback
- Prioritize simplicity and usability

---

## License

Private project - not yet open source.

---

## Contact & Support

**Project Owner**: [Your Name]  
**Sheikh**: [Sheikh's Name]  
**Halaqa**: Weekly Saturday sessions  
**Location**: [Location if relevant]

---

## Changelog

### Version 0.1.0 (Current)
- Project initialization
- Documentation created
- Data extraction from PDF
- Planning phase complete

---

**Last Updated**: September 30, 2025  
**Status**: Planning & Documentation Phase  
**Next Step**: Begin Phase 1 development

