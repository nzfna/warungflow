import { Router } from "express";
import { closingSchema } from "@warungflow/shared";
import { HttpError, audit, requireRole } from "../auth";
import { q, qc, tx } from "../db";
import { fundsSummary, localDate, lockBusiness, parse } from "../lib";

const r = Router();

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // Asia/Jakarta (UTC+7)

async function summary(businessId: string, from: string, to: string) {
  const [s] = await q(
    `SELECT COALESCE(SUM(total),0) AS omzet, COALESCE(SUM(cogs),0) AS hpp, COUNT(*)::int AS trx
     FROM sales WHERE business_id=$1 AND kind='external' AND status='completed' AND ${localDate("created_at")} BETWEEN $2 AND $3`, [businessId, from, to]);
  const [i] = await q(
    `SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(cogs),0) AS hpp, COUNT(*)::int AS trx
     FROM sales WHERE business_id=$1 AND kind='internal' AND status='completed' AND ${localDate("created_at")} BETWEEN $2 AND $3`, [businessId, from, to]);
  const [e] = await q("SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE business_id=$1 AND spent_on BETWEEN $2 AND $3", [businessId, from, to]);
  const [l] = await q(
    `SELECT COALESCE(SUM(-quantity*unit_cost),0) AS total FROM stock_movements
     WHERE business_id=$1 AND type IN ('damaged','expired','lost') AND ${localDate("created_at")} BETWEEN $2 AND $3`, [businessId, from, to]);
  const [cf] = await q(
    `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount END),0) AS cash_in, COALESCE(SUM(CASE WHEN direction='out' THEN amount END),0) AS cash_out
     FROM cash_transactions WHERE business_id=$1 AND ref_type<>'opening' AND ${localDate("created_at")} BETWEEN $2 AND $3`, [businessId, from, to]);
  const [pay] = await q("SELECT COALESCE(SUM(amount),0) AS total FROM cash_transactions WHERE business_id=$1 AND ref_type IN ('salary','withdrawal') AND " + localDate("created_at") + " BETWEEN $2 AND $3", [businessId, from, to]);
  const gross = Number(s.omzet) - Number(s.hpp);
  return {
    from, to, omzet: Number(s.omzet), hpp: Number(s.hpp), grossProfit: gross, transactions: s.trx,
    expenses: Number(e.total), losses: Number(l.total), netProfit: gross - Number(e.total) - Number(l.total),
    internal: { total: Number(i.total), hpp: Number(i.hpp), transactions: i.trx },
    cashIn: Number(cf.cash_in), cashOut: Number(cf.cash_out), ownerPayouts: Number(pay.total),
  };
}

r.get("/summary", requireRole("owner", "admin"), async (req, res) => {
  const from = (req.query.from as string) || today().slice(0, 8) + "01";
  const to = (req.query.to as string) || today();
  const bid = req.ctx!.businessId;
  const s = await summary(bid, from, to);
  const daily = await q(
    `SELECT d::date::text AS date,
       COALESCE((SELECT SUM(total) FROM sales WHERE business_id=$1 AND kind='external' AND status='completed' AND ${localDate("created_at")}=d::date),0) AS sales,
       COALESCE((SELECT SUM(amount) FROM expenses WHERE business_id=$1 AND spent_on=d::date),0) AS expenses
     FROM generate_series($2::date,$3::date,'1 day') d ORDER BY d LIMIT 92`, [bid, from, to]);
  const [inv] = await q("SELECT COALESCE(SUM(GREATEST(stock,0)*cost_price),0) AS v FROM products WHERE business_id=$1 AND active", [bid]);
  const [pay] = await q("SELECT COALESCE(SUM(total-paid),0) AS v FROM purchases WHERE business_id=$1", [bid]);
  const byCategory = await q("SELECT category, SUM(amount) AS total FROM expenses WHERE business_id=$1 AND spent_on BETWEEN $2 AND $3 GROUP BY category ORDER BY total DESC", [bid, from, to]);
  const top = await q(
    `SELECT si.product_name AS name, SUM(si.quantity) AS qty, SUM(si.quantity*si.unit_price) AS revenue
     FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.business_id=$1 AND s.kind='external' AND s.status='completed' AND ${localDate("s.created_at")} BETWEEN $2 AND $3
     GROUP BY si.product_name ORDER BY revenue DESC LIMIT 10`, [bid, from, to]);
  res.json({ ...s, daily, inventoryValue: Number(inv.v), supplierPayable: Number(pay.v), expensesByCategory: byCategory, topProducts: top });
});

