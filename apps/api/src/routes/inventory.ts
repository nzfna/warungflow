import { Router } from "express";
import { z } from "zod";
import { categorySchema, productSchema, purchaseSchema, stockAdjustSchema, supplierPaymentSchema, supplierSchema } from "@warungflow/shared";
import { HttpError, audit, requireAuth, requireBusiness, requireRole } from "../auth";
import { q, qc, tx } from "../db";
import { cashMove, lockBusiness, nextNumber, parse, walletBalance, walletMove } from "../lib";

const r = Router();
r.use(requireAuth, requireBusiness);

/* ---------- Kategori ---------- */
r.get("/categories", async (req, res) => {
  res.json({ categories: await q("SELECT id,name FROM categories WHERE business_id=$1 ORDER BY name", [req.ctx!.businessId]) });
});
r.post("/categories", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(categorySchema, req.body);
  try {
    const [c] = await q("INSERT INTO categories (business_id,name) VALUES ($1,$2) RETURNING id,name", [req.ctx!.businessId, b.name]);
    res.status(201).json({ category: c });
  } catch { throw new HttpError(409, "Kategori sudah ada."); }
});

/* ---------- Produk ---------- */
const productSelect = `SELECT p.id,p.name,p.sku,p.unit,p.cost_price,p.sell_price,p.stock,p.min_stock,p.expiry_date,p.active,
  p.category_id, c.name AS category, p.supplier_id,
  CASE WHEN p.stock <= 0 THEN 'habis' WHEN p.stock <= p.min_stock THEN 'menipis' ELSE 'aman' END AS stock_status
  FROM products p LEFT JOIN categories c ON c.id=p.category_id`;

