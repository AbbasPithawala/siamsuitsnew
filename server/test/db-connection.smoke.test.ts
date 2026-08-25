import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { env } from "../src/config/env";

/**
 * Deliberately the only test in Phase 1 — proves the schema/migration/DB setup works
 * end to end. Real coverage (order/manufacturing/payroll flows) starts once there's
 * business logic to test, per PHASE_1_TASKS.md's testing-foundation note.
 */
describe("database connection", () => {
  it("connects to Postgres and can run a trivial query", async () => {
    const sql = postgres(env.DATABASE_URL, { max: 1 });
    try {
      const result = await sql`select 1 as ok`;
      expect(result[0]?.ok).toBe(1);
    } finally {
      await sql.end();
    }
  });
});
