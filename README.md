# 🏫 Sistem Absensi Santri - RFID Based

Sistem manajemen absensi santri untuk Madrasah (SMP & SMK) yang menggunakan RFID reader sebagai input. Sistem ini memproses absensi siang (13:00-16:00) dan malam (18:00-21:00) dengan caching lokal untuk performa optimal.

## 🎯 Fitur Utama

- **RFID Integration**: Integrasi dengan RFID reader USB/Serial
- **2 Shift Management**: Siang (13:00-16:00) dan Malam (18:00-21:00)
- **Smart Caching**: In-memory cache untuk santri & attendance data
- **Batch Processing**: Submit absensi setiap 3 detik (efficient)
- **Shift Auto-Detection**: Auto-detect based on time + manual override
- **Duplicate Prevention**: Prevent double check-in per shift per day
- **Monthly Data**: Auto-sync ketika berganti bulan
- **Export Features**: Export JSON data dengan filter flexible
- **Timezone Aware**: Semua operasi menggunakan timezone Asia/Jakarta

## 🏗️ Tech Stack

### Backend

- Node.js + Express.js (TypeScript)
- Supabase (PostgreSQL)
- In-Memory Cache
- Date handling: date-fns + date-fns-tz

### Frontend

- Vite + Vanilla TypeScript
- Tailwind CSS
- IndexedDB (for local cache)
- No framework (minimal dependencies)

### Infrastructure

- Monolith deployment (single VPS)
- CORS enabled
- Static file serving

## 📂 Struktur Project

```
absensi-backend/
├── src/
│   ├── backend/
│   │   ├── config/
│   │   │   ├── env.ts              # Environment variables
│   │   │   ├── constants.ts        # App-wide constants
│   │   │   ├── database.ts         # Supabase client
│   │   │   └── time.ts             # Shift configuration
│   │   ├── routes/                 # API endpoints (WIP)
│   │   ├── services/               # Business logic (WIP)
│   │   ├── jobs/                   # Cron jobs (WIP)
│   │   ├── utils/
│   │   │   ├── time.ts             # Time utilities
│   │   │   └── validators.ts       # Validation helpers
│   │   └── app.ts                  # Express app entry
│   ├── frontend/
│   │   ├── components/             # UI components (WIP)
│   │   ├── services/               # API & cache services (WIP)
│   │   ├── styles/                 # CSS/Tailwind
│   │   ├── index.html              # HTML entry
│   │   └── main.ts                 # JS entry
│   └── shared/
│       └── types.ts                # Shared TypeScript types
├── public/                         # Static assets
├── schema.sql                      # Database schema
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── .env.example
├── TODO.md                         # Development roadmap
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account + project

### Setup

1. **Clone & Install**

```bash
cd absensi-backend
npm install
```

2. **Environment Setup**

```bash
cp .env.example .env
# Edit .env dengan credentials Supabase Anda
```

3. **Database Setup**

- Buka Supabase console
- Jalankan semua SQL dari `schema.sql`
- Tables akan terbuat + seed classes

4. **Development Server**

```bash
npm run dev
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

5. **Production Build**

```bash
npm run build
npm start
```

## 📋 Konfigurasi Penting

Semua konfigurasi penting tersimpan di `src/backend/config/`:

### Environment Variables (.env)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

SHIFT_SIANG_START=13:00
SHIFT_SIANG_END=16:00
SHIFT_MALAM_START=18:00
SHIFT_MALAM_END=21:00

BATCH_SUBMIT_INTERVAL=3000
CACHE_TTL_SANTRI=43200
```

### Constants (src/backend/config/constants.ts)

- Classes definition (SMP-1 s/d SMP-3, SMK-1 s/d SMK-3)
- Shift definitions
- Error codes & messages
- Attendance status

### Time Config (src/backend/config/time.ts)

- Shift time ranges
- Timezone configuration

## 🔄 API Endpoints (Planned)

### Attendance

- `POST /api/attendance/batch` - Process RFID batch
- `GET /api/attendance/today` - Today's summary
- `GET /api/attendance/month` - Monthly data

### Data

- `GET /api/classes` - All classes
- `GET /api/attendance/export` - JSON export data

## 💾 Database Schema

### Tables

- `classes` - Kelas (SMP-1, SMK-1, etc)
- `santri` - Data santri + RFID ID
- `attendance_logs` - Absensi harian
- `attendance_logs_archive` - Data lama (>90 hari)

**Key Features:**

- Unique constraint: santri + date + shift (prevent duplicates)
- Soft indexes untuk query performance
- Automatic timestamps (created_at, updated_at)

## 🎨 Frontend RFID Flow

```
┌─────────────────┐
│  RFID Reader    │
│  (USB/Serial)   │
└────────┬────────┘
         │ Emit keyboard input
         ↓
┌─────────────────────────────────────┐
│  Shift Selector (auto + override)    │
│  ☑ Siang | ☐ Malam                 │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Batch Queue (3-sec interval)   │
│  [{rfid_id, shift, ts}, ...]   │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  API: POST /api/attendance/batch │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│  Frontend Cache + UI Update (instant)   │
│  ✓ Ahmad - SMK-1 - Siang (14:35)       │
└─────────────────────────────────────────┘
```

## 📅 Monthly Data Management

- Load data bulan saat ini saat page load
- Auto-detect bulan berdasarkan server timezone
- User bisa navigate prev/next month
- Cache otomatis update ketika bulan berubah
- Export data bisa untuk bulan lalu juga

## 🔒 Security

- Environment variables untuk sensitive data
- Service role key untuk admin operations
- CORS configured
- Input validation
- RFID ID validation

## 📖 Development Guide

Lihat `TODO.md` untuk roadmap development phase-by-phase.

### Current Status: Phase 1 ✅

- Project structure done
- Config setup done
- Database schema ready
- Shared types defined

### Next: Phase 2 🔄

- Backend cache service
- Database service layer
- Validation logic

## 📝 Notes

- **Timezone**: Semua operasi berdasarkan Asia/Jakarta
- **Cache**: In-memory saja (bisa upgrade ke Redis nanti)
- **Batch**: Submit setiap 3 detik untuk efficiency
- **Archive**: Untuk MVP cukup placeholder, implementasi fase berikutnya

## 📬 Support

Untuk issue atau pertanyaan, buat issue di repository atau hubungi tim development.

---

**Made with ❤️ for Madrasah Absensi System**
