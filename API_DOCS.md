# API Documentation - Sistem Absensi Santri

## Overview

Sistem Absensi Santri adalah API REST untuk mengelola attendance berbasis RFID dengan support untuk 2 shift (siang dan malam). Dibangun dengan Node.js + Express.js + TypeScript.

API ini menyediakan endpoint untuk:

- Batch RFID scanning dengan validasi otomatis
- Monitoring attendance harian dan bulanan
- Export data attendance dalam format JSON matrix untuk preview dan processing lanjutan
- Management data santri dan kelas dengan caching
- Administrative monitoring dan system stats

**Base URL:** `http://localhost:5000`

**Timezone:** Asia/Jakarta (UTC+7)

**Response Format:** Semua response menggunakan JSON dengan struktur konsisten

**Authentication:**

- Semua endpoint kecuali `/health` dan `/api/auth/*` memerlukan JWT token
- Token disimpan dalam **HttpOnly cookies** yang otomatis dikirim browser
- Backend juga support Authorization header: `Authorization: Bearer <token>` (backward compatibility)
- Frontend HARUS set `credentials: 'include'` dalam fetch requests untuk HttpOnly cookies bekerja

## Rate Limiting

API implements the following rate limits to protect endpoints:

- **Login endpoint** (`POST /api/auth/login`): 10 attempts per 15 minutes per IP
- **API endpoints** (all others): 20 requests per second per IP

When rate limit is exceeded, server responds with HTTP 429:

```json
{
  "success": false,
  "error": "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

---

## Error Response Format

Semua error response mengikuti format berikut:

```json
{
  "success": false,
  "error": "Deskripsi error",
  "error_code": "ERROR_CODE_CONSTANT"
}
```

---

## Error Codes

### Authentication Errors

| Code                     | Pesan                                  | Penjelasan                                  |
| ------------------------ | -------------------------------------- | ------------------------------------------- |
| `INVALID_LOGIN_REQUEST`  | Username/email dan password diperlukan | Data login tidak lengkap                    |
| `INVALID_CREDENTIALS`    | Username/email atau password salah     | Login gagal - kredensial tidak cocok        |
| `ADMIN_INACTIVE`         | Admin account tidak aktif              | Akun admin sudah di-disable                 |
| `MISSING_TOKEN`          | Missing atau invalid authorization     | Header Authorization tidak ada/format salah |
| `INVALID_TOKEN`          | Invalid atau expired token             | Token sudah expired atau signature invalid  |
| `TOKEN_VALIDATION_ERROR` | Token validation gagal                 | Error saat verify token                     |
| `MISSING_REFRESH_TOKEN`  | Refresh token diperlukan               | Refresh token tidak ada di request body     |
| `INVALID_REFRESH_TOKEN`  | Invalid atau expired refresh token     | Refresh token sudah expired                 |
| `RATE_LIMIT_EXCEEDED`    | Terlalu banyak percobaan               | Rate limit tercapai, tunggu sebelum retry   |

### Attendance Errors

| Code                    | Pesan                               | Penjelasan                                                   |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `RFID_NOT_FOUND`        | RFID tidak ditemukan di data santri | Kartu RFID tidak terdaftar                                   |
| `OUTSIDE_HOURS`         | Diluar jam absensi                  | Bukan jam shift siang (13:00-16:00) atau malam (18:00-21:00) |
| `ALREADY_CHECKED_SIANG` | Sudah absen siang hari ini          | Santri sudah scan di shift siang hari ini                    |
| `ALREADY_CHECKED_MALAM` | Sudah absen malam hari ini          | Santri sudah scan di shift malam hari ini                    |
| `INACTIVE_SANTRI`       | Santri tidak aktif                  | Santri sudah tidak aktif/terhapus                            |
| `DUPLICATE_IN_BATCH`    | Duplikat dalam batch yang sama      | Satu kartu RFID scan 2x dalam batch                          |
| `DATABASE_ERROR`        | Terjadi kesalahan pada database     | Error query database                                         |
| `VALIDATION_ERROR`      | Validasi data gagal                 | Data tidak sesuai format                                     |
| `INVALID_REQUEST`       | Invalid request format              | Format request tidak sesuai                                  |

---

## Token Information (HttpOnly Cookies)

### Security Implementation ✅

- **Storage:** Access & Refresh tokens dalam **HttpOnly cookies** (tidak accessible via JavaScript)
- **Flags:**
  - `HttpOnly` - Proteksi dari XSS attacks (JavaScript tidak bisa baca)
  - `Secure` - HTTPS only (production) / HTTP in dev
  - `SameSite=Strict` - CSRF protection (hanya kirim same-site requests)
- **Duration:**
  - Access Token: 12 jam (43200 detik)
  - Refresh Token: 7 hari (604800 detik)

### Browser Automatic Cookie Management

- Browser otomatis kirim cookies dengan setiap request (jika `credentials: 'include'`)
- Backend otomatis kirim `Set-Cookie` headers untuk set/clear cookies
- Frontend TIDAK perlu manual handling tokens

### Frontend Implementation

```typescript
// ✅ Benar - Cookies otomatis included
const response = await fetch("/api/endpoint", {
  method: "POST",
  credentials: "include", // PENTING: Agar cookies dikirim
  body: JSON.stringify(data),
});

