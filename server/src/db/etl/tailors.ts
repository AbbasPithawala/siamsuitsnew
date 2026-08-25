import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { withTenant } from "../withTenant";
import { tailors, tailorProcesses, processes } from "../schema/index";
import { hashPassword } from "../../services/auth.service";
import { getLegacyDb, idToString } from "./legacy-mongo";
import type { EtlDomainResult } from "./result";

/** `siamServer/admin/model/factoryModel/model.tailor.js` */
interface LegacyTailor {
  _id: unknown;
  firstname: string;
  lastname?: string;
  username?: string;
  password?: unknown;
  process_id?: unknown[];
  advancePayment?: number;
  isActive?: boolean;
}

interface LegacyProcess {
  _id: unknown;
  name: string;
}

/**
 * Idempotency: `tailors.username` is unique per `(tenantId, username)` — the real natural
 * key, same as `tailors.service.ts#createTailor` relies on.
 *
 * Legacy passwords are a raw `Number` (see `model.tailor.js`) — plaintext, not hashed. This
 * can't be carried forward as-is (`tailors.password_hash` is `NOT NULL` and expected to be a
 * real bcrypt hash everywhere else in the codebase). Every migrated tailor gets a fresh
 * random password hashed the normal way; the plaintext is logged once so the operator can
 * hand it to the tailor (or force a reset) — there is no safe way to "migrate" a legacy
 * plaintext numeric password into a proper hash without ever having it in memory anyway, and
 * this at least never persists the legacy value anywhere.
 */
export async function migrateTailors(tenantId: string): Promise<EtlDomainResult> {
  const db = await getLegacyDb();
  const legacyTailors = await db.collection<LegacyTailor>("tailors").find({}).toArray();
  const legacyProcesses = await db.collection<LegacyProcess>("processes").find({}).toArray();
  const legacyProcessById = new Map(legacyProcesses.map((p) => [idToString(p._id), p]));

  const result: EtlDomainResult = { domain: "tailors", found: legacyTailors.length, migrated: 0, skipped: [] };
  const generatedCredentials: { username: string; password: string }[] = [];

  for (const legacy of legacyTailors) {
    const legacyId = idToString(legacy._id) ?? "(no _id)";
    const username = legacy.username?.trim();
    if (!username) {
      result.skipped.push({ legacyId, reason: "missing username — cannot form the required unique (tenant, username) key" });
      continue;
    }

    const name = [legacy.firstname, legacy.lastname].filter(Boolean).join(" ").trim() || username;

    await withTenant(tenantId, async (tx) => {
      let tailor = await tx.query.tailors.findFirst({
        where: and(eq(tailors.tenantId, tenantId), eq(tailors.username, username)),
      });

      if (!tailor) {
        const generatedPassword = randomUUID();
        const passwordHash = await hashPassword(generatedPassword);
        [tailor] = await tx
          .insert(tailors)
          .values({
            tenantId,
            name,
            username,
            passwordHash,
            isActive: legacy.isActive ?? true,
            advanceBalance: String(legacy.advancePayment ?? 0),
          })
          .returning();
        if (!tailor) throw new Error(`ETL: failed to create tailor "${username}"`);
        generatedCredentials.push({ username, password: generatedPassword });
      }

      for (const legacyProcessId of legacy.process_id ?? []) {
        const legacyProcess = legacyProcessById.get(idToString(legacyProcessId));
        if (!legacyProcess) {
          result.skipped.push({
            legacyId: `${legacyId}/certification/${idToString(legacyProcessId)}`,
            reason: `tailor references process ${idToString(legacyProcessId)} which no longer exists in legacy Mongo`,
          });
          continue;
        }

        const process = await tx.query.processes.findFirst({
          where: and(eq(processes.tenantId, tenantId), eq(processes.name, legacyProcess.name), isNull(processes.deletedAt)),
        });
        if (!process) {
          result.skipped.push({
            legacyId: `${legacyId}/certification/${legacyProcess.name}`,
            reason: `no migrated process named "${legacyProcess.name}" found for tenant — certification skipped`,
          });
          continue;
        }

        const existingCert = await tx.query.tailorProcesses.findFirst({
          where: and(eq(tailorProcesses.tailorId, tailor.id), eq(tailorProcesses.processId, process.id)),
        });
        if (!existingCert) {
          await tx.insert(tailorProcesses).values({ tailorId: tailor.id, processId: process.id });
        }
      }
    });

    result.migrated++;
  }

  if (generatedCredentials.length > 0) {
    console.log(`  Generated fresh passwords for ${generatedCredentials.length} newly-migrated tailor(s) (legacy passwords were plaintext, not carried forward):`);
    for (const cred of generatedCredentials) console.log(`    ${cred.username}: ${cred.password}`);
  }

  return result;
}

export async function requireMigratedTailorId(tenantId: string, username: string): Promise<string | null> {
  return withTenant(tenantId, async (tx) => {
    const tailor = await tx.query.tailors.findFirst({
      where: and(eq(tailors.tenantId, tenantId), eq(tailors.username, username), isNull(tailors.deletedAt)),
    });
    return tailor?.id ?? null;
  });
}
