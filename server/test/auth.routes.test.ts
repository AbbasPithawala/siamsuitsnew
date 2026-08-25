import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

/**
 * Integration test against the real local dev Postgres database (via `env.DATABASE_URL`),
 * exercising the seeded admin user created by `npm run db:seed`. Run the seed before
 * running this suite.
 */
describe("POST /api/auth/login", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it("succeeds with the seeded admin's real credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: "siam-suits", username: "admin", password: "ChangeMe123!" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { token: string } };
    expect(typeof body.data.token).toBe("string");
    expect(body.data.token.split(".")).toHaveLength(3);
  });

  it("rejects a wrong password with 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: "siam-suits", username: "admin", password: "definitely-wrong" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a nonexistent user with 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: "siam-suits", username: "no-such-user", password: "whatever" }),
    });
    expect(res.status).toBe(401);
  });
});