// ❌ Salah - Cookies tidak included
const response = await fetch("/api/endpoint", {
  method: "POST",
  // Missing credentials: 'include'
  body: JSON.stringify(data),
});
```

### Token Lifecycle

1. User login dengan username/email + password
2. Backend verifikasi & set HttpOnly cookies (Access + Refresh tokens)
3. Browser otomatis menyimpan cookies
4. Setiap API request: browser otomatis kirim cookies (credentials: 'include')
5. Frontend auto-refresh token 5 menit sebelum expiry
6. Backend verifikasi token dari cookie, atau Authorization header (backward compat)
7. Jika token expired: frontend auto-refresh dari cookie
8. Jika refresh_token juga expired: user harus login lagi

### Logout

- Backend kirim `Set-Cookie` dengan maxAge=0 untuk clear cookies
- Browser otomatis hapus cookies
- Frontend clear sessionStorage (admin data)

---

## Endpoints

### Authentication

#### 1. Login

```
POST /api/auth/login
```

**Deskripsi:** Autentikasi dengan username/email dan password. Tidak perlu token.

**Request Body:**

```json
{
  "username_or_email": "admin",
  "password": "my-password-123"
}
```

**Parameters:**

- `username_or_email` (string, required): Username atau email admin
- `password` (string, required): Password plain text (akan di-hash server-side)

**Response (Success - HTTP 200):**

Tokens dikirim via **Set-Cookie headers** (HttpOnly), bukan di response body:

```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "username": "admin",
      "is_active": true,
      "created_at": "2026-04-13T00:00:00.000Z"
    }
  }
}
```

**Set-Cookie Headers (sent by backend):**

```
Set-Cookie: access_token=eyJhb...; HttpOnly; Secure; SameSite=Strict; Max-Age=43200; Path=/
Set-Cookie: refresh_token=eyJh...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

**Error Responses:**

- 400: `INVALID_LOGIN_REQUEST` - Data login tidak lengkap
- 401: `INVALID_CREDENTIALS` - Username/email atau password salah
- 401: `ADMIN_INACTIVE` - Akun admin tidak aktif
- 429: `RATE_LIMIT_EXCEEDED` - Too many login attempts

**cURL (with cookie jar):**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username_or_email": "admin",
    "password": "my-password-123"
  }'
```

**JavaScript Frontend:**

```typescript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    username_or_email: "admin",
    password: "my-password-123",
  }),
});

