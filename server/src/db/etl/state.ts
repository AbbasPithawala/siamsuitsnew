import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Most entities this ETL migrates have a real natural key on the Postgres side (retailer
 * `code`, tailor `username`, order `order_number`, extra-payment-category's
 * `(product,process,feature,style,name)` tuple, ...) — re-running the script just
 * re-resolves the same row instead of duplicating it, no separate tracking needed.
 *
 * `customers` is the one domain with no natural key at all on either side (legacy
 * Customers have no unique field beyond `_id`; the new `customers` table has none either
 * by design). Per `_shared.ts`'s convention, a `legacy_mongo_id` column is deliberately
 * not an option here (dropped for good in migration `0002_drop_legacy_mongo_id.sql`) — so
 * idempotency for this one domain is tracked in this small untracked JSON file instead,
 * scoped entirely to this ETL script and gitignored, never a schema column.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.resolve(__dirname, "./.state");
const STATE_FILE = path.join(STATE_DIR, "production-etl-map.json");

interface EtlState {
  customers: Record<string, string>;
}

function emptyState(): EtlState {
  return { customers: {} };
}

export function loadState(): EtlState {
  if (!existsSync(STATE_FILE)) return emptyState();
  const raw = readFileSync(STATE_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Partial<EtlState>;
  return { ...emptyState(), ...parsed };
}

export function saveState(state: EtlState): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}
