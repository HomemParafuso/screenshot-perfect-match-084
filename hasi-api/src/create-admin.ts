// Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='...' node dist/create-admin.js
import { audit } from "./audit.js";
import { hashPassword } from "./crypto.js";
import { pool, tx } from "./db.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD (>= 12 chars) are required");
  process.exit(1);
}
const hash = await hashPassword(password);
const id = await tx(async (c) => {
  const u = await c.query(
    `INSERT INTO users (email, password_hash) VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [email, hash]);
  await c.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [u.rows[0].id]);
  await c.query(`INSERT INTO admin_roles (user_id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING`, [u.rows[0].id]);
  return u.rows[0].id;
});
await audit(null, "cli.admin.create", { actor: null, target: id });
console.log(`admin ready: ${email}`);
await pool.end();
