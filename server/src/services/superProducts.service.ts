import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { superProductComponents, superProducts } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { requireProduct, requireSuperProduct } from "./catalog-helpers";
import { omit } from "../utils/object";
import { toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

const MAX_COMPONENTS = 3;

export interface ComponentInput {
  productId: string;
  slotLabel: string;
  sequence?: number;
}

export interface CreateSuperProductInput {
  name: string;
  thaiName?: string;
  image?: string;
  components?: ComponentInput[];
}

export type UpdateSuperProductInput = Partial<Pick<CreateSuperProductInput, "name" | "thaiName" | "image">>;

async function withComponents(tx: Transaction, superProductId: string) {
  return tx.query.superProductComponents.findMany({
    where: eq(superProductComponents.superProductId, superProductId),
    orderBy: (c, { asc }) => asc(c.sequence),
    with: { product: true },
  });
}

export function createSuperProduct(tenantId: string, input: CreateSuperProductInput) {
  const components = input.components ?? [];
  if (components.length > MAX_COMPONENTS) {
    throw new HttpError(422, "TOO_MANY_COMPONENTS", `A super product can have at most ${MAX_COMPONENTS} components`);
  }

  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [superProduct] = await tx
          .insert(superProducts)
          .values({ tenantId, ...omit(input, ["components"]) })
          .returning();
        if (!superProduct) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create super product");

        for (const [index, component] of components.entries()) {
          await requireProduct(tx, component.productId);
          await tx.insert(superProductComponents).values({
            superProductId: superProduct.id,
            productId: component.productId,
            slotLabel: component.slotLabel,
            sequence: component.sequence ?? index + 1,
          });
        }

        return { ...superProduct, components: await withComponents(tx, superProduct.id) };
      },
      "SUPER_PRODUCT_NAME_TAKEN",
      `A super product named "${input.name}" already exists`
    )
  );
}

type SuperProductWithComponents = typeof superProducts.$inferSelect & { components: Awaited<ReturnType<typeof withComponents>> };

/**
 * Opt-in pagination (PHASE_10_TASKS.md Workstream C) — same dual-purpose-endpoint
 * reasoning as `products.service.ts#listProducts`: omitting `pagination` keeps returning
 * the full unpaginated list, for the order-builder's own unfiltered super-product picker.
 */
export function listSuperProducts(tenantId: string): Promise<SuperProductWithComponents[]>;
export function listSuperProducts(
  tenantId: string,
  pagination: PaginationParams
): Promise<{ data: SuperProductWithComponents[]; total: number }>;
export function listSuperProducts(tenantId: string, pagination?: PaginationParams) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(superProducts.deletedAt);

    if (!pagination) {
      const rows = await tx.query.superProducts.findMany({ where, orderBy: (sp, { asc }) => asc(sp.name) });
      return Promise.all(rows.map(async (row) => ({ ...row, components: await withComponents(tx, row.id) })));
    }

    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);
    const [rows, [countRow]] = await Promise.all([
      tx.query.superProducts.findMany({ where, orderBy: (sp, { asc }) => asc(sp.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(superProducts).where(where),
    ]);
    const data = await Promise.all(rows.map(async (row) => ({ ...row, components: await withComponents(tx, row.id) })));
    return { data, total: countRow?.count ?? 0 };
  });
}

export function getSuperProduct(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const superProduct = await requireSuperProduct(tx, id);
    return { ...superProduct, components: await withComponents(tx, id) };
  });
}

export function updateSuperProduct(tenantId: string, id: string, input: UpdateSuperProductInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        await requireSuperProduct(tx, id);
        const [updated] = await tx
          .update(superProducts)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(superProducts.id, id))
          .returning();
        return { ...updated, components: await withComponents(tx, id) };
      },
      "SUPER_PRODUCT_NAME_TAKEN",
      `A super product named "${input.name}" already exists`
    )
  );
}

export function softDeleteSuperProduct(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    await requireSuperProduct(tx, id);
    await tx.update(superProducts).set({ deletedAt: new Date() }).where(eq(superProducts.id, id));
  });
}

export function addComponent(tenantId: string, superProductId: string, input: ComponentInput) {
  return withTenant(tenantId, async (tx) => {
    await requireSuperProduct(tx, superProductId);
    await requireProduct(tx, input.productId);

    const existing = await tx.query.superProductComponents.findMany({
      where: eq(superProductComponents.superProductId, superProductId),
    });
    if (existing.length >= MAX_COMPONENTS) {
      throw new HttpError(422, "TOO_MANY_COMPONENTS", `A super product can have at most ${MAX_COMPONENTS} components`);
    }

    const nextSequence = existing.reduce((max, c) => Math.max(max, c.sequence), 0) + 1;
    await catchUniqueViolation(
      () =>
        tx.insert(superProductComponents).values({
          superProductId,
          productId: input.productId,
          slotLabel: input.slotLabel,
          sequence: input.sequence ?? nextSequence,
        }),
      "SEQUENCE_TAKEN",
      `Sequence ${input.sequence ?? nextSequence} is already used by another component of this super product`
    );

    return withComponents(tx, superProductId);
  });
}

export function updateComponent(
  tenantId: string,
  superProductId: string,
  componentId: string,
  input: Partial<ComponentInput>
) {
  return withTenant(tenantId, async (tx) => {
    await requireSuperProduct(tx, superProductId);
    const existing = await tx.query.superProductComponents.findFirst({
      where: and(eq(superProductComponents.id, componentId), eq(superProductComponents.superProductId, superProductId)),
    });
    if (!existing) throw new HttpError(404, "COMPONENT_NOT_FOUND", `Component ${componentId} not found`);

    if (input.productId) await requireProduct(tx, input.productId);

    await catchUniqueViolation(
      () => tx.update(superProductComponents).set(input).where(eq(superProductComponents.id, componentId)),
      "SEQUENCE_TAKEN",
      `Sequence ${input.sequence} is already used by another component of this super product`
    );

    return withComponents(tx, superProductId);
  });
}

export function removeComponent(tenantId: string, superProductId: string, componentId: string) {
  return withTenant(tenantId, async (tx) => {
    await requireSuperProduct(tx, superProductId);
    const existing = await tx.query.superProductComponents.findFirst({
      where: and(eq(superProductComponents.id, componentId), eq(superProductComponents.superProductId, superProductId)),
    });
    if (!existing) throw new HttpError(404, "COMPONENT_NOT_FOUND", `Component ${componentId} not found`);

    await tx.delete(superProductComponents).where(eq(superProductComponents.id, componentId));
  });
}
