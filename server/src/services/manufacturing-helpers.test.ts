import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/index";
import { processes, tailorProcesses, tailors, tenants } from "../db/schema/index";
import { withTenant } from "../db/withTenant";
import { HttpError } from "../utils/http-error";
import { hashPassword } from "./auth.service";
import { requireTailor } from "./manufacturing-helpers";

const suffix = randomUUID();

describe("tailor_processes", () => {
  let tenantId: string;
  let tailorId: string;
  let processAId: string;
  let processBId: string;

  beforeAll(async () => {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, "siam-suits") });
    if (!tenant) throw new Error("Expected seeded 'siam-suits' tenant — run db:seed first");
    tenantId = tenant.id;

    const passwordHash = await hashPassword("irrelevant-for-this-test");
    const [tailor] = await db
      .insert(tailors)
      .values({ tenantId, name: "Test Tailor", username: `tailor-mfg-${suffix}`, passwordHash })
      .returning();
    if (!tailor) throw new Error("Failed to create test tailor");
    tailorId = tailor.id;

    const [processA] = await db
      .insert(processes)
      .values({ tenantId, name: `Stitching-${suffix}` })
      .returning();
    const [processB] = await db
      .insert(processes)
      .values({ tenantId, name: `Cutting-${suffix}` })
      .returning();
    if (!processA || !processB) throw new Error("Failed to create test processes");
    processAId = processA.id;
    processBId = processB.id;
  });

  afterAll(async () => {
    await db.delete(tailorProcesses).where(eq(tailorProcesses.tailorId, tailorId));
    await db.delete(processes).where(eq(processes.id, processAId));
    await db.delete(processes).where(eq(processes.id, processBId));
    await db.delete(tailors).where(eq(tailors.id, tailorId));
  });

  it("links a tailor to a process", async () => {
    await db.insert(tailorProcesses).values({ tailorId, processId: processAId });

    const rows = await db.query.tailorProcesses.findMany({
      where: (tp, { eq: eqOp }) => eqOp(tp.tailorId, tailorId),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.processId).toBe(processAId);
  });

  it("rejects linking the same tailor to the same process twice", async () => {
    await expect(db.insert(tailorProcesses).values({ tailorId, processId: processAId })).rejects.toThrow();
  });

  it("allows the same tailor to be linked to multiple different processes", async () => {
    await db.insert(tailorProcesses).values({ tailorId, processId: processBId });

    const rows = await db.query.tailorProcesses.findMany({
      where: (tp, { eq: eqOp }) => eqOp(tp.tailorId, tailorId),
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.processId).sort()).toEqual([processAId, processBId].sort());
  });

  it("requireTailor resolves an existing tailor", async () => {
    await withTenant(tenantId, async (tx) => {
      const tailor = await requireTailor(tx, tailorId);
      expect(tailor.id).toBe(tailorId);
    });
  });

  it("requireTailor throws 404 for a nonexistent tailor id", async () => {
    await withTenant(tenantId, async (tx) => {
      await expect(requireTailor(tx, randomUUID())).rejects.toThrow(HttpError);
    });
  });
});