const data = await response.json();
// data.data.admin contains admin info
// tokens otomatis di cookies (browser management)
```

---

#### 2. Refresh Token

```
POST /api/auth/refresh
```

**Deskripsi:** Refresh access token menggunakan refresh token dari HttpOnly cookie. Tidak perlu request body.

**Request Body:** (kosong atau tidak perlu)

```json
{}
```

**Response (Success - HTTP 200):**

Tokens dikirim via **Set-Cookie headers**, tidak di response body:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 43200,
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "admin",
      "email": "admin@example.com"
    }
  }
}
```

**Note:** Access token juga di response.data untuk reference, tapi yang actual storage di HttpOnly cookie dari Set-Cookie header

**Error Responses:**

- 401: `MISSING_REFRESH_TOKEN` - Refresh token tidak ada di cookie
- 401: `INVALID_REFRESH_TOKEN` - Refresh token expired atau invalid

**cURL (reuse cookies):**

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt
```

**JavaScript Frontend:**

```typescript
const response = await fetch("/api/auth/refresh", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({}),
});

const data = await response.json();
// New access token di cookies (Set-Cookie)
// expires_in untuk schedule next refresh
```

"success": true,
"message": "Logout successful"
}

````

**cURL:**

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <access_token>"
````

---

### Attendance Management

#### 4. Batch RFID Scan

```
POST /api/attendance/batch
```

**Deskripsi:** Process batch RFID scans. Validasi duplikat, deteksi shift, dan record ke database. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "batch": [
    {
      "rfid_id": "RFD001001",
      "shift": "siang"
    },
    {
      "rfid_id": "RFD001002",
      "shift": "siang"
    }
  ],
  "date": "2026-04-11"
}
```

**Parameters:**

- `batch` (array, required): Array of RFID scans
  - `rfid_id` (string): Unique RFID card identifier
  - `shift` (string, optional): "siang" or "malam". Jika tidak ada, auto-detect berdasarkan waktu
- `date` (string, optional): Format YYYY-MM-DD. Default: hari ini

**Response (Success - HTTP 200):**

```json
{
  "success": true,
  "data": {
    "success": [
      {
        "rfid_id": "RFD001001",
        "santri_id": "uuid-001",
        "name": "Ahmad Fadli",
        "shift": "siang",
        "class_name": "SMP-1",
        "school_type": "SMP"
      }
    ],
    "errors": [
      {
        "rfid_id": "RFD001002",
        "error": "Sudah absen siang hari ini",
        "error_code": "ALREADY_CHECKED_SIANG"
      }
    ]
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:5000/api/attendance/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "batch": [
      {"rfid_id": "RFD001001", "shift": "siang"},
      {"rfid_id": "RFD001002"}
    ],
    "date": "2026-04-11"
  }'
```

---

#### 5. Today Summary

```
GET /api/attendance/today
```

**Deskripsi:** Get attendance summary untuk hari ini (siang + malam). Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "date": "2026-04-11",
    "siang_count": 45,
    "malam_count": 38,
    "total_count": 83,
    "timestamp": "2026-04-11T10:30:45.123Z"
  }
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer <access_token>"
```

---

#### 6. Monthly Attendance

```
GET /api/attendance/month
```

**Deskripsi:** Get attendance data untuk bulan tertentu dengan optional filters. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `month` (number, 0-11): Bulan 0=Januari. Default: bulan ini
- `year` (number): Tahun. Default: tahun ini
- `school_type` (string): "SMP" atau "SMK" (optional)
- `class_id` (string): UUID kelas (optional)
- `shift` (string): "siang" atau "malam" (optional)

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": {
    "month": 3,
    "year": 2026,
    "total_records": 480,
    "records": [
      {
        "id": "uuid-123",
        "santri_id": "uuid-001",
        "santri_name": "Ahmad Fadli",
        "class_name": "SMP-1",
        "date": "2026-04-01",
        "shift": "siang",
        "checked_in_at": "2026-04-01T13:15:00",
        "status": "present"
      }
    ]
  }
}
```

**cURL - All data April 2026:**

