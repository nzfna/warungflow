import "dotenv/config";
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { HttpError, requireAuth, requireBusiness } from "./auth";
import authRoutes from "./routes/auth";
import businessRoutes from "./routes/business";
import inventoryRoutes from "./routes/inventory";
import salesRoutes from "./routes/sales";
import financeRoutes from "./routes/finance";
import reportRoutes from "./routes/reports";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // di belakang proxy Vercel/Next agar IP klien terbaca

// Hanya origin terdaftar yang boleh membaca respons lintas domain.
// Request tanpa Origin (rewrite Next.js, cron, curl) tetap dilayani; browser
// yang mengakses web lewat domain sendiri tidak butuh header CORS.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const key = req.header("Idempotency-Key");
  if (key && key.length > 100) return next(new HttpError(400, "Idempotency-Key terlalu panjang (maks. 100 karakter)."));
  next();
});


app.get("/api/health", (_req, res) => res.json({ ok: true }));
// Vercel Cron (pengingat harian): placeholder aman
app.get("/api/cron/daily", (req, res) => {
  if (process.env.CRON_SECRET && req.header("authorization") !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, "Unauthorized");
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);

// Satu kali pemeriksaan sesi + keanggotaan warung untuk semua rute di bawahnya,
// agar tidak ada query berulang hanya karena router tidak cocok.
app.use("/api", requireAuth, requireBusiness);

app.use("/api", inventoryRoutes);       // /categories /products /suppliers /purchases
app.use("/api", financeRoutes);         // /wallets /expenses /goals
app.use("/api/sales", salesRoutes);
app.use("/api/reports", reportRoutes);  // /summary /dashboard /closings

app.use((req, _res, next) => next(new HttpError(404, "Alamat tidak ditemukan.")));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  // Penanganan error teknis yang sering muncul dari input tak wajar.
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Format data tidak valid." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Data yang dikirim terlalu besar." });
  if (err?.code === "22P02") return res.status(400).json({ error: "ID tidak valid." });
  if (err?.code === "23505") return res.status(409).json({ error: "Data sudah ada." });
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." });
});

export default app;
