import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { q } from "./db";
import type { Role } from "@warungflow/shared";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ACCESS = process.env.JWT_SECRET || "dev-secret";
const REFRESH = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const prod = process.env.NODE_ENV === "production";

export type Ctx = { userId: string; businessId: string; role: Role };
declare global { namespace Express { interface Request { userId?: string; ctx?: Ctx } } }

export function setSession(res: Response, userId: string) {
  const access = jwt.sign({ sub: userId }, ACCESS, { expiresIn: "15m" });
  const refresh = jwt.sign({ sub: userId }, REFRESH, { expiresIn: "30d" });
  const base = { httpOnly: true, secure: prod, sameSite: "lax" as const, path: "/" };
  res.cookie("wf_access", access, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie("wf_refresh", refresh, { ...base, maxAge: 30 * 24 * 3600 * 1000 });
}
export function clearSession(res: Response) {
  res.clearCookie("wf_access", { path: "/" });
  res.clearCookie("wf_refresh", { path: "/" });
}
export function verifyRefresh(token?: string): string | null {
  try { return token ? (jwt.verify(token, REFRESH) as any).sub : null; } catch { return null; }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.wf_access;
    if (!token) throw new HttpError(401, "Silakan masuk dulu.");
    req.userId = (jwt.verify(token, ACCESS) as any).sub;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, "Sesi berakhir. Silakan masuk lagi."));
  }
}

// Memuat business_id + role dari business_members. Semua query wajib memakai ctx.businessId.
export async function requireBusiness(req: Request, _res: Response, next: NextFunction) {
  try {
    const rows = await q<{ business_id: string; role: Role }>(
      "SELECT business_id, role FROM business_members WHERE user_id=$1 ORDER BY created_at LIMIT 1", [req.userId]);
    if (!rows[0]) throw new HttpError(409, "Buat profil warung dulu.");
    req.ctx = { userId: req.userId!, businessId: rows[0].business_id, role: rows[0].role };
    next();
  } catch (e) { next(e); }
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) =>
  roles.includes(req.ctx!.role) ? next() : next(new HttpError(403, "Kamu tidak punya izin untuk aksi ini."));

export const audit = (ctx: Ctx, action: string, detail: any = {}) =>
  q("INSERT INTO audit_logs (business_id,user_id,action,detail) VALUES ($1,$2,$3,$4)", [ctx.businessId, ctx.userId, action, detail]).catch(() => {});
