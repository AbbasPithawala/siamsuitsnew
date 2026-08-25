// @ts-nocheck -- Node-only DB helper for a live integration test, same
// rationale as `orders/testSupport/orderDbCleanup.ts`: this needs
// `node:fs`/`postgres` to write directly to `siam/server`'s own Postgres,
// which the browser-scoped tsconfig (src/**, DOM lib only, no @types/node)
// can't type-check. Vitest/Vite still execute this as plain JS at runtime
// regardless; only `tsc -b` skips it.
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadServerDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), "../server/.env");
  const contents = readFileSync(envPath, "utf-8");
  const match = contents.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error(`DATABASE_URL not found in ${envPath}`);
  }
  return match[1].trim();
}

/**
 * `PHASE_9_TASKS.md` Group 0 deliberately shipped no admin UI/API to toggle
 * `is_additional` on a feature (flagged as a Phase 8 Group 2/4 follow-up) —
 * `POST /api/features`'s `CreateFeatureInput` only accepts
 * `name`/`thaiName`/`type`/`processId`/`productIds`. `<FeatureSelector>`'s
 * live tests still need a real feature with `is_additional = true` to prove
 * the "Show Additional styles" toggle against genuine data (today's real
 * seeded catalog has zero such features — confirmed by inspection), so this
 * writes the flag directly, the same "connect straight to Postgres" escape
 * hatch `orders/testSupport/orderDbCleanup.ts` already established for a gap
 * of the same shape (no endpoint exists for what the test needs to set up).
 */
export async function setFeatureAdditionalFlag(featureId: string, isAdditional: boolean): Promise<void> {
  const sql = postgres(loadServerDatabaseUrl());
  try {
    await sql`update features set is_additional = ${isAdditional} where id = ${featureId}`;
  } finally {
    await sql.end();
  }
}
