import nodemailer from "nodemailer";
import { config } from "./config.js";

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  log: { warn: (m: string) => void },
) {
  if (!config.SMTP_HOST) {
    log.warn("SMTP_HOST not configured: password reset e-mail was not sent");
    return;
  }
  const t = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  await t.sendMail({ from: config.SMTP_FROM, to, subject, text });
}
