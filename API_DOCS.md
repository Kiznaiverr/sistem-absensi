# API Documentation - Sistem Absensi Santri

## Overview

Sistem Absensi Santri adalah API REST untuk mengelola attendance berbasis RFID dengan support untuk 2 shift (siang dan malam). Dibangun dengan Node.js + Express.js + TypeScript.

API ini menyediakan endpoint untuk:

- Batch RFID scanning dengan validasi otomatis
- Monitoring attendance harian dan bulanan
- Export data attendance dalam format JSON matrix untuk preview dan processing lanjutan
- Management data santri dan kelas dengan caching

**Base URL:** `http://localhost:5000`

**Timezone:** Asia/Jakarta (UTC+7)

**Response Format:** Semua response menggunakan JSON dengan struktur konsisten

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

## Endpoints

### 1. Health Check

```
GET /health
```

**Deskripsi:** Check status server

**Response:**

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

### 2. Batch RFID Scan

```
POST /api/attendance/batch
```

**Deskripsi:** Process batch RFID scans. Validasi duplikat, deteksi shift, dan record ke database.

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

**Response (Success):**

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
  -d '{
    "batch": [
      {"rfid_id": "RFD001001", "shift": "siang"},
      {"rfid_id": "RFD001002"}
    ],
    "date": "2026-04-11"
  }'
```

---

### 3. Today Summary

```
GET /api/attendance/today
```

**Deskripsi:** Get attendance summary untuk hari ini (siang + malam)

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
curl -X GET http://localhost:5000/api/attendance/today
```

---

### 4. Monthly Attendance

```
GET /api/attendance/month
```

**Deskripsi:** Get attendance data untuk bulan tertentu dengan optional filters

**Query Parameters:**

- `month` (number, 0-11): Bulan 0=Januari. Default: bulan ini
- `year` (number): Tahun. Default: tahun ini
- `school_type` (string): "SMP" atau "SMK" (optional)
- `class_id` (string): UUID kelas (optional)
- `shift` (string): "siang" atau "malam" (optional)

**Response:**

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
curl -X GET "http://localhost:5000/api/attendance/month?month=3&year=2026"
```

**cURL - SMP only, Shift Siang:**

```bash
curl -X GET "http://localhost:5000/api/attendance/month?school_type=SMP&shift=siang"
```

**cURL - Specific class:**

```bash
curl -X GET "http://localhost:5000/api/attendance/month?class_id=<class-uuid>"
```

---

### 5. Export Attendance Data (JSON)

```
GET /api/attendance/export
```

**Deskripsi:** Export attendance data dalam format JSON matrix untuk preview atau processing lanjutan. Mengembalikan data attendance dalam format matrix (nama vertical, tanggal horizontal) untuk setiap kelas.

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

**Response Format:**

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
          "attendance": [
            "✓", // Hadir tanggal 1
            "", // Tidak hadir tanggal 2
            "✓" // Hadir tanggal 3
            // ... sampai tanggal 30
          ],
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
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang"
```

**cURL - Export SMP only, All Classes:**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&school_type=SMP"
```

**cURL - Export All Schools, Class 2 only (SMP-2 + SMK-2):**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&class_id=2"
```

**cURL - Export specific class:**

```bash
curl -X GET "http://localhost:5000/api/attendance/export?month=4&year=2026&shift=siang&class_id=<class-uuid>"
```

### 5.5 Export to Excel (Frontend)

**Deskripsi:** Frontend component untuk export attendance data ke file Excel (.xlsx) dengan formatting profesional.

**Features:**

- Filter form dengan month, year, shift, school_type, class_id
- Real-time preview JSON data
- State-based UI: form → loading → success/error
- Direct XLSX download menggunakan ExcelJS
- Error handling dan retry logic
- Professional minimalist design dengan grid layout

**Usage:** Navigate ke `/export` di frontend untuk mengakses export interface.

**Response Format (Excel File):**

