import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { withTenant } from "../db/withTenant";
import type { Transaction } from "../db/withTenant";
import { orders, orderInvoices, retailers, jobs, extraPayments, manufacturingSteps, orderItemComponents, orderItems } from "../db/schema/index";

export interface DashboardSummary {
  scope: "retailer" | "admin";
  stats: {
    totalOrders: number;
    activeOrders: number;
    totalRevenue: string;
    totalRetailers?: number;
    activeTailorJobs?: number;
    tailorCost?: string;
  };
  ordersByStatus: { status: string; count: number }[];
  ordersTrend: { date: string; count: number }[];
  revenueTrend: { date: string; revenue: string; tailorCost?: string }[];
  topRetailers?: { retailerId: string; name: string; orderCount: number; revenue: string }[];
  tailorJobsByStatus?: { status: string; count: number }[];
}

const TRAILING_DAYS_WINDOW = sql`now() - interval '30 days'`;

/** Every order status except "Sent" counts as active — derived from `ordersByStatus`, not a second query. */
function sumActiveOrders(ordersByStatus: { status: string; count: number }[]): number {
  return ordersByStatus.filter((row) => row.status !== "Sent").reduce((sum, row) => sum + row.count, 0);
}

async function getOrdersByStatus(tx: Transaction, baseConditions: (SQL | undefined)[]) {
  const rows = await tx
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(...baseConditions))
    .groupBy(orders.status);
  return rows;
}

