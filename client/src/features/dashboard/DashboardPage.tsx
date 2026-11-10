import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { BarChart, LineChart, PieChart } from "@mui/x-charts";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import {
  Assignment as AssignmentIcon,
  Engineering as EngineeringIcon,
  Paid as PaidIcon,
  ShoppingCart as ShoppingCartIcon,
  Storefront as StorefrontIcon,
} from "@mui/icons-material";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { STATUS_CHIP_COLORS } from "../orders/orderStatusColors";
import { useGetDashboardSummaryQuery } from "./dashboardApi";

const CARD_SHADOW = "rgba(0,0,0,.08) 0 6px 20px";
const CHART_HEIGHT = 280;

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Paper sx={{ p: 2, flex: "1 1 220px", minWidth: 220, boxShadow: CARD_SHADOW }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper sx={{ p: 2, boxShadow: CARD_SHADOW }}>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

/**
 * Real analytics dashboard replacing the Phase 5 placeholder. One unified
 * page for every role (per `REWRITE_ARCHITECTURE.md` §3 — a single
 * `AppShell`/route tree serves both staff/admin and retailer-linked
 * logins), branching on `me.retailerId` — same identity-based convention
 * `RetailerProfilePage.tsx` already uses — rather than a permission key,
 * since there isn't one for "is this session retailer-linked".
 *
 * `GET /dashboard/summary` (`dashboardApi.ts`) itself already scopes admin-
 * only fields server-side (`scope: "retailer"` omits them entirely), but
 * this page still branches its own rendering on `me.retailerId` rather than
 * relying on field presence, so a stale/mocked response shape can't
 * accidentally leak an admin-only tile.
 */
export function DashboardPage() {
  const theme = useTheme();
  const { data: me } = useMeQuery();
  const { data: summary, isLoading, isError, error } = useGetDashboardSummaryQuery();

  const isAdmin = !me?.retailerId;

  if (!me || isLoading) {
    return <LoadingSpinner />;
  }

  if (isError || !summary) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{getApiErrorMessage(error, "Failed to load dashboard data.")}</Alert>
      </Box>
    );
  }

  const ordersTrendDataset = summary.ordersTrend.map((point) => ({ date: point.date, count: point.count }));
  const revenueTrendDataset = summary.revenueTrend.map((point) => ({
    date: point.date,
    revenue: Number(point.revenue),
    tailorCost: point.tailorCost !== undefined ? Number(point.tailorCost) : undefined,
  }));
  const topRetailersDataset = (summary.topRetailers ?? []).map((retailer) => ({
    name: retailer.name,
    revenue: Number(retailer.revenue),
    orderCount: retailer.orderCount,
  }));
  const tailorJobStatusColors = [theme.palette.primary.light, theme.palette.primary.dark];

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <StatTile icon={<ShoppingCartIcon />} label="Total Orders" value={String(summary.stats.totalOrders)} />
        <StatTile icon={<AssignmentIcon />} label="Active Orders" value={String(summary.stats.activeOrders)} />
        <StatTile icon={<PaidIcon />} label="Total Revenue" value={`THB ${summary.stats.totalRevenue}`} />
        {isAdmin && (
          <StatTile icon={<StorefrontIcon />} label="Total Retailers" value={String(summary.stats.totalRetailers ?? 0)} />
        )}
        {isAdmin && (
          <StatTile icon={<EngineeringIcon />} label="Active Tailor Jobs" value={String(summary.stats.activeTailorJobs ?? 0)} />
        )}
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
        }}
      >
        <ChartCard title="Orders by Status">
          <PieChart
            height={CHART_HEIGHT}
            series={[
              {
                data: summary.ordersByStatus.map((entry, index) => ({
                  id: index,
                  value: entry.count,
                  label: entry.status,
                  color: STATUS_CHIP_COLORS[entry.status]?.color ?? theme.palette.primary.main,
                })),
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="Orders Trend (last 30 days)">
          <BarChart
            height={CHART_HEIGHT}
            dataset={ordersTrendDataset}
            xAxis={[{ scaleType: "band", dataKey: "date" }]}
            series={[{ dataKey: "count", label: "Orders", color: theme.palette.primary.main }]}
          />
        </ChartCard>

        <ChartCard title="Revenue Trend (last 30 days)">
          <LineChart
            height={CHART_HEIGHT}
            dataset={revenueTrendDataset}
            xAxis={[{ scaleType: "point", dataKey: "date" }]}
            series={[{ dataKey: "revenue", label: "Revenue", color: theme.palette.primary.main }]}
          />
        </ChartCard>

        {isAdmin && (
          <ChartCard title="Revenue vs Tailor Cost">
            <BarChart
              height={CHART_HEIGHT}
              dataset={revenueTrendDataset}
              xAxis={[{ scaleType: "band", dataKey: "date" }]}
              series={[
                { dataKey: "revenue", label: "Revenue", color: theme.palette.primary.main },
                { dataKey: "tailorCost", label: "Tailor Cost", color: theme.palette.primary.dark },
              ]}
            />
          </ChartCard>
        )}

        {isAdmin && (
          <ChartCard title="Top Retailers">
            <BarChart
              height={CHART_HEIGHT}
              layout="horizontal"
              dataset={topRetailersDataset}
              yAxis={[{ scaleType: "band", dataKey: "name" }]}
              xAxis={[{}]}
              series={[{ dataKey: "revenue", label: "Revenue", color: theme.palette.primary.light }]}
            />
          </ChartCard>
        )}

        {isAdmin && (
          <ChartCard title="Active Tailor Jobs by Status">
            <PieChart
              height={CHART_HEIGHT}
              series={[
                {
                  data: (summary.tailorJobsByStatus ?? []).map((entry, index) => ({
                    id: index,
                    value: entry.count,
                    label: entry.status,
                    color: tailorJobStatusColors[index % tailorJobStatusColors.length]!,
                  })),
                },
              ]}
            />
          </ChartCard>
        )}
      </Box>
    </Box>
  );
}
