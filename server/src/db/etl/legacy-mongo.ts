import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Db, MongoClient, ObjectId } from "mongodb";

/**
 * Read-only connection to the legacy production Mongo database. This module must never
 * call an insert/update/delete/replace operation — everything downstream in `etl/` only
 * ever reads from `db.collection(...)`. Writes for the migration only ever go to the new
 * Postgres schema via `withTenant`, in the domain-specific `etl/*.ts` modules.
 *
 * `MONGOURL` isn't part of the new server's own `.env`/`env.ts` (nothing else in this
 * codebase needs it) — this loads it straight from the legacy `siamServer/.env` that
 * already holds it, so the production credential lives in exactly one place rather than
 * being duplicated across both stacks' env files.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyEnvPath = path.resolve(__dirname, "../../../../siamServer/.env");

function resolveMongoUrl(): string {
  if (process.env.MONGOURL) return process.env.MONGOURL;
  if (existsSync(legacyEnvPath)) {
    const result = loadDotenv({ path: legacyEnvPath });
    if (result.parsed?.MONGOURL) return result.parsed.MONGOURL;
  }
  throw new Error(
    `MONGOURL not found in process.env and no legacy .env at ${legacyEnvPath}. ` +
      "The production ETL needs read access to the legacy Mongo database."
  );
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getLegacyDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(resolveMongoUrl());
  await client.connect();
  db = client.db();
  return db;
}

export async function closeLegacyDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/** Mongo `_id`s show up as `ObjectId`, plain hex strings, or (rarely, in dirty legacy data) empty strings — normalize once, everywhere. */
export function idToString(id: unknown): string | null {
  if (id === null || id === undefined || id === "") return null;
  if (id instanceof ObjectId) return id.toHexString();
  return String(id);
}
