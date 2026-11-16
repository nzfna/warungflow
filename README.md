# WarungFlow

Next.js (web) + Express.js (API) + Neon PostgreSQL, monorepo pnpm, deploy ke Vercel (dua project).

## Jalankan lokal
1. `pnpm install`
2. Buat database di https://neon.tech (region Singapore), salin connection string **pooled** (`-pooler`).
3. `apps/api/.env` (lihat `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN=http://localhost:3000`
4. `apps/web/.env.local`: `API_URL=http://localhost:4000`
5. `pnpm build:shared` lalu `pnpm migrate` (membuat semua tabel; aman diulang)
6. Terminal 1: `pnpm dev:api` | Terminal 2: `pnpm dev:web` -> http://localhost:3000

Sebelum push, jalankan `pnpm typecheck` (API) dan `pnpm build:web` supaya error tipe ketahuan di laptop, bukan saat deploy.

## Deploy ke Vercel
Push repo ke GitHub, lalu buat **dua project** dari repo yang sama. Di **kedua** project:
atur **Root Directory** sesuai tabel di bawah, lalu **wajib** nyalakan toggle
**"Include files outside of the Root Directory in the Build Step"** — tanpa ini
build gagal karena `packages/shared` dan `pnpm-workspace.yaml` ada di luar folder app.

| Project | Root Directory | Framework | Env |
|---|---|---|---|
| API | `apps/api` | Other | lihat di bawah |
| Web | `apps/web` | Next.js | `API_URL` |

**API** - Root Directory `apps/api`
- Env: `DATABASE_URL` (pooled), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (URL web, boleh dipisah koma)
- `CRON_SECRET` opsional; kalau diisi, endpoint cron wajib `Authorization: Bearer <CRON_SECRET>`
- `JWT_SECRET`/`JWT_REFRESH_SECRET` **wajib** minimal 32 karakter acak dan berbeda. Di production API sengaja
  menolak start kalau kosong/lemah, supaya token tidak bisa dipalsukan.
- `vercel.json` mengatur install, build shared, rewrite ke `api/index.ts`, `maxDuration`, region `sin1`, dan cron harian.
- Tes setelah deploy: `https://<project-api>.vercel.app/api/health` harus `{"ok":true}`.

**Web** - Root Directory `apps/web`
- Env: `API_URL` = URL project API (mis. `https://warungflow-api.vercel.app`)
- `next.config.mjs` meneruskan `/api/*` ke Express, jadi cookie httpOnly tetap satu origin.
- `API_URL` dibaca saat build. Kalau diganti, **redeploy** web.
- `CORS_ORIGIN` di project API sebaiknya diisi URL web; akses lintas domain dari origin lain akan ditolak.

Jalankan migrasi sekali ke database Neon: `DATABASE_URL=... pnpm migrate`
(atau isi `apps/api/.env` lalu `pnpm migrate`). Jalankan lagi kalau ada perubahan `schema.sql`.

## Keamanan
- Password di-hash bcrypt; sesi berupa cookie `httpOnly` + `Secure` di production + `SameSite=Lax`.
- Login/register dibatasi laju (rate limit) untuk menahan tebak password.
- Semua query memakai parameter (anti SQL injection); error ID/JSON tidak valid dijawab 400, bukan 500.
- Header keamanan web: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`.
- Batas payload 200 kb, maksimal 200 baris item per transaksi, `Idempotency-Key` maksimal 100 karakter.
- Rate limit disimpan di memori per instance; cukup untuk warung, bukan pengganti WAF.

## Catatan
- Query memakai `pg` langsung (SQL eksplisit) dan transaksi DB untuk checkout, pembelian, alokasi, dan tutup buku.
  PRD mengizinkan Drizzle/Prisma; bisa diganti nanti.
- Pool koneksi dijaga kecil (`PG_POOL_MAX`, default 3) karena tiap instance serverless punya pool sendiri.
- Belum ada: upload bukti transaksi, reset password via email, cetak struk, stok per tanggal kedaluwarsa, notifikasi.
- Hobby plan Vercel untuk non-komersial; cron Hobby maksimal sekali sehari. Cek ketentuan sebelum dipakai warung sungguhan.
