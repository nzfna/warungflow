import { Router } from "express";
import { WALLET_KINDS, WalletKind, allocationSchema, expenseSchema, goalFundSchema, goalSchema, goalUseSchema, payoutSchema, transferSchema } from "@warungflow/shared";
import { HttpError, audit, requireAuth, requireBusiness, requireRole } from "../auth";
import { q, qc, tx } from "../db";
import { cashMove, fundsSummary, localDate, lockBusiness, parse, walletBalance, walletMove } from "../lib";

const r = Router();
r.use(requireAuth, requireBusiness);
const idr = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

/* ---------- Dompet ---------- */
r.get("/wallets", requireRole("owner", "admin"), async (req, res) => {
  const bid = req.ctx!.businessId;
  const f = await tx((c) => fundsSummary(c, bid));
  const month = await q<{ kind: string; inflow: number; outflow: number }>(
    `SELECT w.kind, COALESCE(SUM(CASE WHEN t.amount>0 THEN t.amount END),0) AS inflow, COALESCE(SUM(CASE WHEN t.amount<0 THEN -t.amount END),0) AS outflow
     FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id=w.id AND ${localDate("t.created_at")} >= date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date
     WHERE w.business_id=$1 GROUP BY w.kind`, [bid]);
  const [biz] = await q("SELECT ops_budget FROM businesses WHERE id=$1", [bid]);
  const [spent] = await q(
    `SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE business_id=$1 AND wallet_kind='operations' AND spent_on >= date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date`, [bid]);
  res.json({
    totalFunds: f.totalFunds, allocated: f.allocated, unallocated: f.unallocated,
    wallets: WALLET_KINDS.map((k) => {
      const m = month.find((x) => x.kind === k);
      return { kind: k, balance: f.wallets[k] ?? 0, inflowMonth: m?.inflow ?? 0, outflowMonth: m?.outflow ?? 0 };
    }),
    opsBudget: biz.ops_budget, opsSpentMonth: spent.s,
  });
});

r.get("/wallets/:kind/transactions", requireRole("owner", "admin"), async (req, res) => {
  if (!WALLET_KINDS.includes(req.params.kind as WalletKind)) throw new HttpError(404, "Dompet tidak ditemukan.");
  const rows = await q(
    `SELECT t.id,t.type,t.amount,t.note,t.created_at FROM wallet_transactions t JOIN wallets w ON w.id=t.wallet_id
     WHERE t.business_id=$1 AND w.kind=$2 ORDER BY t.created_at DESC LIMIT 100`, [req.ctx!.businessId, req.params.kind]);
  res.json({ transactions: rows });
});

// Alokasi manual: owner menentukan nominal; sistem hanya memvalidasi dana yang belum dialokasikan.
r.post("/wallets/allocate", requireRole("owner"), async (req, res) => {
  const b = parse(allocationSchema, req.body);
  const ctx = req.ctx!;
  const total = WALLET_KINDS.reduce((a, k) => a + b.amounts[k], 0);
  if (total <= 0) throw new HttpError(400, "Isi nominal alokasi minimal untuk satu dompet.");
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const f = await fundsSummary(c, ctx.businessId);
    if (total > f.unallocated) throw new HttpError(400, `Total alokasi ${idr(total)} melebihi dana yang belum dialokasikan (${idr(Math.max(0, f.unallocated))}).`);
    for (const k of WALLET_KINDS) if (b.amounts[k] > 0)
      await walletMove(c, { businessId: ctx.businessId, kind: k, amount: b.amounts[k], type: "allocation", note: b.basis, userId: ctx.userId });
    await qc(c, "INSERT INTO financial_allocations (business_id,basis,total,amounts,note,approved_by) VALUES ($1,$2,$3,$4,$5,$6)",
      [ctx.businessId, b.basis, total, b.amounts, b.note ?? null, ctx.userId]);
  });
  audit(ctx, "wallet.allocate", { total, basis: b.basis });
  res.status(201).json({ ok: true, total });
});

r.get("/wallets-allocations", requireRole("owner", "admin"), async (req, res) => {
  res.json({ allocations: await q("SELECT id,basis,total,amounts,note,created_at FROM financial_allocations WHERE business_id=$1 ORDER BY created_at DESC LIMIT 30", [req.ctx!.businessId]) });
});

r.post("/wallets/transfer", requireRole("owner"), async (req, res) => {
  const b = parse(transferSchema, req.body);
  if (b.from === b.to) throw new HttpError(400, "Pilih dua dompet yang berbeda.");
  const ctx = req.ctx!;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    if ((await walletBalance(c, ctx.businessId, b.from)) < b.amount) throw new HttpError(400, "Saldo dompet asal tidak cukup.");
    await walletMove(c, { businessId: ctx.businessId, kind: b.from, amount: -b.amount, type: "transfer_out", note: b.note, userId: ctx.userId });
    await walletMove(c, { businessId: ctx.businessId, kind: b.to, amount: b.amount, type: "transfer_in", note: b.note, userId: ctx.userId });
  });
  audit(ctx, "wallet.transfer", b);
  res.json({ ok: true });
});

// Gaji / penarikan owner: keluar dari Dompet Gaji Owner, bukan biaya operasional.
r.post("/wallets/payout", requireRole("owner"), async (req, res) => {
  const b = parse(payoutSchema, req.body);
  const ctx = req.ctx!;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const bal = await walletBalance(c, ctx.businessId, "owner");
    if (bal < b.amount) throw new HttpError(400, `Saldo Dompet Gaji Owner ${idr(bal)} tidak cukup.`);
    await walletMove(c, { businessId: ctx.businessId, kind: "owner", amount: -b.amount, type: b.kind, note: b.note, userId: ctx.userId });
    await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: b.amount, method: b.method, refType: b.kind, note: b.note, userId: ctx.userId });
  });
  audit(ctx, "owner.payout", b);
  res.json({ ok: true });
});