r.get("/products", async (req, res) => {
  const { q: search, category, status, active } = req.query as Record<string, string>;
  const params: any[] = [req.ctx!.businessId];
  let where = "WHERE p.business_id=$1";
  if (active !== "all") where += active === "false" ? " AND p.active=false" : " AND p.active=true";
  if (search) { params.push(`%${search}%`); where += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`; }
  if (category) { params.push(category); where += ` AND p.category_id=$${params.length}`; }
  if (status === "menipis") where += " AND p.stock > 0 AND p.stock <= p.min_stock";
  if (status === "habis") where += " AND p.stock <= 0";
  const rows = await q(`${productSelect} ${where} ORDER BY p.name LIMIT 500`, params);
  // Kasir tidak melihat harga modal
  if (req.ctx!.role === "kasir") rows.forEach((p) => delete (p as any).cost_price);
  res.json({ products: rows });
});

r.get("/products/:id", async (req, res) => {
  const [p] = await q(`${productSelect} WHERE p.business_id=$1 AND p.id=$2`, [req.ctx!.businessId, req.params.id]);
  if (!p) throw new HttpError(404, "Produk tidak ditemukan.");
  const movements = await q(
    `SELECT type,quantity,unit_cost,reason,created_at FROM stock_movements WHERE business_id=$1 AND product_id=$2 ORDER BY created_at DESC LIMIT 50`,
    [req.ctx!.businessId, req.params.id]);
  const prices = await q(`SELECT cost_price,sell_price,created_at FROM price_history WHERE product_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
  res.json({ product: p, movements, prices });
});

r.post("/products", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(productSchema, req.body);
  const id = await tx(async (c) => {
    const [p] = await qc(c,
      `INSERT INTO products (business_id,category_id,supplier_id,name,sku,unit,cost_price,sell_price,stock,min_stock,expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [req.ctx!.businessId, b.categoryId ?? null, b.supplierId ?? null, b.name, b.sku || null, b.unit, b.costPrice, b.sellPrice, b.stock, b.minStock, b.expiryDate || null]);
    await qc(c, "INSERT INTO price_history (product_id,cost_price,sell_price,changed_by) VALUES ($1,$2,$3,$4)", [p.id, b.costPrice, b.sellPrice, req.userId]);
    if (b.stock > 0)
      await qc(c, `INSERT INTO stock_movements (business_id,product_id,type,quantity,unit_cost,reason,created_by) VALUES ($1,$2,'initial',$3,$4,'Stok awal',$5)`,
        [req.ctx!.businessId, p.id, b.stock, b.costPrice, req.userId]);
    return p.id as string;
  });
  res.status(201).json({ id });
});

// Edit info produk. Stok TIDAK diubah di sini; pakai /adjust.
r.patch("/products/:id", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(productSchema.omit({ stock: true }).partial(), req.body);
  await tx(async (c) => {
    const [old] = await qc(c, "SELECT cost_price,sell_price FROM products WHERE business_id=$1 AND id=$2 FOR UPDATE", [req.ctx!.businessId, req.params.id]);
    if (!old) throw new HttpError(404, "Produk tidak ditemukan.");
    await qc(c,
      `UPDATE products SET name=COALESCE($3,name), sku=COALESCE($4,sku), unit=COALESCE($5,unit), cost_price=COALESCE($6,cost_price),
       sell_price=COALESCE($7,sell_price), min_stock=COALESCE($8,min_stock), category_id=COALESCE($9,category_id),
       supplier_id=COALESCE($10,supplier_id), expiry_date=COALESCE($11,expiry_date), updated_at=now() WHERE business_id=$1 AND id=$2`,
      [req.ctx!.businessId, req.params.id, b.name ?? null, b.sku ?? null, b.unit ?? null, b.costPrice ?? null, b.sellPrice ?? null,
       b.minStock ?? null, b.categoryId ?? null, b.supplierId ?? null, b.expiryDate ?? null]);
    if ((b.costPrice != null && b.costPrice !== Number(old.cost_price)) || (b.sellPrice != null && b.sellPrice !== Number(old.sell_price)))
      await qc(c, "INSERT INTO price_history (product_id,cost_price,sell_price,changed_by) VALUES ($1,$2,$3,$4)",
        [req.params.id, b.costPrice ?? old.cost_price, b.sellPrice ?? old.sell_price, req.userId]);
  });
  res.json({ ok: true });
});

r.post("/products/:id/archive", requireRole("owner", "admin"), async (req, res) => {
  const { active } = req.body as { active?: boolean };
  await q("UPDATE products SET active=$3, updated_at=now() WHERE business_id=$1 AND id=$2", [req.ctx!.businessId, req.params.id, active ?? false]);
  audit(req.ctx!, active ? "product.restore" : "product.archive", { id: req.params.id });
  res.json({ ok: true });
});

// Penyesuaian stok: opname / rusak / kedaluwarsa / hilang (wajib alasan, tercatat sebagai stock movement)
r.post("/products/:id/adjust", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(stockAdjustSchema, req.body);
  const result = await tx(async (c) => {
    const [p] = await qc(c, "SELECT stock,cost_price FROM products WHERE business_id=$1 AND id=$2 FOR UPDATE", [req.ctx!.businessId, req.params.id]);
    if (!p) throw new HttpError(404, "Produk tidak ditemukan.");
    let delta: number;
    if (b.type === "opname") {
      if (b.newStock == null) throw new HttpError(400, "Isi jumlah stok hasil hitung.");
      delta = b.newStock - Number(p.stock);
    } else {
      delta = -b.quantity;
      if (Number(p.stock) + delta < 0) throw new HttpError(400, "Jumlah melebihi stok yang tercatat.");
    }
    if (delta === 0) return { delta: 0 };
    await qc(c, "UPDATE products SET stock=stock+$3, updated_at=now() WHERE business_id=$1 AND id=$2", [req.ctx!.businessId, req.params.id, delta]);
    await qc(c, `INSERT INTO stock_movements (business_id,product_id,type,quantity,unit_cost,reason,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.ctx!.businessId, req.params.id, b.type, delta, p.cost_price, b.reason, req.userId]);
    return { delta, lossValue: delta < 0 && b.type !== "opname" ? Math.abs(delta) * Number(p.cost_price) : 0 };
  });
  audit(req.ctx!, "stock.adjust", { id: req.params.id, ...b });
  res.json(result);
});

