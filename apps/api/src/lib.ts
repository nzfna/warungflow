import { PoolClient } from "pg";
import { z, ZodSchema } from "zod";
import { HttpError } from "./auth";
import { qc } from "./db";
import type { WalletKind } from "@warungflow/shared";

export function parse<T>(schema: ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, i?.message || "Data tidak valid.");
  }
  return r.data;
}

export const TZ = "Asia/Jakarta";
export const localDate = (col: string) => `((${col}) AT TIME ZONE '${TZ}')::date`;

export async function walletId(c: PoolClient, businessId: string, kind: WalletKind) {
  const r = await qc<{ id: string }>(c, "SELECT id FROM wallets WHERE business_id=$1 AND kind=$2", [businessId, kind]);
  if (!r[0]) throw new HttpError(500, "Dompet belum dibuat.");
  return r[0].id;
}

export async function walletBalance(c: PoolClient, businessId: string, kind: WalletKind) {
  const r = await qc<{ b: number }>(c,
    `SELECT COALESCE(SUM(t.amount),0) AS b FROM wallet_transactions t JOIN wallets w ON w.id=t.wallet_id
     WHERE t.business_id=$1 AND w.kind=$2`, [businessId, kind]);
  return Number(r[0].b);
}

export async function lockBusiness(c: PoolClient, businessId: string) {
  // serialisasi transaksi keuangan per warung agar saldo tidak balapan
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [businessId]);
}

export async function walletMove(c: PoolClient, o: {
  businessId: string; kind: WalletKind; amount: number; type: string; note?: string | null;
  refType?: string; refId?: string; userId: string;
}) {
  const wid = await walletId(c, o.businessId, o.kind);
  await qc(c,
    `INSERT INTO wallet_transactions (business_id,wallet_id,type,amount,note,ref_type,ref_id,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o.businessId, wid, o.type, o.amount, o.note ?? null, o.refType ?? null, o.refId ?? null, o.userId]);
}

export async function cashMove(c: PoolClient, o: {
  businessId: string; direction: "in" | "out"; amount: number; method: string; refType: string; refId?: string; note?: string | null; userId: string;
}) {
  if (o.amount <= 0) return;
  await qc(c,
    `INSERT INTO cash_transactions (business_id,direction,amount,method,ref_type,ref_id,note,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o.businessId, o.direction, o.amount, o.method, o.refType, o.refId ?? null, o.note ?? null, o.userId]);
}

export async function nextNumber(c: PoolClient, table: "sales" | "purchases", prefix: string, businessId: string) {
  const r = await qc<{ n: number }>(c, `SELECT COUNT(*)::int + 1 AS n FROM ${table} WHERE business_id=$1`, [businessId]);
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${prefix}-${d}-${String(r[0].n).padStart(4, "0")}`;
}

// Total uang usaha (kas + rekening) vs total yang sudah masuk dompet
export async function fundsSummary(c: PoolClient, businessId: string) {
  const cash = await qc<{ b: number }>(c,
    `SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) AS b FROM cash_transactions WHERE business_id=$1`, [businessId]);
  const w = await qc<{ kind: WalletKind; b: number }>(c,
    `SELECT w.kind, COALESCE(SUM(t.amount),0) AS b FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id=w.id
     WHERE w.business_id=$1 GROUP BY w.kind`, [businessId]);
  const wallets = Object.fromEntries(w.map((x) => [x.kind, Number(x.b)])) as Record<WalletKind, number>;
  const allocated = Object.values(wallets).reduce((a, b) => a + b, 0);
  return { totalFunds: Number(cash[0].b), wallets, allocated, unallocated: Number(cash[0].b) - allocated };
}