```bash
curl -X GET "http://localhost:5000/api/attendance/month?month=3&year=2026" \
  -H "Authorization: Bearer <access_token>"
```

**cURL - SMP only, Shift Siang:**

```bash
curl -X GET "http://localhost:5000/api/attendance/month?school_type=SMP&shift=siang" \
  -H "Authorization: Bearer <access_token>"
```

**cURL - Specific class:**

```bash
curl -X GET "http://localhost:5000/api/attendance/month?class_id=<class-uuid>" \
  -H "Authorization: Bearer <access_token>"
```

---

#### 7. Available Months

```
GET /api/attendance/available-months
```

**Deskripsi:** Get list of bulan yang memiliki data attendance. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": [
    {
      "month": 0,
      "year": 2026,
      "monthName": "January",
      "count": 120
    },
    {
      "month": 1,
      "year": 2026,
      "monthName": "February",
      "count": 115
    },
    {
      "month": 2,
      "year": 2026,
      "monthName": "March",
      "count": 130
    },
    {
      "month": 3,
      "year": 2026,
      "monthName": "April",
      "count": 145
    }
  ]
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/attendance/available-months \
  -H "Authorization: Bearer <access_token>"
```

---

#### 8. Export Attendance Data (JSON)

```
GET /api/attendance/export
```

**Deskripsi:** Export attendance data dalam format JSON matrix untuk preview atau processing lanjutan. Mengembalikan data attendance dalam format matrix (nama vertical, tanggal horizontal) untuk setiap kelas. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `month` (number, 1-12): Bulan (REQUIRED)
- `year` (number): Tahun (REQUIRED)
- `shift` (string): "siang" atau "malam" (REQUIRED)
- `school_type` (string): "SMP" atau "SMK" (optional, default: semua sekolah)
- `class_id` (string): UUID kelas atau nomor kelas (1, 2, 3) (optional, default: semua kelas)

**Class ID Parameter:**

- Jika `school_type` kosong ("Semua Sekolah"): `class_id` bisa berupa nomor kelas (1, 2, 3) untuk filter multi-sekolah
- Jika `school_type` diisi ("SMP" atau "SMK"): `class_id` harus UUID kelas spesifik
- Jika `class_id` kosong: semua kelas akan di-include

**Response Format (HTTP 200):**

```json
{
  "month": 4,
  "year": 2026,
  "monthName": "April",
  "shift": "siang",
  "schoolType": null,
  "daysInMonth": 30,
  "classMatrices": [
    {
      "classId": "uuid-smp1",
      "className": "SMP-1",
      "schoolType": "SMP",
      "studentCount": 10,
      "attendanceMatrix": [
        {
          "santriId": "uuid-001",
          "santriName": "Ahmad Fadli",
          "rfidId": "RFD001001",
          "attendance": ["✓", "", "✓"],
          "totalPresent": 28,
          "totalAbsent": 2,
          "percentage": 93.3
        }
      ]
    }
  ],
  "generatedAt": "2026-04-12T02:56:21.624Z"
}
```

**Matrix Format:**

- `attendance`: Array 30 elemen (sesuai `daysInMonth`) dengan "✓" untuk hadir, "" untuk tidak hadir
- `totalPresent`: Jumlah hari hadir
- `totalAbsent`: Jumlah hari tidak hadir
- `percentage`: Persentase kehadiran (totalPresent / daysInMonth \* 100)

**Error Responses:**

- 400: Missing required parameter (month, year, or shift)
- 404: No attendance data found for the specified filters
- 500: Server error

**cURL - Export April 2026 Shift Siang (All Schools, All Classes):**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang" \
  -H "Authorization: Bearer <access_token>"
```

**cURL - Export SMP only, All Classes:**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&school_type=SMP" \
  -H "Authorization: Bearer <access_token>"
```

**cURL - Export All Schools, Class 2 only (SMP-2 + SMK-2):**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&class_id=2" \
  -H "Authorization: Bearer <access_token>"
```

