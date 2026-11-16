import { Router } from "express";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema } from "@warungflow/shared";
import { HttpError, clearSession, requireAuth, setSession, verifyRefresh } from "../auth";
import { q } from "../db";
import { parse } from "../lib";
import { rateLimit } from "../ratelimit";

const r = Router();

// Hash tiruan agar waktu respons login untuk email yang tidak ada tetap mirip,
// sehingga penyerang tidak bisa menebak email mana yang terdaftar.
const DUMMY_HASH = "$2a$10$eZfwWMsymbgtQgqXWV93Ye0wHCWGxNVd.waiFXkSE0hocf9uiFPE6";

r.post("/register", rateLimit("register", 5, 60 * 60 * 1000), async (req, res) => {
  const b = parse(registerSchema, req.body);
  const exists = await q("SELECT 1 FROM users WHERE email=$1", [b.email]);
  if (exists[0]) throw new HttpError(409, "Email sudah terdaftar. Silakan masuk.");
  const hash = await bcrypt.hash(b.password, 10);
  const [u] = await q("INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email", [b.name, b.email, hash]);
  setSession(res, u.id);
  res.status(201).json({ user: u });
});

r.post("/login", rateLimit("login", 10, 10 * 60 * 1000), async (req, res) => {
  const b = parse(loginSchema, req.body);
  const [u] = await q("SELECT id,name,email,password_hash FROM users WHERE email=$1", [b.email]);
  const ok = await bcrypt.compare(b.password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, "Email atau password salah.");
  setSession(res, u.id);
  res.json({ user: { id: u.id, name: u.name, email: u.email } });
});

r.post("/refresh", (req, res) => {
  const id = verifyRefresh(req.cookies?.wf_refresh);
  if (!id) { clearSession(res); throw new HttpError(401, "Sesi berakhir. Silakan masuk lagi."); }
  setSession(res, id);
  res.json({ ok: true });
});

r.post("/logout", (_req, res) => { clearSession(res); res.json({ ok: true }); });

r.get("/me", requireAuth, async (req, res) => {
  const [u] = await q("SELECT id,name,email FROM users WHERE id=$1", [req.userId]);
  if (!u) throw new HttpError(401, "Akun tidak ditemukan.");
  const [m] = await q(
    `SELECT m.role, b.id AS business_id, b.name AS business_name FROM business_members m JOIN businesses b ON b.id=m.business_id
     WHERE m.user_id=$1 ORDER BY m.created_at LIMIT 1`, [req.userId]);
  res.json({ user: u, business: m ? { id: m.business_id, name: m.business_name } : null, role: m?.role ?? null });
});

export default r;
