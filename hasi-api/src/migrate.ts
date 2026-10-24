import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pool } from "./db.js";

/** Applies migrations/*.sql in order, each in a transaction, tracked in schema_migrations. */
export async function migrate(dir = join(process.cwd(), "migrations")) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT pg_advisory_lock(727001)`);
    await c.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Set(
      (await c.query(`SELECT name FROM schema_migrations`)).rows.map((r) => r.name),
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(join(dir, f), "utf8");
      await c.query("BEGIN");
      try {
        await c.query(sql);
        await c.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [f]);
        await c.query("COMMIT");
        console.log(`applied ${f}`);
      } catch (e) {
        await c.query("ROLLBACK");
        throw new Error(`migration ${f} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.query(`SELECT pg_advisory_unlock(727001)`).catch(() => {});
    c.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