r.get("/dashboard", async (req, res) => {
  const bid = req.ctx!.businessId;
  const role = req.ctx!.role;
  const t = today();
  const s = await summary(bid, t, t);
  const funds = await tx((c) => fundsSummary(c, bid));
  const low = await q("SELECT id,name,stock,min_stock,unit FROM products WHERE business_id=$1 AND active AND stock <= min_stock ORDER BY stock LIMIT 6", [bid]);
  const bills = await q(
    `SELECT p.id,p.number,s.name AS supplier,(p.total-p.paid) AS remaining,p.due_date FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.business_id=$1 AND p.total>p.paid ORDER BY p.due_date NULLS LAST LIMIT 5`, [bid]);
  const trend = await q(
    `SELECT d::date::text AS date, COALESCE((SELECT SUM(total) FROM sales WHERE business_id=$1 AND kind='external' AND status='completed' AND ${localDate("created_at")}=d::date),0) AS sales
     FROM generate_series(($2::date - 6),$2::date,'1 day') d ORDER BY d`, [bid, t]);
  const recent = await q(
    `SELECT number,kind,total,payment_method,status,created_at FROM sales WHERE business_id=$1 ORDER BY created_at DESC LIMIT 6`, [bid]);
  const [{ n }] = await q("SELECT COUNT(*)::int AS n FROM products WHERE business_id=$1 AND active", [bid]);
  const body: any = { date: t, sales: s.omzet, transactions: s.transactions, productCount: n, lowStock: low, recentSales: recent, trend };
  if (role !== "kasir") {
    Object.assign(body, { grossProfit: s.grossProfit, expensesToday: s.expenses, cashBalance: funds.totalFunds, wallets: funds.wallets, unallocated: funds.unallocated, bills });
  }
  res.json(body);
});

/* ---------- Tutup buku ---------- */
async function closingPreview(c: any, bid: string, date: string) {
  const [prev] = await qc(c,
    `SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) AS b FROM cash_transactions
     WHERE business_id=$1 AND method='cash' AND ${localDate("created_at")} < $2`, [bid, date]);
  const [d] = await qc(c,
    `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount END),0) AS cin, COALESCE(SUM(CASE WHEN direction='out' THEN amount END),0) AS cout
     FROM cash_transactions WHERE business_id=$1 AND method='cash' AND ${localDate("created_at")} = $2`, [bid, date]);
  const opening = Number(prev.b), cin = Number(d.cin), cout = Number(d.cout);
  return { date, openingCash: opening, cashIn: cin, cashOut: cout, expectedCash: opening + cin - cout };
}

r.get("/closings/preview", requireRole("owner", "admin", "kasir"), async (req, res) => {
  const date = (req.query.date as string) || today();
  const p = await tx((c) => closingPreview(c, req.ctx!.businessId, date));
  const [done] = await q("SELECT id,actual_cash,difference,note FROM daily_closings WHERE business_id=$1 AND closing_date=$2", [req.ctx!.businessId, date]);
  res.json({ ...p, closed: done ?? null });
});

r.get("/closings", requireRole("owner", "admin"), async (req, res) => {
  res.json({ closings: await q(
    `SELECT id,closing_date,opening_cash,cash_in,cash_out,expected_cash,actual_cash,difference,note FROM daily_closings WHERE business_id=$1 ORDER BY closing_date DESC LIMIT 60`, [req.ctx!.businessId]) });
});

r.post("/closings", requireRole("owner"), async (req, res) => {
  const b = parse(closingSchema, req.body);
  const ctx = req.ctx!;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const exists = await qc(c, "SELECT 1 FROM daily_closings WHERE business_id=$1 AND closing_date=$2", [ctx.businessId, b.date]);
    if (exists[0]) throw new HttpError(409, "Tanggal ini sudah ditutup.");
    const p = await closingPreview(c, ctx.businessId, b.date);
    const diff = b.actualCash - p.expectedCash;
    if (diff !== 0 && !b.note) throw new HttpError(400, "Ada selisih kas. Isi catatan penyebabnya.");
    await qc(c,
      `INSERT INTO daily_closings (business_id,closing_date,opening_cash,cash_in,cash_out,expected_cash,actual_cash,difference,note,closed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [ctx.businessId, b.date, p.openingCash, p.cashIn, p.cashOut, p.expectedCash, b.actualCash, diff, b.note ?? null, ctx.userId]);
  });
  audit(ctx, "closing.create", b);
  res.status(201).json({ ok: true });
});

export default r;
