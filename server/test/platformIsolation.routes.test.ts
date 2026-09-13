import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db } from "../src/db/index";
import { platformAdmins, tailors } from "../src/db/schema/index";
import { hashPassword, issueToken } from "../src/services/auth.service";
import { createTenantWithUser } from "./helpers/catalog-test-auth";

/**
 * PHASE_11_TASKS.md Workstream H Group 0 — comprehensive actor-isolation sweep.
 *
 * Two directions, both live (real HTTP requests against the real running app), neither
 * mocked:
 *
 * (a) A `platform_admin` token against one representative route from each of the ~22 route
 *     files Wave 2 touched — a write route (`requirePermission`/`requireTailorActor`-gated)
 *     where the file has one, else the file's own `authenticate`-only "open read" route
 *     (proving `withTenant`'s 403-not-500 fix, A1). Every case must clean 403 with
 *     `error.code === "FORBIDDEN"`, never a 500 (a raw `Error` thrown by a null-tenant-id
 *     query would otherwise surface as one).
 *
 * (b) `user` and `tailor` tokens against every gated `/api/platform/*` route (login and the
 *     public tenant-request submission excepted — both are deliberately unauthenticated/
 *     actor-agnostic) — both must clean 403.
 *
 * Route bodies are deliberately minimal/empty: every gate under test here
 * (`requirePermission`/`requireTailorActor`/`requirePlatformAdmin`) runs *before*
 * `validateBody` in every route's middleware chain (confirmed by reading each file), so an
 * empty or malformed body never masks the actor-type check under test — a 403 here can only
 * mean the actor-type gate itself fired, not an incidental validation failure.
 */
