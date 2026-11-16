import { Router } from "express";
import bcrypt from "bcryptjs";
import { businessUpdateSchema, setupBusinessSchema, userInviteSchema, WALLET_KINDS } from "@warungflow/shared";
import { HttpError, audit, requireAuth, requireBusiness, requireRole } from "../auth";
import { q, tx, qc } from "../db";
import { cashMove, parse, walletMove } from "../lib";

const r = Router();
r.use(requireAuth);

// Onboarding: buat warung + 4 dompet + saldo awal
r.post("/setup", async (req, res) => {
  const b = parse(setupBusinessSchema, req.body);
  const has = await q("SELECT 1 FROM business_members WHERE user_id=$1", [req.userId]);
  if (has[0]) throw new HttpError(409, "Kamu sudah punya warung.");
  const alloc = b.initialAllocation;
  const sum = alloc.capital + alloc.operations + alloc.owner + alloc.growth;
  if (sum > b.openingCash) throw new HttpError(400, "Total isi dompet melebihi saldo awal kas.");

  const id = await tx(async (c) => {
    const [biz] = await qc(c, "INSERT INTO businesses (name,address) VALUES ($1,$2) RETURNING id", [b.name, b.address]);
    await qc(c, "INSERT INTO business_members (business_id,user_id,role) VALUES ($1,$2,'owner')", [biz.id, req.userId]);
    for (const k of WALLET_KINDS) await qc(c, "INSERT INTO wallets (business_id,kind) VALUES ($1,$2)", [biz.id, k]);
    for (const n of ["Sembako", "Minuman", "Makanan ringan", "Bumbu dapur", "Kebersihan", "Lainnya"])
      await qc(c, "INSERT INTO categories (business_id,name) VALUES ($1,$2)", [biz.id, n]);
    await cashMove(c, { businessId: biz.id, direction: "in", amount: b.openingCash, method: "cash", refType: "opening", note: "Saldo awal kas", userId: req.userId! });
    for (const k of WALLET_KINDS) {
      if (alloc[k] > 0) await walletMove(c, { businessId: biz.id, kind: k, amount: alloc[k], type: "opening", note: "Saldo awal", userId: req.userId! });
    }
    return biz.id as string;
  });
  res.status(201).json({ businessId: id });
});

r.use(requireBusiness);

r.get("/", async (req, res) => {
  const [b] = await q("SELECT id,name,address,allow_negative_stock,ops_budget,timezone,currency FROM businesses WHERE id=$1", [req.ctx!.businessId]);
  res.json({ business: b, role: req.ctx!.role });
});

r.patch("/", requireRole("owner"), async (req, res) => {
  const b = parse(businessUpdateSchema, req.body);
  await q(
    `UPDATE businesses SET name=COALESCE($2,name), address=COALESCE($3,address),
     allow_negative_stock=COALESCE($4,allow_negative_stock), ops_budget=COALESCE($5,ops_budget) WHERE id=$1`,
    [req.ctx!.businessId, b.name ?? null, b.address ?? null, b.allowNegativeStock ?? null, b.opsBudget ?? null]);
  audit(req.ctx!, "business.update", b);
  res.json({ ok: true });
});

r.get("/users", requireRole("owner"), async (req, res) => {
  res.json({ users: await q(
    `SELECT u.id,u.name,u.email,m.role FROM business_members m JOIN users u ON u.id=m.user_id
     WHERE m.business_id=$1 ORDER BY m.created_at`, [req.ctx!.businessId]) });
});

r.post("/users", requireRole("owner"), async (req, res) => {
  const b = parse(userInviteSchema, req.body);
  const existing = await q("SELECT id FROM users WHERE email=$1", [b.email]);
  if (existing[0]) throw new HttpError(409, "Email sudah dipakai akun lain.");
  const hash = await bcrypt.hash(b.password, 10);
  const [u] = await q("INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id", [b.name, b.email, hash]);
  await q("INSERT INTO business_members (business_id,user_id,role) VALUES ($1,$2,$3)", [req.ctx!.businessId, u.id, b.role]);
  audit(req.ctx!, "user.add", { email: b.email, role: b.role });
  res.status(201).json({ ok: true });
});

export default r;
