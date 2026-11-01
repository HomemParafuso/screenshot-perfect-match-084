import { beforeEach, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { demoRequest, endDemoSession, hasDemoSession, loginDemo } from "@/lib/demo-api";

beforeEach(() => { sessionStorage.clear(); Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true }); });
describe("isolated demo access", () => {
  it("accepts the requested admin test credentials", async () => {
    await loginDemo("admin@hasi.test", "admin102030");
    expect(hasDemoSession()).toBe(true);
    expect((await demoRequest("/me")).is_admin).toBe(true);
  });
  it("rejects a wrong password", async () => {
    await expect(loginDemo("admin@hasi.test", "wrong-password")).rejects.toMatchObject({ status: 401 });
    expect(hasDemoSession()).toBe(false);
  });
  it("requires a demo session and revokes it on logout", async () => {
    await expect(demoRequest("/admin/stats")).rejects.toMatchObject({ status: 401 });
    await loginDemo("admin@hasi.test", "admin102030");
    endDemoSession();
    await expect(demoRequest("/admin/stats")).rejects.toMatchObject({ status: 401 });
  });
  it("saves simulated plan edits without touching real session storage", async () => {
    localStorage.setItem("hasi.refresh", "real-session-placeholder");
    await loginDemo("admin@hasi.test", "admin102030");
    const plan = await demoRequest("/admin/plans", { method: "POST", body: JSON.stringify({ name: "Test", code: "test", monthly_price_cents: 5000, currency: "BRL" }) });
    expect((await demoRequest("/admin/plans")).find((p: { id: string }) => p.id === plan.id)?.monthly_price_cents).toBe(5000);
    expect(localStorage.getItem("hasi.refresh")).toBe("real-session-placeholder");
  });
});