- Attendance matrix dengan nama santri sebagai baris
- Tanggal bulan sebagai kolom (1-31)
- Mark "✓" untuk hadir, kosong untuk tidak hadir
- Summary: Total hadir, absen, persentase per santri
- Metadata sheet: Period, shift, school type, total santri

---

### 6. Get All Classes

```
GET /api/classes
```

**Deskripsi:** Get semua kelas yang tersedia. Data di-cache selama 12 jam.

**Response:**

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
curl -X GET http://localhost:5000/api/classes
```

---

### 7. Get Santri by Class

```
GET /api/classes/:classId/santri
```

**Deskripsi:** Get semua santri dalam kelas tertentu. Data di-cache selama 12 jam.

**Path Parameters:**

- `classId` (string): UUID kelas (dari endpoint GET /api/classes)

**Response:**

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
curl -X GET http://localhost:5000/api/classes/uuid-smp1/santri
```

---

### 8. Reinitialize Cache (Debug)

```
POST /api/classes/init-cache
```

**Deskripsi:** Clear dan reinitialize cache. Endpoint ini untuk debugging saja.

**Response:**

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
curl -X POST http://localhost:5000/api/classes/init-cache
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

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | OK - Request berhasil                |
| 400  | Bad Request - Data tidak valid       |
| 500  | Internal Server Error - Error server |

---

## Database Schema

### Classes

```
id: UUID
name: string (unique) - "SMP-1", "SMK-3", etc
school_type: string - "SMP" or "SMK"
grade: int (1, 2, 3)
created_at: timestamp
```

### Santri

```
id: UUID
rfid_id: string (unique) - RFID card identifier
name: string
class_id: UUID (FK -> classes)
is_active: boolean
created_at: timestamp
```

### Attendance Logs

```
id: UUID
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

---

## Caching Strategy

### Backend Cache (In-Memory)

- **Classes:** 12 hours TTL
- **Santri per class:** 12 hours TTL
- **Today's attendance:** 24 hours TTL
- Auto-cleanup every 5 minutes

### Frontend Cache (IndexedDB)

- **Santri master:** Persistent
- **Today's attendance:** Cleared at midnight
- Survives page refresh

---

## Rate Limiting

Tidak ada rate limiting di fase ini. Akan ditambahkan di fase production.

---

## Authentication

Tidak ada authentication di fase ini. Akan ditambahkan di fase production menggunakan JWT tokens.

---

## Example Workflow

### 1. Initialize App

```bash
# Get all classes
curl -X GET http://localhost:5000/api/classes

# Get santri in SMP-1
curl -X GET http://localhost:5000/api/classes/<class-id>/santri
```

### 2. Process RFID Scans (Batch)

```bash
# Scan 5 kartu RFID siang shift
curl -X POST http://localhost:5000/api/attendance/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batch": [
      {"rfid_id": "RFD001001"},
      {"rfid_id": "RFD001002"},
      {"rfid_id": "RFD002001"},
      {"rfid_id": "RFD004003"},
      {"rfid_id": "RFD006005"}
    ]
  }'
```

### 3. Check Today Summary

```bash
curl -X GET http://localhost:5000/api/attendance/today
```

---

## Frontend Integration

Frontend services sudah tersedia di:

- `src/frontend/services/api.ts` - HTTP client
- `src/frontend/services/cache.ts` - Cache management
- `src/frontend/services/timezone.ts` - Timezone operations

---

## Troubleshooting

### RFID Not Found

- Pastikan RFID terdaftar di database santri
- Cek format RFID_ID (harus sesuai dengan yang di database)

### Already Checked

- Santri sudah scan di shift yang sama hari ini
- Unique constraint: 1 entry per santri per shift per day

### Outside Hours

- Pastikan waktu server sudah benar
- Timezone: Asia/Jakarta (UTC+7)
- Siang: 13:00-16:00, Malam: 18:00-21:00

### Cache Not Updating

- Manual reinitialize: `POST /api/classes/init-cache`
- Cache auto-refresh setiap 5 menit

---

## Version

**API Version:** 1.0.0  
**Status:** Beta (Phase 1-5 Complete)  
**Last Updated:** April 11, 2026