describe("Platform actor-isolation sweep (PHASE_11_TASKS.md Workstream H Group 0)", () => {
  let server: Server;
  let baseUrl: string;

  let staff: Awaited<ReturnType<typeof createTenantWithUser>>;
  let userToken: string;
  let tailorToken: string;
  let tailorId: string;
  let platformAdminId: string;
  let platformAdminToken: string;

  async function request(method: string, path: string, token: string, body?: unknown) {
    const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
    if (body !== undefined) {
      init.headers = { ...init.headers, "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, init);
    const parsed = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    return { status: res.status, code: parsed?.error?.code };
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    staff = await createTenantWithUser([]);
    userToken = staff.token;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId: staff.tenantId, name: "Isolation Tailor", username: `iso-tailor-${randomUUID()}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;
    tailorToken = issueToken({ sub: tailorId, tenantId: staff.tenantId, actorType: "tailor" });

    const [admin] = await db
      .insert(platformAdmins)
      .values({ name: "Isolation Platform Admin", email: `iso-admin-${randomUUID()}@example.com`, username: `iso-admin-${randomUUID()}`, passwordHash })
      .returning();
    if (!admin) throw new Error("Failed to create test platform admin");
    platformAdminId = admin.id;
    platformAdminToken = issueToken({ sub: platformAdminId, tenantId: null, actorType: "platform_admin" });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
    await db.delete(platformAdmins).where(eq(platformAdmins.id, platformAdminId));
    await staff.cleanup();
  });

  describe("(a) platform_admin token against one representative route per tenant/tailor route file", () => {
    const id = randomUUID();

    const cases: Array<{ file: string; method: string; path: string; body?: unknown; gate: string }> = [
      { file: "customers.routes.ts", method: "DELETE", path: `/api/customers/${id}`, gate: "requirePermission" },
      { file: "orders.routes.ts", method: "POST", path: `/api/orders/${id}/pdf`, gate: "requirePermission" },
      { file: "invoices.routes.ts", method: "POST", path: `/api/invoices/${id}/send-email`, gate: "requirePermission" },
      { file: "features.routes.ts", method: "DELETE", path: `/api/features/${id}`, gate: "requirePermission" },
      { file: "payroll.routes.ts", method: "POST", path: `/api/tailors/${id}/advances`, body: {}, gate: "requirePermission" },
      { file: "manufacturing.routes.ts", method: "POST", path: `/api/manufacturing/jobs/${id}/complete`, gate: "requirePermission" },
      { file: "roles.routes.ts", method: "DELETE", path: `/api/roles/${id}`, gate: "requirePermission" },
      { file: "users.routes.ts", method: "DELETE", path: `/api/users/${id}`, gate: "requirePermission" },
      { file: "tailors.routes.ts", method: "DELETE", path: `/api/tailors/${id}`, gate: "requirePermission" },
      { file: "tenantSettings.routes.ts", method: "PATCH", path: "/api/invoice-settings", body: {}, gate: "requirePermission" },
      {
        file: "measurementProfiles.routes.ts",
        method: "GET",
        path: `/api/customers/${id}/measurement-profiles/${id}`,
        gate: "withTenant (open-read, authenticate only)",
      },
      { file: "retailers.routes.ts", method: "DELETE", path: `/api/retailers/${id}`, gate: "requirePermission" },
      { file: "superProducts.routes.ts", method: "DELETE", path: `/api/super-products/${id}`, gate: "requirePermission" },
      { file: "processes.routes.ts", method: "DELETE", path: `/api/processes/${id}`, gate: "requirePermission" },
      { file: "products.routes.ts", method: "DELETE", path: `/api/products/${id}`, gate: "requirePermission" },
      { file: "measurements.routes.ts", method: "DELETE", path: `/api/measurement-definitions/${id}`, gate: "requirePermission" },
      { file: "fittings.routes.ts", method: "DELETE", path: `/api/fittings/${id}`, gate: "requirePermission" },
      { file: "shipping.routes.ts", method: "POST", path: `/api/shipping-boxes/${id}/close`, gate: "requirePermission" },
      { file: "extra-payments.routes.ts", method: "DELETE", path: `/api/jobs/${id}/extra-payments/${id}`, gate: "requirePermission" },
      { file: "extraPaymentCategories.routes.ts", method: "DELETE", path: `/api/extra-payment-categories/${id}`, gate: "requirePermission" },
      { file: "order-groups.routes.ts", method: "POST", path: "/api/order-groups", body: {}, gate: "requirePermission" },
      { file: "tailorPortal.routes.ts", method: "POST", path: `/api/tailor-portal/jobs/${id}/complete`, gate: "requireTailorActor" },
    ];

    it("covers one route from every route file Wave 2's tsc fallout touched (22 files)", () => {
      const distinctFiles = new Set(cases.map((c) => c.file));
      expect(distinctFiles.size).toBe(22);
    });

    for (const testCase of cases) {
      it(`${testCase.file} — ${testCase.method} ${testCase.path} (${testCase.gate}) -> 403 FORBIDDEN, not 500`, async () => {
        const result = await request(testCase.method, testCase.path, platformAdminToken, testCase.body);
        expect(result.status).toBe(403);
        expect(result.code).toBe("FORBIDDEN");
      });
    }
  });

  describe("(b) user/tailor tokens against every gated /api/platform/* route", () => {
    const id = randomUUID();

    const platformRoutes: Array<{ method: string; path: string; body?: unknown }> = [
      { method: "GET", path: "/api/platform/tenant-requests" },
      { method: "GET", path: `/api/platform/tenant-requests/${id}` },
      { method: "POST", path: `/api/platform/tenant-requests/${id}/approve`, body: {} },
      { method: "POST", path: `/api/platform/tenant-requests/${id}/reject`, body: { reason: "test" } },
      { method: "GET", path: "/api/platform/tenants" },
      { method: "PATCH", path: `/api/platform/tenants/${id}`, body: { isActive: true } },
    ];

    for (const route of platformRoutes) {
      it(`user token: ${route.method} ${route.path} -> 403 FORBIDDEN`, async () => {
        const result = await request(route.method, route.path, userToken, route.body);
        expect(result.status).toBe(403);
        expect(result.code).toBe("FORBIDDEN");
      });

      it(`tailor token: ${route.method} ${route.path} -> 403 FORBIDDEN`, async () => {
        const result = await request(route.method, route.path, tailorToken, route.body);
        expect(result.status).toBe(403);
        expect(result.code).toBe("FORBIDDEN");
      });
    }
  });
});
