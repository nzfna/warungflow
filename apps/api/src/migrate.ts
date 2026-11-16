import "dotenv/config";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Migrasi selesai.");
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
