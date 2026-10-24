import argon2 from "argon2";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

export const hashPassword = (p: string) =>
  argon2.hash(p, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p).catch(() => false);

/** Opaque random token; only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const key = () => Buffer.from(config.BYOK_ENCRYPTION_KEY, "hex");

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { ciphertext, iv, authTag: c.getAuthTag() };
}

/** Server-side only, for future remote providers. Never returned to clients. */
export function decryptSecret(ciphertext: Buffer, iv: Buffer, authTag: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(authTag);
  return Buffer.concat([d.update(ciphertext), d.final()]).toString("utf8");
}
