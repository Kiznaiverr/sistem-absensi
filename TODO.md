# Absensi System - Development Roadmap

## Phase 1: Foundation Setup

- [x] Project initialization & monolith structure
- [x] TypeScript configuration
- [x] Environment configuration (env.ts, constants.ts)
- [x] Database schema (Supabase)
- [x] Shared types between backend & frontend
- [x] Vite + Tailwind CSS setup

## Phase 2: Backend Core Services

- [x] In-memory cache service (Santri + Attendance)
- [x] Database service layer (CRUD operations)
- [x] Attendance validation logic (shift detection, duplicate check)
- [x] Shift auto-detect + manual override logic
- [x] Timezone handling (Asia/Jakarta)
- [x] Error handling & logging utilities

## Phase 3: Backend API Endpoints

- [x] `POST /api/attendance/batch` - Process batch RFID scans
  - [x] Validate RFID IDs against cached santri
  - [x] Check for duplicates (per shift, per day)
  - [x] Detect shift automatically vs manual override
  - [x] Store to database
  - [x] Return success/error responses
- [x] `GET /api/classes` - Get all classes (for frontend cache init)
- [x] `GET /api/classes/:classId/santri` - Get santri by class
- [x] `GET /api/attendance/today` - Get today's attendance summary
- [x] `GET /api/attendance/month` - Get monthly attendance data
- [x] `GET /api/attendance/export` - Export JSON data

## Phase 4: Frontend Cache & Services

- [x] IndexedDB cache service for santri data
- [x] Attendance today cache (siang & malam split)
- [x] API service (HTTP calls to backend)
- [x] Timezone utility service
- [x] Cache initialization on app load
- [x] Basic UI scaffold with status cards
- [x] Dual-layer cache validation with TTL checking
- [x] Error logging to file with auto-rotation
- [ ] Auto-sync cache when month changes

## Phase 5: Frontend RFID & UI

- [x] RFID reader integration (keyboard input listener)
- [x] Batch queue system (collect RFID scans)
- [x] 3-second batch submit interval
- [x] Shift selector component (auto-detect + manual override)
- [x] Attendance form UI
- [x] Real-time attendance display
  - [x] Show: Nama, Kelas, Shift, Status (success/error/duplicate)
  - [x] Update UI instantly from local cache
- [x] Duplicate check UI (show already checked message)
- [x] Error handling & retry logic display
- [x] Basic dashboard with status cards

## Phase 6: Export Feature - ✅ COMPLETE

- [x] Export service (JSON matrix generation)
- [x] `GET /api/attendance/export` endpoint with JSON response
  - [x] Support filters: month, year, school_type, class, shift
  - [x] Class filtering: UUID or class number (1,2,3) for multi-school selection
  - [x] Matrix format (names vertical, dates horizontal) with attendance percentages
  - [x] Include metadata: month, year, shift, school type, days in month
  - [x] Frontend preview interface with JSON display
  - [x] Smart class selector: unique numbers when "Semua Sekolah" selected
- [x] Excel export service (ExcelJS integration)
  - [x] XLSX file generation with formatted sheets
  - [x] Attendance matrix with proper styling and borders
  - [x] Summary metrics (total present, absent, percentage)
  - [x] Metadata sheet with export information
  - [x] Direct download to client
- [x] Frontend export UI (ExportPageComponent)
  - [x] Navigation bar with home/export tabs
  - [x] Filter form (month, year, school type, class, shift - grid layout)
  - [x] 4-state UI: form → loading → success → error
  - [x] Loading state with spinner animation
  - [x] Success state with summary grid (3-col: period, shift, total santri)
  - [x] Scrollable classes list with student count badges
  - [x] Error state with retry/back options
  - [x] Download trigger with XLSX blob handling
  - [x] Status messages and error handling
  - [x] Responsive layout (3-column grid on desktop, stacked on mobile)
  - [x] Integration with main app routing
  - [x] Professional minimalist design
    - [x] Typography: medium sizing (text-sm to text-lg)
    - [x] Layout: grid-based with proper spacing
    - [x] Color palette: amber/cream with gray neutrals
    - [x] Visual: rounded-xl borders, subtle shadows, hover states

## 🔄 Phase 7: Monthly Data Management

- [ ] Auto-detect current month on page load
- [ ] Month navigation (prev/next month)
- [ ] Auto-sync attendance data when month changes
- [ ] Update cache when month changes
- [ ] Display month/year selector
- [ ] Show attendance statistics (per shift, per class)

## 🗄️ Phase 8: Data Management (For Later)

- [ ] Archive job setup (cron: 0 0 \* \* \*)
- [ ] Archive logic (data > 90 days)
- [ ] Cloud storage integration (placeholder)
- [ ] Archive API endpoints

## 🧪 Phase 9: Testing & QA

- [ ] Manual testing workflow
- [ ] Edge case testing
  - [ ] Outside shift hours
  - [ ] Duplicate scans
  - [ ] Invalid RFID IDs
  - [ ] Network errors & retry
- [ ] Performance testing
- [ ] Load testing (batch submissions)

## 🚀 Phase 10: Production Ready

- [ ] Error logging & monitoring
- [ ] Security review
- [ ] CORS configuration
- [ ] Rate limiting (optional)
- [ ] Database backup strategy
- [ ] Deployment guide (VPS)
- [ ] README with setup instructions

## 🐛 Known Issues & Backlog

- [ ] Offline mode (future enhancement)
- [ ] Mobile responsive UI (future)
- [ ] Real-time dashboard for admin (future)
- [ ] Multi-location support (future)

---

### Notes:

- **In-Memory Cache**: Simple Map-based caching, not Redis (for MVP)
- **Timezone**: All times use Asia/Jakarta (UTC+7)
- **Shift Times**:
  - Siang: 13:00 - 16:00
  - Malam: 18:00 - 21:00
- **Batch Processing**: Submit every 3 seconds
- **Duplicate Check Window**: 5 seconds
- **Archive Threshold**: 90 days (3 months)

---

## 🔗 Related Files

- Config: [src/backend/config/](src/backend/config/)
- Types: [src/shared/types.ts](src/shared/types.ts)
- Schema: [schema.sql](schema.sql)
- Env: [.env.example](.env.example)
