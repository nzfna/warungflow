import { NextFunction, Request, Response } from "express";
import { HttpError } from "./auth";

// Pembatas laju sederhana di memori proses. Cukup untuk menahan tebak-tebakan
// password pada satu instance serverless. Bukan pengganti WAF/Redis, tapi jauh
// lebih baik daripada tanpa batas sama sekali.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function clientIp(req: Request) {
  const fwd = req.header("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.ip)?.trim() || "unknown";
}

export function rateLimit(name: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size > MAX_BUCKETS) buckets.clear();
    }
    const id = `${name}:${clientIp(req)}`;
    const b = buckets.get(id);
    if (!b || b.resetAt <= now) {
      buckets.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > limit) {
      const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retry));
      return next(new HttpError(429, `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(retry / 60)} menit.`));
    }
    next();
  };
}
