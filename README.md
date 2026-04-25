# Sistem Absensi Santri

Aplikasi absensi santri berbasis RFID (SMP/SMK) dengan backend Express + Supabase dan frontend Vite.

## Ringkasan

- Input absensi via RFID dengan dukungan shift siang dan malam.
- Validasi duplikasi absensi per santri per hari per shift.
- Export data absensi dan manajemen data santri.
- Autentikasi JWT via HttpOnly cookies.

## Tech Stack

- Backend: Node.js, Express, TypeScript, Supabase
- Frontend: Vite, TypeScript, Tailwind CSS
- Monorepo: pnpm workspace

## Prasyarat

- Node.js 18+
- pnpm 8+
- Supabase project aktif

## Quick Start

1. Install dependency:

```bash
pnpm install
```

2. Siapkan environment backend:

```bash
cp packages/backend/.env.example packages/backend/.env
```

3. Isi nilai penting di `.env` backend:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `JWT_SECRET`
- `FRONTEND_URL`

4. Setup database:

- Jalankan isi file `schema.sql` di project Supabase.

5. Jalankan mode development:

```bash
pnpm dev
```

6. Build production assets:

```bash
pnpm build
```

7. Jalankan server backend (serve frontend dari `packages/backend/public`):

```bash
pnpm start
```

## Scripts

- `pnpm dev` : Menjalankan backend + frontend secara paralel
- `pnpm build` : Build frontend, build backend, lalu copy artefak frontend ke backend
- `pnpm start` : Menjalankan backend dari hasil build
- `pnpm type-check` : Type check semua package

## Catatan API

- Endpoint daftar santri tetap: `GET /api/santri`
- Untuk kompatibilitas frontend lama, respons endpoint ini tetap mengembalikan satu array penuh.
- Di backend, query ke Supabase dilakukan internal pagination per 500 data agar aman untuk dataset besar.

## Dokumentasi

- API lengkap: [API_DOCS.md](API_DOCS.md)
- Panduan Docker: [DOCKER.md](DOCKER.md)
- Skema database: [schema.sql](schema.sql)

## Struktur Singkat

- `packages/backend` : API server
- `packages/frontend` : Aplikasi web
- `packages/shared` : Shared types/utilities

## Lisensi

MIT
