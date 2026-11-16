import "dotenv/config";
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { HttpError } from "./auth";
import authRoutes from "./routes/auth";
import businessRoutes from "./routes/business";
import inventoryRoutes from "./routes/inventory";
import salesRoutes from "./routes/sales";
import financeRoutes from "./routes/finance";
import reportRoutes from "./routes/reports";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
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
app.use("/api", inventoryRoutes);      // /categories /products /suppliers /purchases
app.use("/api/sales", salesRoutes);
app.use("/api", financeRoutes);        // /wallets /expenses /goals
app.use("/api/reports", reportRoutes); // /summary /dashboard /closings

app.use((req, _res, next) => next(new HttpError(404, "Alamat tidak ditemukan.")));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." });
});

export default app;