async function getOrdersTrend(tx: Transaction, baseConditions: (SQL | undefined)[]) {
  const rows = await tx
    .select({
      date: sql<string>`to_char(date_trunc('day', ${orders.orderDate}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...baseConditions, gte(orders.orderDate, TRAILING_DAYS_WINDOW)))
    .groupBy(sql`date_trunc('day', ${orders.orderDate})`)
    .orderBy(sql`date_trunc('day', ${orders.orderDate})`);
  return rows;
}

async function getRevenueTotal(tx: Transaction, baseConditions: (SQL | undefined)[]): Promise<string> {
  const [row] = await tx
    .select({ revenue: sql<string>`coalesce(sum(coalesce(${orderInvoices.total}, 0)), 0)::text` })
    .from(orders)
    .leftJoin(orderInvoices, eq(orderInvoices.orderId, orders.id))
    .where(and(...baseConditions));
  return row?.revenue ?? "0";
}

async function getRevenueTrend(tx: Transaction, baseConditions: (SQL | undefined)[]) {
  const rows = await tx
    .select({
      date: sql<string>`to_char(date_trunc('day', ${orders.orderDate}), 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(coalesce(${orderInvoices.total}, 0)), 0)::text`,
    })
    .from(orders)
    .leftJoin(orderInvoices, eq(orderInvoices.orderId, orders.id))
    .where(and(...baseConditions, gte(orders.orderDate, TRAILING_DAYS_WINDOW)))
    .groupBy(sql`date_trunc('day', ${orders.orderDate})`)
    .orderBy(sql`date_trunc('day', ${orders.orderDate})`);
  return rows;
}

async function getTailorCost(tx: Transaction, tenantId: string): Promise<string> {
  const [jobsRow] = await tx
    .select({ total: sql<string>`coalesce(sum(${jobs.cost}), 0)::text` })
    .from(jobs)
    .where(eq(jobs.tenantId, tenantId));

  const [extraRow] = await tx
    .select({ total: sql<string>`coalesce(sum(${extraPayments.cost}), 0)::text` })
    .from(extraPayments)
    .innerJoin(jobs, eq(extraPayments.jobId, jobs.id))
    .where(and(eq(jobs.tenantId, tenantId), eq(extraPayments.approved, true), eq(extraPayments.rejected, false)));

  const total = Number(jobsRow?.total ?? "0") + Number(extraRow?.total ?? "0");
  return total.toFixed(2);
}

/**
 * Bucketed by `jobs.createdAt`/`extraPayments.createdAt` — NOT `orders.orderDate`, since
 * neither table carries an order reference this cheaply joinable to. A same-calendar-day
 * approximation against `revenueTrend`'s own `orders.orderDate` bucketing, not a strict
 * cost-attribution join — a job/extra-payment recorded on a different day than the order
 * that drove it lands in its own day's bucket, by design.
 */
async function getTailorCostByDay(tx: Transaction, tenantId: string): Promise<Map<string, number>> {
  const [jobRows, extraRows] = await Promise.all([
    tx
      .select({
        date: sql<string>`to_char(date_trunc('day', ${jobs.createdAt}), 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${jobs.cost}), 0)::text`,
      })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), gte(jobs.createdAt, TRAILING_DAYS_WINDOW)))
      .groupBy(sql`date_trunc('day', ${jobs.createdAt})`),
    tx
      .select({
        date: sql<string>`to_char(date_trunc('day', ${extraPayments.createdAt}), 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${extraPayments.cost}), 0)::text`,
      })
      .from(extraPayments)
      .innerJoin(jobs, eq(extraPayments.jobId, jobs.id))
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          eq(extraPayments.approved, true),
          eq(extraPayments.rejected, false),
          gte(extraPayments.createdAt, TRAILING_DAYS_WINDOW)
        )
      )
      .groupBy(sql`date_trunc('day', ${extraPayments.createdAt})`),
  ]);

  const byDate = new Map<string, number>();
  for (const row of [...jobRows, ...extraRows]) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + Number(row.total));
  }
  return byDate;
}

/**
 * Union of every date either query produced — a day with revenue but no tailor-cost
 * activity still gets an explicit `"0.00"`, not an omitted key; a day with tailor-cost
 * activity but no orders still appears as its own row rather than being dropped.
 */
function mergeRevenueAndTailorCostTrend(
  revenueTrend: { date: string; revenue: string }[],
  tailorCostByDate: Map<string, number>
): { date: string; revenue: string; tailorCost: string }[] {
  const revenueByDate = new Map(revenueTrend.map((r) => [r.date, r.revenue]));
  const dates = new Set([...revenueByDate.keys(), ...tailorCostByDate.keys()]);
  return [...dates].sort().map((date) => ({
    date,
    revenue: revenueByDate.get(date) ?? "0",
    tailorCost: (tailorCostByDate.get(date) ?? 0).toFixed(2),
  }));
}

async function getTailorJobsByStatus(tx: Transaction, tenantId: string) {
  const rows = await tx
    .select({ status: manufacturingSteps.status, count: sql<number>`count(*)::int` })
    .from(manufacturingSteps)
    .innerJoin(orderItemComponents, eq(manufacturingSteps.orderItemComponentId, orderItemComponents.id))
    .innerJoin(orderItems, eq(orderItemComponents.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.tenantId, tenantId), inArray(manufacturingSteps.status, ["pending", "assigned"])))
    .groupBy(manufacturingSteps.status);
  return rows;
}

async function getTopRetailers(tx: Transaction, tenantId: string) {
  const rows = await tx
    .select({
      retailerId: orders.retailerId,
      name: retailers.name,
      orderCount: sql<number>`count(distinct ${orders.id})::int`,
      revenue: sql<string>`coalesce(sum(coalesce(${orderInvoices.total}, 0)), 0)::text`,
    })
    .from(orders)
    .innerJoin(retailers, eq(retailers.id, orders.retailerId))
    .leftJoin(orderInvoices, eq(orderInvoices.orderId, orders.id))
    .where(and(eq(orders.tenantId, tenantId), isNull(orders.deletedAt)))
    .groupBy(orders.retailerId, retailers.name)
    .orderBy(desc(sql`coalesce(sum(coalesce(${orderInvoices.total}, 0)), 0)`))
    .limit(6);
  return rows;
}

export function getDashboardSummary(tenantId: string, actorRetailerId: string | null): Promise<DashboardSummary> {
  return withTenant(tenantId, async (tx) => {
    const baseConditions = [eq(orders.tenantId, tenantId), isNull(orders.deletedAt), actorRetailerId ? eq(orders.retailerId, actorRetailerId) : undefined];

    const [ordersByStatus, ordersTrend] = await Promise.all([getOrdersByStatus(tx, baseConditions), getOrdersTrend(tx, baseConditions)]);
    const totalOrders = ordersByStatus.reduce((sum, row) => sum + row.count, 0);
    const activeOrders = sumActiveOrders(ordersByStatus);

    const scope: "retailer" | "admin" = actorRetailerId ? "retailer" : "admin";

    if (scope === "retailer") {
      const [totalRevenue, revenueTrend] = await Promise.all([getRevenueTotal(tx, baseConditions), getRevenueTrend(tx, baseConditions)]);
      return {
        scope,
        stats: { totalOrders, activeOrders, totalRevenue },
        ordersByStatus,
        ordersTrend,
        revenueTrend,
      };
    }

    const [grossRevenue, revenueTrend, totalRetailersRow, tailorCost, tailorCostByDay, tailorJobsByStatus, topRetailers] = await Promise.all([
      getRevenueTotal(tx, baseConditions),
      getRevenueTrend(tx, baseConditions),
      tx.select({ count: sql<number>`count(*)::int` }).from(retailers).where(and(eq(retailers.tenantId, tenantId), eq(retailers.isActive, true))),
      getTailorCost(tx, tenantId),
      getTailorCostByDay(tx, tenantId),
      getTailorJobsByStatus(tx, tenantId),
      getTopRetailers(tx, tenantId),
    ]);

    const totalRevenue = (Number(grossRevenue) - Number(tailorCost)).toFixed(2);
    const activeTailorJobs = tailorJobsByStatus.reduce((sum, row) => sum + row.count, 0);

    return {
      scope,
      stats: {
        totalOrders,
        activeOrders,
        totalRevenue,
        totalRetailers: totalRetailersRow[0]?.count ?? 0,
        activeTailorJobs,
        tailorCost,
      },
      ordersByStatus,
      ordersTrend,
      revenueTrend: mergeRevenueAndTailorCostTrend(revenueTrend, tailorCostByDay),
      topRetailers,
      tailorJobsByStatus,
    };
  });
}