/* ---------- Pengeluaran ---------- */
r.get("/expenses", requireRole("owner", "admin"), async (req, res) => {
  const { from, to, category, wallet } = req.query as Record<string, string>;
  const params: any[] = [req.ctx!.businessId];
  let where = "WHERE e.business_id=$1";
  if (from) { params.push(from); where += ` AND e.spent_on >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND e.spent_on <= $${params.length}`; }
  if (category) { params.push(category); where += ` AND e.category=$${params.length}`; }
  if (wallet) { params.push(wallet); where += ` AND e.wallet_kind=$${params.length}`; }
  const rows = await q(`SELECT e.id,e.category,e.amount,e.spent_on,e.wallet_kind,e.method,e.note FROM expenses e ${where} ORDER BY e.spent_on DESC, e.created_at DESC LIMIT 200`, params);
  res.json({ expenses: rows, total: rows.reduce((a, x) => a + Number(x.amount), 0) });
});

r.post("/expenses", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(expenseSchema, req.body);
  const ctx = req.ctx!;
  if (b.walletKind === "growth" && ctx.role !== "owner") throw new HttpError(403, "Pengeluaran dari Dompet Tumbuh perlu izin owner.");
  if (b.walletKind === "owner") throw new HttpError(400, "Dompet Gaji Owner bukan untuk biaya usaha. Gunakan menu Gaji Owner.");
  const id = await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const bal = await walletBalance(c, ctx.businessId, b.walletKind);
    if (bal < b.amount) throw new HttpError(400, `Saldo dompet ${idr(bal)} tidak cukup untuk pengeluaran ${idr(b.amount)}.`);
    const [e] = await qc(c, "INSERT INTO expenses (business_id,category,amount,spent_on,wallet_kind,method,note,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [ctx.businessId, b.category, b.amount, b.spentOn, b.walletKind, b.method, b.note ?? null, ctx.userId]);
    await walletMove(c, { businessId: ctx.businessId, kind: b.walletKind, amount: -b.amount, type: "expense", note: b.category, refType: "expense", refId: e.id, userId: ctx.userId });
    await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: b.amount, method: b.method, refType: "expense", refId: e.id, note: b.category, userId: ctx.userId });
    return e.id as string;
  });
  res.status(201).json({ id });
});

/* ---------- Dana Tumbuh ---------- */
r.get("/goals", requireRole("owner", "admin"), async (req, res) => {
  res.json({ goals: await q("SELECT id,name,kind,target_amount,saved_amount,deadline FROM savings_goals WHERE business_id=$1 ORDER BY created_at", [req.ctx!.businessId]) });
});
r.post("/goals", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(goalSchema, req.body);
  const [g] = await q("INSERT INTO savings_goals (business_id,name,kind,target_amount,deadline) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [req.ctx!.businessId, b.name, b.kind, b.targetAmount, b.deadline || null]);
  res.status(201).json({ id: g.id });
});
// Menandai dana di Dompet Tumbuh untuk satu tujuan (tidak memindahkan uang)
r.post("/goals/:id/fund", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(goalFundSchema, req.body);
  await tx(async (c) => {
    await lockBusiness(c, req.ctx!.businessId);
    const bal = await walletBalance(c, req.ctx!.businessId, "growth");
    const [s] = await qc(c, "SELECT COALESCE(SUM(saved_amount),0) AS s FROM savings_goals WHERE business_id=$1", [req.ctx!.businessId]);
    if (Number(s.s) + b.amount > bal) throw new HttpError(400, `Saldo Dompet Tumbuh yang belum ditandai hanya ${idr(bal - Number(s.s))}.`);
    const upd = await qc(c, "UPDATE savings_goals SET saved_amount=saved_amount+$3 WHERE business_id=$1 AND id=$2 RETURNING id", [req.ctx!.businessId, req.params.id, b.amount]);
    if (!upd[0]) throw new HttpError(404, "Tujuan tidak ditemukan.");
  });
  res.json({ ok: true });
});
r.post("/goals/:id/use", requireRole("owner"), async (req, res) => {
  const b = parse(goalUseSchema, req.body);
  const ctx = req.ctx!;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const [g] = await qc(c, "SELECT name,saved_amount FROM savings_goals WHERE business_id=$1 AND id=$2 FOR UPDATE", [ctx.businessId, req.params.id]);
    if (!g) throw new HttpError(404, "Tujuan tidak ditemukan.");
    if (Number(g.saved_amount) < b.amount) throw new HttpError(400, "Dana tujuan ini tidak cukup.");
    await qc(c, "UPDATE savings_goals SET saved_amount=saved_amount-$2 WHERE id=$1", [req.params.id, b.amount]);
    await walletMove(c, { businessId: ctx.businessId, kind: "growth", amount: -b.amount, type: "goal_use", note: `${g.name}: ${b.note}`, userId: ctx.userId });
    await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: b.amount, method: "cash", refType: "goal_use", note: `${g.name}: ${b.note}`, userId: ctx.userId });
  });
  audit(ctx, "goal.use", { id: req.params.id, ...b });
  res.json({ ok: true });
});

export default r;
