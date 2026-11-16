import { Router } from "express";
import { checkoutSchema } from "@warungflow/shared";
import { HttpError, audit, requireRole } from "../auth";
import { q, qc, tx } from "../db";
import { cashMove, lockBusiness, nextNumber, parse, walletBalance, walletMove, localDate } from "../lib";

const r = Router();

// Checkout kasir & belanja internal owner. Semua perubahan dalam satu transaksi DB.
r.post("/checkout", async (req, res) => {
  const b = parse(checkoutSchema, req.body);
  const ctx = req.ctx!;
  if (b.kind === "internal" && ctx.role !== "owner") throw new HttpError(403, "Belanja internal hanya untuk owner.");
  const key = req.header("Idempotency-Key");

  const out = await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    if (key) {
      const prev = await qc(c, "SELECT response FROM idempotency_keys WHERE business_id=$1 AND key=$2", [ctx.businessId, key]);
      if (prev[0]) return prev[0].response;
    }
    const [biz] = await qc(c, "SELECT allow_negative_stock FROM businesses WHERE id=$1", [ctx.businessId]);
    let subtotal = 0, cogs = 0;
    const lines: any[] = [];
    for (const it of b.items) {
      const [p] = await qc(c, "SELECT id,name,stock,cost_price,sell_price,active FROM products WHERE business_id=$1 AND id=$2 FOR UPDATE", [ctx.businessId, it.productId]);
      if (!p || !p.active) throw new HttpError(404, "Ada produk yang sudah tidak tersedia.");
      if (!biz.allow_negative_stock && Number(p.stock) < it.quantity)
        throw new HttpError(400, `Stok ${p.name} tinggal ${Number(p.stock)}.`);
      subtotal += Number(p.sell_price) * it.quantity;
      cogs += Number(p.cost_price) * it.quantity;
      lines.push({ ...p, quantity: it.quantity });
    }
    if (b.discount > subtotal) throw new HttpError(400, "Diskon melebihi subtotal.");
    const total = subtotal - b.discount;
    let received: number | null = null, change = 0;
    if (b.kind === "external" && b.paymentMethod === "cash") {
      received = b.received ?? total;
      if (received < total) throw new HttpError(400, "Uang diterima kurang dari total.");
      change = received - total;
    }
    const prefix = b.kind === "internal" ? "IN" : "PJ";
    const number = await nextNumber(c, "sales", prefix, ctx.businessId);
    const method = b.kind === "internal" && b.payFrom === "owner_wallet" ? "owner_wallet" : b.paymentMethod;

    const [sale] = await qc(c,
      `INSERT INTO sales (business_id,number,kind,subtotal,discount,total,cogs,payment_method,received,change_amount,pay_from,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [ctx.businessId, number, b.kind, subtotal, b.discount, total, cogs, method, received, change, b.kind === "internal" ? b.payFrom : "cash", ctx.userId]);

    for (const l of lines) {
      await qc(c, "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,unit_cost) VALUES ($1,$2,$3,$4,$5,$6)",
        [sale.id, l.id, l.name, l.quantity, l.sell_price, l.cost_price]);
      await qc(c, "UPDATE products SET stock=stock-$3, updated_at=now() WHERE id=$1 AND business_id=$2", [l.id, ctx.businessId, l.quantity]);
      await qc(c, `INSERT INTO stock_movements (business_id,product_id,type,quantity,unit_cost,ref_type,ref_id,created_by) VALUES ($1,$2,$3,$4,$5,'sale',$6,$7)`,
        [ctx.businessId, l.id, b.kind === "internal" ? "internal" : "sale", -l.quantity, l.cost_price, sale.id, ctx.userId]);
    }

    if (b.kind === "internal" && b.payFrom === "owner_wallet") {
      // pindah alokasi Dompet Gaji -> Dompet Modal; kas fisik tidak berubah (tidak dihitung sebagai omzet)
      const bal = await walletBalance(c, ctx.businessId, "owner");
      if (bal < total) throw new HttpError(400, "Saldo Dompet Gaji Owner tidak cukup.");
      await walletMove(c, { businessId: ctx.businessId, kind: "owner", amount: -total, type: "internal_purchase", note: number, refType: "sale", refId: sale.id, userId: ctx.userId });
      await walletMove(c, { businessId: ctx.businessId, kind: "capital", amount: total, type: "internal_purchase", note: `Belanja internal ${number}`, refType: "sale", refId: sale.id, userId: ctx.userId });
    } else {
      await cashMove(c, { businessId: ctx.businessId, direction: "in", amount: total, method: b.paymentMethod, refType: "sale", refId: sale.id, note: number, userId: ctx.userId });
    }
    const resp = { id: sale.id, number, total, change, received, kind: b.kind };
    if (key) await qc(c, "INSERT INTO idempotency_keys (business_id,key,response) VALUES ($1,$2,$3)", [ctx.businessId, key, resp]);
    return resp;
  });
  res.status(201).json(out);
});

r.get("/", async (req, res) => {
  const { from, to, method, kind, status } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const limit = 20;
  const params: any[] = [req.ctx!.businessId];
  let where = "WHERE s.business_id=$1";
  if (from) { params.push(from); where += ` AND ${localDate("s.created_at")} >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND ${localDate("s.created_at")} <= $${params.length}`; }
  if (method) { params.push(method); where += ` AND s.payment_method=$${params.length}`; }
  if (kind) { params.push(kind); where += ` AND s.kind=$${params.length}`; }
  if (status) { params.push(status); where += ` AND s.status=$${params.length}`; }
  const [{ count }] = await q(`SELECT COUNT(*)::int AS count FROM sales s ${where}`, params);
  params.push(limit, (page - 1) * limit);
  const rows = await q(
    `SELECT s.id,s.number,s.kind,s.status,s.total,s.payment_method,s.created_at,u.name AS cashier
     FROM sales s LEFT JOIN users u ON u.id=s.created_by ${where} ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ sales: rows, total: count, page, pageSize: limit });
});