/* ---------- Supplier ---------- */
r.get("/suppliers", async (req, res) => {
  const rows = await q(
    `SELECT s.id,s.name,s.phone,s.address,s.note,s.active,
       (SELECT COUNT(*)::int FROM purchases p WHERE p.supplier_id=s.id) AS purchase_count,
       COALESCE((SELECT SUM(total-paid) FROM purchases p WHERE p.supplier_id=s.id),0) AS payable
     FROM suppliers s WHERE s.business_id=$1 ORDER BY s.name`, [req.ctx!.businessId]);
  res.json({ suppliers: rows });
});
r.post("/suppliers", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(supplierSchema, req.body);
  const [s] = await q("INSERT INTO suppliers (business_id,name,phone,address,note) VALUES ($1,$2,$3,$4,$5) RETURNING id,name",
    [req.ctx!.businessId, b.name, b.phone ?? null, b.address ?? null, b.note ?? null]);
  res.status(201).json({ supplier: s });
});
r.patch("/suppliers/:id", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(supplierSchema.partial().extend({ active: z.boolean().optional() }), req.body);
  await q(`UPDATE suppliers SET name=COALESCE($3,name),phone=COALESCE($4,phone),address=COALESCE($5,address),note=COALESCE($6,note),active=COALESCE($7,active)
    WHERE business_id=$1 AND id=$2`, [req.ctx!.businessId, req.params.id, b.name ?? null, b.phone ?? null, b.address ?? null, b.note ?? null, (b as any).active ?? null]);
  res.json({ ok: true });
});

/* ---------- Pembelian ---------- */
r.get("/purchases", async (req, res) => {
  const rows = await q(
    `SELECT p.id,p.number,p.total,p.paid,(p.total-p.paid) AS remaining,p.due_date,p.created_at,s.name AS supplier,
       CASE WHEN p.total-p.paid<=0 THEN 'lunas' WHEN p.due_date IS NOT NULL AND p.due_date < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN 'jatuh_tempo' ELSE 'belum_lunas' END AS status
     FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.business_id=$1 ORDER BY p.created_at DESC LIMIT 100`, [req.ctx!.businessId]);
  res.json({ purchases: rows });
});

