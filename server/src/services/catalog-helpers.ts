import type { Transaction } from "../db/withTenant";
import { HttpError } from "../utils/http-error";

/**
 * `products`, `super_products`, `processes`, `measurement_definitions`, and `features`
 * carry `tenant_id` and an RLS policy (see `0001_enable_row_level_security.sql`), so a
 * plain `tx.query.*.findFirst` scoped by `withTenant` already can't see another tenant's
 * row. `super_product_components`, `product_processes`, `product_measurements`,
 * `feature_products`, `styles`, and `style_options` are pure join/child tables with no
 * `tenant_id` of their own and deliberately excluded from RLS (scoped "transitively"
 * through their parent, per that migration's comment) — so anything that takes one of
 * their IDs from a request must resolve back to the RLS-protected parent to confirm
 * tenant ownership, or a request naming another tenant's row ID would succeed.
 */

export async function requireProduct(tx: Transaction, productId: string) {
  const product = await tx.query.products.findFirst({
    where: (p, { and, eq, isNull }) => and(eq(p.id, productId), isNull(p.deletedAt)),
  });
  if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", `Product ${productId} not found`);
  return product;
}

export async function requireSuperProduct(tx: Transaction, superProductId: string) {
  const superProduct = await tx.query.superProducts.findFirst({
    where: (sp, { and, eq, isNull }) => and(eq(sp.id, superProductId), isNull(sp.deletedAt)),
  });
  if (!superProduct) throw new HttpError(404, "SUPER_PRODUCT_NOT_FOUND", `Super product ${superProductId} not found`);
  return superProduct;
}

export async function requireProcess(tx: Transaction, processId: string) {
  const process = await tx.query.processes.findFirst({
    where: (p, { and, eq, isNull }) => and(eq(p.id, processId), isNull(p.deletedAt)),
  });
  if (!process) throw new HttpError(404, "PROCESS_NOT_FOUND", `Process ${processId} not found`);
  return process;
}

export async function requireMeasurementDefinition(tx: Transaction, measurementDefinitionId: string) {
  const definition = await tx.query.measurementDefinitions.findFirst({
    where: (m, { and, eq, isNull }) => and(eq(m.id, measurementDefinitionId), isNull(m.deletedAt)),
  });
  if (!definition) {
    throw new HttpError(404, "MEASUREMENT_DEFINITION_NOT_FOUND", `Measurement definition ${measurementDefinitionId} not found`);
  }
  return definition;
}

export async function requireFeature(tx: Transaction, featureId: string) {
  const feature = await tx.query.features.findFirst({
    where: (f, { and, eq, isNull }) => and(eq(f.id, featureId), isNull(f.deletedAt)),
  });
  if (!feature) throw new HttpError(404, "FEATURE_NOT_FOUND", `Feature ${featureId} not found`);
  return feature;
}

/** `styles` has no `tenant_id`; ownership is proven by resolving its feature through RLS. */
export async function requireStyle(tx: Transaction, styleId: string) {
  const style = await tx.query.styles.findFirst({
    where: (s, { and, eq, isNull }) => and(eq(s.id, styleId), isNull(s.deletedAt)),
  });
  if (!style) throw new HttpError(404, "STYLE_NOT_FOUND", `Style ${styleId} not found`);
  await requireFeature(tx, style.featureId);
  return style;
}

/** `style_options` has no `tenant_id` either; ownership chains through style -> feature. */
export async function requireStyleOption(tx: Transaction, styleOptionId: string) {
  const option = await tx.query.styleOptions.findFirst({
    where: (o, { and, eq, isNull }) => and(eq(o.id, styleOptionId), isNull(o.deletedAt)),
  });
  if (!option) throw new HttpError(404, "STYLE_OPTION_NOT_FOUND", `Style option ${styleOptionId} not found`);
  await requireStyle(tx, option.styleId);
  return option;
}

/** `product_fittings` carries its own `tenant_id` and RLS policy, so ownership resolves directly. */
export async function requireProductFitting(tx: Transaction, productFittingId: string) {
  const fitting = await tx.query.productFittings.findFirst({
    where: (f, { and, eq, isNull }) => and(eq(f.id, productFittingId), isNull(f.deletedAt)),
  });
  if (!fitting) throw new HttpError(404, "PRODUCT_FITTING_NOT_FOUND", `Product fitting ${productFittingId} not found`);
  return fitting;
}
