import { baseApi } from "../../api/baseApi";

/**
 * Mirrors `GET /api/dashboard/summary`'s response shape (`siam/server`'s dashboard
 * endpoint, built in parallel — see `DashboardPage.tsx`'s own doc comment). Admin-only
 * fields are genuinely absent (not just `undefined`) on a retailer session's response,
 * but `DashboardPage.tsx` still branches its rendering on `me.retailerId`, not on
 * whether a given field happens to be present here.
 */
export interface DashboardSummary {
  scope: "retailer" | "admin";
  stats: {
    totalOrders: number;
    activeOrders: number;
    /** Decimal string, net of tailor cost when `scope === "admin"`. */
    totalRevenue: string;
    totalRetailers?: number;
    activeTailorJobs?: number;
    /** The deduction behind `totalRevenue` when `scope === "admin"`. */
    tailorCost?: string;
  };
  ordersByStatus: { status: string; count: number }[];
  /** Last 30 days, daily, `date` = "YYYY-MM-DD". */
  ordersTrend: { date: string; count: number }[];
  /** Last 30 days, daily. */
  revenueTrend: { date: string; revenue: string; tailorCost?: string }[];
  topRetailers?: { retailerId: string; name: string; orderCount: number; revenue: string }[];
  tailorJobsByStatus?: { status: string; count: number }[];
}

interface DashboardSummaryResponseEnvelope {
  data: DashboardSummary;
}

/**
 * `GET /dashboard/summary` requires only an authenticated session — no
 * particular permission — and scopes itself server-side to the caller's own
 * retailer (`scope: "retailer"`) vs the whole tenant (`scope: "admin"`), same
 * as every other row-level-isolated resource in this codebase.
 */
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, void>({
      query: () => "/dashboard/summary",
      transformResponse: (response: DashboardSummaryResponseEnvelope) => response.data,
    }),
  }),
});

export const { useGetDashboardSummaryQuery } = dashboardApi;