r.post("/purchases", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(purchaseSchema, req.body);
  const ctx = req.ctx!;
  const key = req.header("Idempotency-Key");
  const out = await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    if (key) {
      const prev = await qc(c, "SELECT response FROM idempotency_keys WHERE business_id=$1 AND key=$2", [ctx.businessId, key]);
      if (prev[0]) return prev[0].response;
    }
    const [sup] = await qc(c, "SELECT id FROM suppliers WHERE business_id=$1 AND id=$2", [ctx.businessId, b.supplierId]);
    if (!sup) throw new HttpError(404, "Supplier tidak ditemukan.");

    const subtotal = b.items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
    const total = Math.max(0, subtotal - b.discount + b.extraCost);
    if (b.paidAmount > total) throw new HttpError(400, "Pembayaran melebihi total pembelian.");
    if (b.paidAmount < total && !b.dueDate) throw new HttpError(400, "Isi tanggal jatuh tempo untuk sisa utang.");

    if (b.paidAmount > 0) {
      const bal = await walletBalance(c, ctx.businessId, "capital");
      if (bal < b.paidAmount) throw new HttpError(400, `Saldo Dompet Modal tidak cukup (tersedia Rp${Math.round(bal).toLocaleString("id-ID")}). Atur alokasi dulu.`);
    }
    const number = await nextNumber(c, "purchases", "PB", ctx.businessId);
    const [pur] = await qc(c,
      `INSERT INTO purchases (business_id,supplier_id,number,subtotal,discount,extra_cost,total,paid,due_date,note,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [ctx.businessId, b.supplierId, number, subtotal, b.discount, b.extraCost, total, b.paidAmount, b.dueDate || null, b.note ?? null, ctx.userId]);

    for (const it of b.items) {
      const [p] = await qc(c, "SELECT stock,cost_price FROM products WHERE business_id=$1 AND id=$2 FOR UPDATE", [ctx.businessId, it.productId]);
      if (!p) throw new HttpError(404, "Ada produk yang tidak ditemukan.");
      const oldStock = Math.max(0, Number(p.stock));
      const newCost = (oldStock * Number(p.cost_price) + it.quantity * it.unitCost) / (oldStock + it.quantity); // rata-rata tertimbang
      await qc(c, "INSERT INTO purchase_items (purchase_id,product_id,quantity,unit_cost) VALUES ($1,$2,$3,$4)", [pur.id, it.productId, it.quantity, it.unitCost]);
      await qc(c, "UPDATE products SET stock=stock+$3, cost_price=$4, updated_at=now() WHERE id=$1 AND business_id=$2", [it.productId, ctx.businessId, it.quantity, newCost]);
      await qc(c, `INSERT INTO stock_movements (business_id,product_id,type,quantity,unit_cost,ref_type,ref_id,created_by) VALUES ($1,$2,'purchase',$3,$4,'purchase',$5,$6)`,
        [ctx.businessId, it.productId, it.quantity, it.unitCost, pur.id, ctx.userId]);
    }
    if (b.paidAmount > 0) {
      await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: b.paidAmount, method: b.paymentMethod, refType: "purchase", refId: pur.id, note: number, userId: ctx.userId });
      await walletMove(c, { businessId: ctx.businessId, kind: "capital", amount: -b.paidAmount, type: "purchase", note: number, refType: "purchase", refId: pur.id, userId: ctx.userId });
    }
    const resp = { id: pur.id, number, total, paid: b.paidAmount, remaining: total - b.paidAmount };
    if (key) await qc(c, "INSERT INTO idempotency_keys (business_id,key,response) VALUES ($1,$2,$3)", [ctx.businessId, key, resp]);
    return resp;
  });
  res.status(201).json(out);
});

r.post("/purchases/:id/pay", requireRole("owner", "admin"), async (req, res) => {
  const b = parse(supplierPaymentSchema, req.body);
  const ctx = req.ctx!;
  await tx(async (c) => {
    await lockBusiness(c, ctx.businessId);
    const [p] = await qc(c, "SELECT id,number,total,paid FROM purchases WHERE business_id=$1 AND id=$2 FOR UPDATE", [ctx.businessId, req.params.id]);
    if (!p) throw new HttpError(404, "Pembelian tidak ditemukan.");
    const remaining = Number(p.total) - Number(p.paid);
    if (b.amount > remaining) throw new HttpError(400, `Pembayaran melebihi sisa utang (Rp${Math.round(remaining).toLocaleString("id-ID")}).`);
    const bal = await walletBalance(c, ctx.businessId, "capital");
    if (bal < b.amount) throw new HttpError(400, "Saldo Dompet Modal tidak cukup. Atur alokasi dulu.");
    await qc(c, "UPDATE purchases SET paid=paid+$2 WHERE id=$1", [p.id, b.amount]);
    await qc(c, "INSERT INTO supplier_payments (business_id,purchase_id,amount,method,note,created_by) VALUES ($1,$2,$3,$4,$5,$6)", [ctx.businessId, p.id, b.amount, b.method, b.note ?? null, ctx.userId]);
    await cashMove(c, { businessId: ctx.businessId, direction: "out", amount: b.amount, method: b.method, refType: "supplier_payment", refId: p.id, note: p.number, userId: ctx.userId });
    await walletMove(c, { businessId: ctx.businessId, kind: "capital", amount: -b.amount, type: "purchase", note: `Bayar utang ${p.number}`, refType: "supplier_payment", refId: p.id, userId: ctx.userId });
  });
  audit(ctx, "supplier.pay", { purchase: req.params.id, amount: b.amount });
  res.json({ ok: true });
});

export default r;
