# WarungFlow

Next.js (web) + Express.js (API) + Neon PostgreSQL, monorepo pnpm, deploy ke Vercel (dua project).

## Jalankan lokal
1. `pnpm install`
2. Buat database di https://neon.tech, salin connection string **pooled** (`-pooler`).
3. `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN=http://localhost:3000`
4. `apps/web/.env.local`: `API_URL=http://localhost:4000`
5. `pnpm build:shared` lalu `pnpm migrate` (membuat semua tabel)
6. Terminal 1: `pnpm dev:api` | Terminal 2: `pnpm dev:web` -> http://localhost:3000

## Deploy ke Vercel
Push repo ke GitHub, lalu buat **dua project** dari repo yang sama:

**API** - Root Directory `apps/api`
- Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (URL web), `CRON_SECRET` (opsional)
- `vercel.json` sudah mengatur install, build shared, rewrite ke `api/index.ts`, dan cron harian.

**Web** - Root Directory `apps/web`
- Env: `API_URL` = URL project API (mis. `https://warungflow-api.vercel.app`)
- `next.config.mjs` meneruskan `/api/*` ke Express, jadi cookie httpOnly tetap satu origin.

Jalankan migrasi sekali ke database Neon: `DATABASE_URL=... pnpm migrate`.

## Catatan
- Query memakai `pg` langsung (SQL eksplisit) dan transaksi DB untuk checkout, pembelian, alokasi, dan tutup buku. PRD mengizinkan Drizzle/Prisma; bisa diganti nanti.
- Belum ada: upload bukti transaksi, reset password via email, cetak struk, stok per tanggal kedaluwarsa, notifikasi.
- Hobby plan Vercel untuk non-komersial; cek ketentuan sebelum dipakai warung sungguhan.
- Kode belum pernah dijalankan (lingkungan tanpa internet). Cek sintaks lolos, tapi lakukan `pnpm install` dan `pnpm --filter @warungflow/api build` / `next build` untuk menangkap error tipe.