r.get("/:id", async (req, res) => {
  const [s] = await q("SELECT * FROM sales WHERE business_id=$1 AND id=$2", [req.ctx!.businessId, req.params.id]);
  if (!s) throw new HttpError(404, "Transaksi tidak ditemukan.");
  const items = await q("SELECT product_name,quantity,unit_price FROM sale_items WHERE sale_id=$1", [s.id]);
  if (req.ctx!.role === "kasir") delete s.cogs;
  res.json({ sale: s, items });
});

// Pembatalan = transaksi pembalik, bukan hapus.
r.post("/:id/void", requireRole("owner", "admin"), async (req, res) => {
  const ctx = req.ctx!;
  const restock = req.body?.restock !== false;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const [s] = await qc(c, "SELECT * FROM sales WHERE business_id=$1 AND id=$2 FOR UPDATE", [ctx.businessId, req.params.id]);
    if (!s) throw new HttpError(404, "Transaksi tidak ditemukan.");
    if (s.status === "voided") throw new HttpError(409, "Transaksi ini sudah dibatalkan.");
    const items = await qc(c, "SELECT product_id,quantity,unit_cost FROM sale_items WHERE sale_id=$1", [s.id]);
    if (restock) for (const it of items) {
      await qc(c, "UPDATE products SET stock=stock+$3, updated_at=now() WHERE id=$1 AND business_id=$2", [it.product_id, ctx.businessId, it.quantity]);
      await qc(c, `INSERT INTO stock_movements (business_id,product_id,type,quantity,unit_cost,ref_type,ref_id,reason,created_by) VALUES ($1,$2,'sale_return',$3,$4,'sale',$5,'Pembatalan transaksi',$6)`,
        [ctx.businessId, it.product_id, it.quantity, it.unit_cost, s.id, ctx.userId]);
    }
    if (s.pay_from === "owner_wallet") {
      await walletMove(c, { businessId: ctx.businessId, kind: "capital", amount: -Number(s.total), type: "reversal", note: `Batal ${s.number}`, refType: "sale", refId: s.id, userId: ctx.userId });
      await walletMove(c, { businessId: ctx.businessId, kind: "owner", amount: Number(s.total), type: "reversal", note: `Batal ${s.number}`, refType: "sale", refId: s.id, userId: ctx.userId });
    } else {
      await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: Number(s.total), method: s.payment_method, refType: "sale_void", refId: s.id, note: `Batal ${s.number}`, userId: ctx.userId });
    }
    await qc(c, "UPDATE sales SET status='voided', voided_at=now(), voided_by=$2 WHERE id=$1", [s.id, ctx.userId]);
  });
  audit(ctx, "sale.void", { id: req.params.id });
  res.json({ ok: true });
});

export default r;
