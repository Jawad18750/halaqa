# Halaqa - حلقة

> A web application for sheikhs to test students' Quran memorization using the Naqza system during weekly Halaqa sessions.
> 
> **Source**: مصحف ليبيا برواية قالون عن نافع (Libyan Mushaf - Qalun narration from Nafi')

---

## 📖 What is This?

This app helps **sheikhs/teachers** randomly select **Thumuns** (eighths) from specified **Naqzas** to test students' Quran memorization. Each **Naqza** consists of 3 **Hizbs**, making it easier to organize testing for different student levels.

### Key Features
✅ Random Thumun selection from any Naqza (1-20)  
✅ Option to select single Juz for younger students  
✅ Full Arabic interface with RTL support  
✅ Display Thumun name, Surah, page number, and Hizb  
✅ Simple, clean, distraction-free design  
✅ Future: Student tracking and progress management  

---

## 📚 Quran Structure Reference

```
The Quran is divided into:
├── 30 Juz (أجزاء)
│   ├── 60 Hizb (أحزاب) - 2 per Juz
│   │   ├── 120 Quarters (أرباع) - 2 per Hizb
│   │   │   └── 480 Thumun (أثمان) - 8 per Hizb (2 per Quarter)
│   │   │
│   │   └── 20 Naqza (نقزات) - 3 Hizb per Naqza
```

**Example:**
- **Naqza 1** = Hizb 1, 2, 3 (Juz 1-2)
- **Naqza 2** = Hizb 4, 5, 6 (Juz 2-3)
- ... and so on

---

## 🚀 Getting Started

### Current Status: **Planning & Documentation Phase**

We have completed:
1. ✅ Project documentation
2. ✅ Data structure design
3. ✅ PDF extraction (25 pages of Thumun divisions)
4. ✅ Comprehensive planning

### Next Steps:

**Phase 1:** Build the core random selection tool  
**Phase 2:** Add student tracking and management

---

## 📁 Project Structure

```
QuranTester/
├── README.md                          # This file
├── PROJECT_DOCUMENTATION.md           # Complete project specs
├── THUMUN_DATA_SUMMARY.md            # Data extraction reference
├── quran-thumun-data.json            # Quran divisions data (in progress)
├── فهرس الاثمان والأحزاب والنقزات.pdf # Source PDF
└── فهرس الاثمان والأحزاب والنقزات/   # Exported JPEG images
    ├── ...Page_01.jpg
    ├── ...Page_02.jpg
    └── ... (25 pages total)
```

---

## 🛠️ Tech Stack

### Phase 1 (MVP)
- **Frontend**: React 18+ with Vite
- **Styling**: CSS with RTL support
- **Data**: Static JSON file
- **Deployment**: Vercel/Netlify (free hosting)

### Phase 2 (Future)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT authentication
- **Hosting**: Your Ubuntu VPS with CyberPanel

---

## 📝 Documentation Files

### 1. **PROJECT_DOCUMENTATION.md**
Complete technical specifications including:
- Full Quran structure breakdown
- Phase 1 & 2 feature lists
- Database schema (future)
- UI/UX guidelines
- Deployment plan

### 2. **THUMUN_DATA_SUMMARY.md**
Data reference guide including:
- All 20 Naqza distributions (24 thumuns per Naqza; total 480)
- Surah coverage details
- Sample Thumun data
- Data extraction status
- Quality checklist

### 3. **quran-thumun-data.json**
JSON data file containing all 480 Thumuns with:
- Thumun names (Arabic opening words)
- Surah names and numbers
- Page numbers (Mushaf Madani)
- Hizb, Juz, and Naqza assignments

---

## 🎯 How It Will Work (Phase 1)

### User Flow:
```
1. Sheikh opens the app
   ↓
2. Selects Naqza (1-20) or Juz (1-30)
   ↓
3. Clicks "اختر ثُمُناً عشوائياً" (Random Thumun)
   ↓
4. App displays:
   - الثُمُن الأول من [THUMUN_NAME]
   - من سورة [SURAH_NAME]
   - صفحة [PAGE_NUMBER]
   - الحزب [HIZB_NUMBER]
   ↓
5. Sheikh asks student to recite from that point
   ↓
6. Click again for another random selection
```

---

## 🔮 Future Features (Phase 2)

Once Phase 1 is validated, we'll add:

- 👤 **Student Profiles**: Add/manage students
- 📊 **Halaqa Tracking**: Record test sessions
- 📈 **Progress Reports**: View student history
- ✅ **Mistake Tracking**: Max 3 mistakes per test
- 🔐 **Sheikh Login**: Secure authentication
- 📱 **Free Mode**: Works without login

---

## 📋 Current Tasks

### Immediate (Before Building):
- [ ] Complete extraction of all 480 Thumuns to JSON
- [ ] Verify data accuracy with Mushaf Madani
- [ ] Review UI/UX design with Sheikh

### Phase 1 Development:
- [ ] Initialize React + Vite project
- [ ] Create Arabic RTL layout
- [ ] Build Naqza/Juz selector
- [ ] Implement random selection logic
- [ ] Design Thumun display card
- [ ] Test with real data
- [ ] Deploy to production

---

## 🤝 Data Extraction Help Needed

**Current Status**: 60/480 Thumuns extracted

We need to complete the `quran-thumun-data.json` file with all 240 Thumuns.

**Options:**
1. **Manual Entry**: Most accurate, ~8-10 hours
2. **OCR Tool**: Faster but needs verification, ~4-6 hours  
3. **API Integration**: Use existing Quran API, ~2-3 hours

See `THUMUN_DATA_SUMMARY.md` for detailed guidance.

---

## 🎨 Design Principles

1. **Arabic-First**: Everything in Arabic, RTL layout
2. **Simplicity**: Clean, distraction-free interface
3. **Accessibility**: Large text, high contrast
4. **Speed**: Fast random selection, no delays
5. **Offline-Ready**: Works without internet (Phase 1)

---

## 📱 Target Devices

- **Primary**: Desktop/Laptop (Sheikh's main device)
- **Secondary**: Tablet (iPad, Android tablets)
- **Supported**: Mobile phones

---

## 🌐 Deployment

### Phase 1 (No Backend)
- **Frontend**: Vercel or Netlify (free)
- **Domain**: Your available domain
- **SSL**: Automatic via hosting provider

### Phase 2 (With Backend)
- **Frontend**: Vercel/Netlify
- **Backend**: Your Ubuntu VPS with CyberPanel
- **Database**: PostgreSQL on VPS or managed (Supabase)
- **SSL**: Let's Encrypt via CyberPanel

---

## 🔧 Development Setup (Future)

```bash
# Clone repository
git clone <your-repo-url>
cd QuranTester

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📖 Terminology Guide

| Arabic | English | Count | Description |
|--------|---------|-------|-------------|
| جزء | Juz | 30 | Main division |
| حزب | Hizb | 60 | Half a Juz |
| ربع | Quarter | 120 | Quarter mark |
| ثُمُن | Thumun | 480 | Eighth mark |
| نقزة | Naqza | 20 | Three Hizbs |
| حلقة | Halaqa | - | Study circle/test session |
| سورة | Surah | 114 | Quran chapter |
| صفحة | Sahifa/Page | 604 | Mushaf page |

---

## 🤲 Purpose

This app is built to:
- ✅ Make Quran memorization testing easier for teachers
- ✅ Ensure fair, random selection of test portions
- ✅ Track student progress over time
- ✅ Support traditional Halaqa teaching methods
- ✅ Preserve the Naqza system of Quran division

---

## 📞 Contact

**Project**: Halaqa - حلقة  
**Purpose**: Sheikh's weekly Halaqa testing  
**Schedule**: Every Saturday  
**Source**: مصحف ليبيا برواية قالون عن نافع  
**Status**: Data Extraction In Progress (60/480 Thumuns completed)

---

## 📄 License

Private project - not yet open source.

---

## 🎯 Next Action

👉 **Before we start building:**

Please review:
1. `PROJECT_DOCUMENTATION.md` - Full specifications
2. `THUMUN_DATA_SUMMARY.md` - Data reference
3. Confirm the design approach matches your Sheikh's needs

Then we'll proceed with:
1. Completing the Thumun data extraction
2. Building the Phase 1 MVP
3. Testing with real users

---

**Last Updated**: September 30, 2025  
**Version**: 0.1.0 (Planning Phase)  
**Ready to Build**: Pending data completion and review

---

بارك الله فيك (May Allah bless you)