**cURL - Export specific class:**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&class_id=<class-uuid>" \
  -H "Authorization: Bearer <access_token>"
```

---

### Classes and Santri Management

#### 9. Get All Classes

```
GET /api/classes
```

**Deskripsi:** Get semua kelas yang tersedia. Data di-cache selama 12 jam. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-smp1",
      "name": "SMP-1",
      "school_type": "SMP",
      "grade": 1,
      "created_at": "2026-04-01T00:00:00Z"
    },
    {
      "id": "uuid-smp2",
      "name": "SMP-2",
      "school_type": "SMP",
      "grade": 2,
      "created_at": "2026-04-01T00:00:00Z"
    },
    {
      "id": "uuid-smk1",
      "name": "SMK-1",
      "school_type": "SMK",
      "grade": 1,
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/classes \
  -H "Authorization: Bearer <access_token>"
```

---

#### 10. Get Santri by Class

```
GET /api/classes/:classId/santri
```

**Deskripsi:** Get semua santri dalam kelas tertentu. Data di-cache selama 12 jam. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Path Parameters:**

- `classId` (string): UUID kelas (dari endpoint GET /api/classes)

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-001",
      "rfid_id": "RFD001001",
      "name": "Ahmad Fadli",
      "class_id": "uuid-smp1",
      "is_active": true,
      "created_at": "2026-04-01T00:00:00Z"
    },
    {
      "id": "uuid-002",
      "rfid_id": "RFD001002",
      "name": "Bella Rahmawati",
      "class_id": "uuid-smp1",
      "is_active": true,
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/classes/uuid-smp1/santri \
  -H "Authorization: Bearer <access_token>"
```

---

#### 11. Reinitialize Cache (Debug)

```
POST /api/classes/init-cache
```

**Deskripsi:** Clear dan reinitialize cache. Endpoint ini untuk debugging saja. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "message": "Cache reinitialized",
  "stats": {
    "size": 42,
    "entries": 120,
    "timestamp": "2026-04-11T10:30:45.123Z"
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:5000/api/classes/init-cache \
  -H "Authorization: Bearer <access_token>"
```

---

### Administrative

#### 12. Health Check

```
GET /health
```

**Deskripsi:** Check status server (tidak perlu token). Dapat digunakan untuk monitoring.

**Response (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2026-04-11T10:30:45.123Z"
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/health
```

---

#### 13. System Statistics

```
GET /api/admin/stats
```

**Deskripsi:** Get system statistics dan monitoring info. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": {
    "total_santri": 240,
    "total_classes": 6,
    "total_attendance_records": 8523,
    "smp_count": 3,
    "smk_count": 3,
    "cache_status": {
      "enabled": true,
      "entries": 120,
      "memory_usage_kb": 45
    },
    "archive_status": {
      "last_archive": "2026-04-10T02:00:00Z",
      "archive_count": 1,
      "total_archived_records": 0
    },
    "server": {
      "uptime_seconds": 86400,
      "memory_usage_mb": 128,
      "version": "1.0.0"
    }
  }
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer <access_token>"
```

---

#### 14. Archive Status

```
GET /api/admin/archive/status
```

**Deskripsi:** Get status archive data. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": {
    "archive_enabled": true,
    "last_archive_date": "2026-04-10T02:00:00Z",
    "archive_job_time": "02:00",
    "total_records_archived": 0,
    "scheduled": true,
    "next_archive_date": "2026-04-11T02:00:00Z"
  }
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/admin/archive/status \
  -H "Authorization: Bearer <access_token>"
```

---

#### 15. Archive History

```
GET /api/admin/archive/history
```

**Deskripsi:** Get history dari semua archive operations. Memerlukan token.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `limit` (number, optional): Max records (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)

**Response (HTTP 200):**

```json
{
  "success": true,
  "data": {
    "total": 5,
    "limit": 50,
    "offset": 0,
    "history": [
      {
        "id": "uuid-archive-1",
        "archive_date": "2026-04-10T02:00:00Z",
        "records_count": 245,
        "status": "success",
        "message": "Archive completed successfully"
      },
      {
        "id": "uuid-archive-2",
        "archive_date": "2026-04-09T02:00:00Z",
        "records_count": 228,
        "status": "success",
        "message": "Archive completed successfully"
      }
    ]
  }
}
```

**cURL:**

```bash
curl -X GET http://localhost:5000/api/admin/archive/history \
  -H "Authorization: Bearer <access_token>"
```

**cURL - With pagination:**

```bash
curl -X GET "http://localhost:5000/api/admin/archive/history?limit=10&offset=0" \
  -H "Authorization: Bearer <access_token>"
```

---

## Shift Configuration

### Jam Kerja

- **Siang:** 13:00 - 16:00
- **Malam:** 18:00 - 21:00

### Shift Detection

- Jika santri scan diluar jam kerja dan tidak specify shift → ERROR `OUTSIDE_HOURS`
- Jika santri scan dalam jam kerja dan tidak specify shift → Auto-detect ke shift yang aktif
- Jika santri specify shift → Gunakan shift yang di-specify

---

## Response Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 200  | OK - Request berhasil                   |
| 400  | Bad Request - Data tidak valid          |
| 401  | Unauthorized - Token invalid/missing    |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Error server    |

---

## Database Schema

### Classes

```
id: UUID (primary key)
name: string (unique) - "SMP-1", "SMK-3", etc
school_type: string - "SMP" or "SMK"
grade: int (1, 2, 3)
created_at: timestamp
```

### Santri

```
id: UUID (primary key)
rfid_id: string (unique) - RFID card identifier
name: string
class_id: UUID (FK -> classes)
is_active: boolean
created_at: timestamp
```

### Attendance Logs

```
id: UUID (primary key)
santri_id: UUID (FK -> santri)
class_id: UUID (FK -> classes)
date: date
shift: string - "siang" or "malam"
checked_in_at: timestamp
status: string - "present" or "absent"
notes: string (optional)
created_at: timestamp

UNIQUE CONSTRAINT: (santri_id, date, shift)
```

### Admin Users

```
id: UUID (primary key)
email: string (unique)
username: string (unique)
password_hash: string (bcrypt/scrypt)
is_active: boolean
created_at: timestamp
updated_at: timestamp
```

---

## Caching Strategy

### Backend Cache (In-Memory)

- **Classes:** 12 hours TTL (configurable via CACHE_TTL_SANTRI)
- **Santri per class:** 12 hours TTL
- **Today's attendance:** 24 hours TTL
- Auto-cleanup every 5 minutes

### Frontend Cache (IndexedDB)

- **Santri master:** Persistent
- **Today's attendance:** Cleared at midnight
- **Auth tokens:** Survives page refresh

---

## Environment Configuration

Key environment variables for API configuration:

```env
# Server
SERVER_PORT=5000
SERVER_HOST=0.0.0.0

# Authentication
JWT_SECRET=your-secret-key (min 32 chars)
ACCESS_TOKEN_EXPIRES_IN=43200 (12 hours in seconds)
REFRESH_TOKEN_EXPIRES_IN=604800 (7 days in seconds)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=1000 (1 second)
RATE_LIMIT_MAX_REQUESTS=20
LOGIN_LIMIT_WINDOW_MS=900000 (15 minutes)
LOGIN_LIMIT_MAX_ATTEMPTS=10

# Cache
CACHE_ENABLED=true
CACHE_TTL_SANTRI=7200 (2 hours in seconds)
CACHE_TTL_ATTENDANCE=300 (5 minutes in seconds)

# Timezone
TIMEZONE=Asia/Jakarta

# CORS
FRONTEND_URL=http://localhost:3000,http://localhost:5000
```

---

## Version

**API Version:** 1.0.0
**Status:** Stable
**Last Updated:** April 16, 2026
