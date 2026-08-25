import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { products, superProductComponents, superProducts } from "../db/schema/index";
import { HttpError } from "../utils/http-error";
import { catchUniqueViolation } from "../utils/db-errors";
import { toLimitOffset } from "../utils/pagination";
import type { PaginationParams } from "../utils/pagination";

export interface CreateProductInput {
  name: string;
  thaiName?: string;
  description?: string;
  image?: string;
  measurementDiagramImage?: string;
}

export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * Every standalone product needs a matching super product to ever be
 * orderable — `order_items.superProductId` is the only thing the order
 * builder (and every downstream reader: manufacturing, invoicing, shipping)
 * ever points at. Rather than make every admin remember a separate "now go
 * create a matching super product" step, `createProduct` does it in the same
 * transaction, automatically. Shares `tx` (not a fresh `withTenant` call via
 * `superProducts.service.ts`'s own `createSuperProduct`) so this insert is
 * part of the same commit/rollback unit as the product itself — a repeat of
 * the nested-transaction staleness bug already found once in this codebase
 * (`features.service.ts`'s `setProductFeatures`) would otherwise be very
 * easy to reintroduce here.
 */
async function createSourceLinkedSuperProduct(
  tx: Transaction,
  tenantId: string,
  product: { id: string; name: string; thaiName: string | null; image: string | null }
) {
  const [superProduct] = await tx
    .insert(superProducts)
    .values({
      tenantId,
      name: product.name,
      thaiName: product.thaiName,
      image: product.image,
      sourceProductId: product.id,
    })
    .returning();
  if (!superProduct) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create the product's super product");
  await tx.insert(superProductComponents).values({
    superProductId: superProduct.id,
    productId: product.id,
    slotLabel: product.name,
    sequence: 1,
  });
}

export function createProduct(tenantId: string, input: CreateProductInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const [product] = await tx.insert(products).values({ tenantId, ...input }).returning();
        if (!product) throw new HttpError(500, "INTERNAL_ERROR", "Failed to create product");
        await createSourceLinkedSuperProduct(tx, tenantId, product);
        return product;
      },
      "PRODUCT_NAME_TAKEN",
      `A product named "${input.name}" already exists`
    )
  );
}

/**
 * Opt-in pagination (PHASE_10_TASKS.md Workstream C): called both by the admin
 * `ProductsPage` table (paginated) and the order-builder's own unfiltered product picker
 * (`useListProductsQuery()`, the literal same hook/endpoint, no distinguishing param) —
 * omitting `pagination` must keep returning the full unpaginated list exactly as before
 * this convention existed.
 */
export function listProducts(tenantId: string): Promise<(typeof products.$inferSelect)[]>;
export function listProducts(
  tenantId: string,
  pagination: PaginationParams
): Promise<{ data: (typeof products.$inferSelect)[]; total: number }>;
export function listProducts(tenantId: string, pagination?: PaginationParams) {
  return withTenant(tenantId, async (tx) => {
    const where = isNull(products.deletedAt);
    if (!pagination) {
      return tx.query.products.findMany({ where, orderBy: (p, { asc }) => asc(p.name) });
    }

    const { limit, offset } = toLimitOffset(pagination.page, pagination.pageSize);
    const [data, [countRow]] = await Promise.all([
      tx.query.products.findMany({ where, orderBy: (p, { asc }) => asc(p.name), limit, offset }),
      tx.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    return { data, total: countRow?.count ?? 0 };
  });
}

export async function getProduct(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const product = await tx.query.products.findFirst({ where: and(eq(products.id, id), isNull(products.deletedAt)) });
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Product ${id} not found`);
    return product;
  });
}

export async function updateProduct(tenantId: string, id: string, input: UpdateProductInput) {
  return withTenant(tenantId, (tx) =>
    catchUniqueViolation(
      async () => {
        const existing = await tx.query.products.findFirst({ where: and(eq(products.id, id), isNull(products.deletedAt)) });
        if (!existing) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Product ${id} not found`);

        const [updated] = await tx
          .update(products)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();

        // Keep the auto-created super product's name/component label in sync —
        // it stands in directly for this product, so a rename here that left
        // it showing the old name would be confusing, not a real distinction
        // worth preserving.
        if (updated && input.name !== undefined) {
          const linkedSuperProduct = await tx.query.superProducts.findFirst({
            where: and(eq(superProducts.sourceProductId, id), isNull(superProducts.deletedAt)),
          });
          if (linkedSuperProduct) {
            await tx
              .update(superProducts)
              .set({ name: updated.name, thaiName: updated.thaiName, image: updated.image, updatedAt: new Date() })
              .where(eq(superProducts.id, linkedSuperProduct.id));
            await tx
              .update(superProductComponents)
              .set({ slotLabel: updated.name })
              .where(eq(superProductComponents.superProductId, linkedSuperProduct.id));
          }
        }

        return updated;
      },
      "PRODUCT_NAME_TAKEN",
      `A product named "${input.name}" already exists`
    )
  );
}

export async function softDeleteProduct(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.query.products.findFirst({ where: and(eq(products.id, id), isNull(products.deletedAt)) });
    if (!existing) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Product ${id} not found`);

    await tx.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));

    const linkedSuperProduct = await tx.query.superProducts.findFirst({
      where: and(eq(superProducts.sourceProductId, id), isNull(superProducts.deletedAt)),
    });
    if (linkedSuperProduct) {
      await tx.update(superProducts).set({ deletedAt: new Date() }).where(eq(superProducts.id, linkedSuperProduct.id));
    }
  });
}
