import { Pool, PoolClient, types } from "pg";

// NUMERIC & BIGINT -> number (rupiah dua desimal masih aman di rentang UMKM)
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
// DATE tetap string yyyy-mm-dd
types.setTypeParser(1082, (v) => v);

declare global { var __pgPool: Pool | undefined }

// Serverless: tiap instance fungsi punya pool sendiri, jadi jumlah koneksi
// dijaga kecil agar tidak menghabiskan kuota koneksi Neon. Selalu pakai URL
// pooled (-pooler).
export const pool: Pool =
  globalThis.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export const q = <T = any>(text: string, params: any[] = []) => pool.query(text, params).then((r) => r.rows as T[]);

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const qc = async <T = any>(c: PoolClient, text: string, params: any[] = []) =>
  (await c.query(text, params)).rows as T[];
