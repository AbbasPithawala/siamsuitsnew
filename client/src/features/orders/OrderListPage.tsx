import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useMeQuery } from "../../api/baseApi";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useHasPermission } from "../auth/useHasPermission";
import { useListCustomersQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { useGenerateOrderPdfMutation, useListOrdersPaginatedQuery, useListOrdersQuery, useSetOrderStatusMutation } from "./ordersApi";
import type { OrderListItem } from "./ordersApi";

const ALL_RETAILERS = "";
const ALL_CUSTOMERS = "";

/**
 * Mirrors legacy's real order-status tab bars — `siamClient/.../superAdmin/pages/order/Order.jsx`'s
 * `New Orders/Modified/Processing/Ready for Shipment/Sent` and
 * `siamClient/.../retailerAdmin/retailerPages/dashboard/Dashboard.jsx`'s identical set plus its own
 * leading "All Orders" tab — both legacy pages are really the same "orders list" screen split per
 * role; this rewrite has one `OrderListPage` for every role instead, so it gets the union: an "All
 * Orders" tab (which legacy's admin page didn't have, defaulting to "New Order" instead) plus every
 * real status value `orders.status` can hold (`server/src/db/schema/orders.ts`'s own doc comment).
 * "Rush" isn't a tab — unlike legacy, this schema models it as the separate `isRush` boolean (already
 * shown as a "(Rush)" row badge below), never as a literal `status` value.
 */
const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All Orders" },
  { value: "New Order", label: "New Order" },
  { value: "Modified", label: "Modified" },
  { value: "Processing", label: "Processing" },
  { value: "Shipment", label: "Ready for Shipping" },
  { value: "Sent", label: "Sent" },
];

/** Every real status a row can be moved to — same set as `STATUS_TABS` minus the synthetic "All Orders" entry. */
const STATUS_OPTIONS = STATUS_TABS.filter((tab) => tab.value !== "");

function customerName(customer: Customer): string {
  return customer.lastName ? `${customer.firstName} ${customer.lastName}` : customer.firstName;
}

/**
 * Colors lifted verbatim from legacy's real `.newOrderBg`/`.ProcessingBg`/`.ModifiedBg`/
 * `.ShipmentBg`/`.SentBg` classes (`dashboard.css`, `SingleOrder.css`, `customerOrder.css` —
 * identical rules in all three), keyed by `orders.status`'s real values. A status with no
 * legacy color (shouldn't happen — the set is closed today, see `orders.ts`'s own doc comment)
 * falls back to a plain default MUI Chip rather than guessing a color.
 */
const STATUS_CHIP_COLORS: Record<string, { color: string; background: string }> = {
  "New Order": { color: "#009e15", background: "#009e153d" },
  Processing: { color: "#1300a5", background: "#334ad73d" },
  Modified: { color: "#cb7400", background: "#fff00045" },
  Shipment: { color: "#000000", background: "#3d3d3d45" },
  Sent: { color: "#a200ff", background: "#be00ff26" },
};

function StatusChip({ order }: { order: OrderListItem }) {
  const palette = STATUS_CHIP_COLORS[order.status];
  return (
    <Chip
      size="small"
      label={order.status}
      {...(palette ? { sx: { color: palette.color, backgroundColor: palette.background, fontWeight: 600 } } : {})}
    />
  );
}

/**
 * Legacy's real Type column (`Dashboard.jsx`'s ternary): a Rush order (the separate `isRush`
 * boolean here, not a literal status — see `STATUS_TABS`' own doc comment) always wins the
 * badge regardless of `type`, then falls back to Group/Normal. Rush's red is legacy's real
 * inline style (`Dashboard.jsx` line ~767); Group reuses `.ModifiedBg`'s purple, Normal reuses
 * `.newOrderBg`'s green — the same two classes legacy itself reused for this column.
 */
function OrderTypeChip({ order }: { order: OrderListItem }) {
  if (order.isRush) {
    return (
      <Chip size="small" label="Rush Order" sx={{ color: "#fff", backgroundColor: "#ff4444", fontWeight: 600 }} />
    );
  }
  if (order.type === "group") {
    return (
      <Chip
        size="small"
        label="Group"
        sx={{ color: "#cb7400", backgroundColor: "#fff00045", fontWeight: 600, textTransform: "capitalize" }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="Normal"
      sx={{ color: "#009e15", backgroundColor: "#009e153d", fontWeight: 600, textTransform: "capitalize" }}
    />
  );
}

/**
 * A plain bold text link, not a full button — matches legacy's own real `<strong><button
 * className="action">…</button></strong>` treatment for View/Edit/Generate in `Dashboard.jsx`/
 * `Order.jsx` (just `color: black`, no border/background chrome), which a full MUI `Button`
 * looked oversized next to in a dense table row.
 */
function RowActionLink({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      disabled={disabled}
      onClick={onClick}
      sx={{ fontWeight: 700, fontSize: "0.8125rem", color: disabled ? "text.disabled" : "text.primary" }}
    >
      {children}
    </Link>
  );
}

/**
 * Order list — PHASE_6_TASKS.md Group 6. `GET /orders` requires `orders.view`
 * (`server/src/routes/orders.routes.ts`), so unlike the Group 1-3 catalog
 * screens this whole page sits behind a page-level `RequirePermission` in
 * `AppRoutes.tsx`, matching the Group 4/7 admin-page precedent rather than
 * an open-page/button-level gate (there is no meaningful "read is open,
 * write is gated" split here — viewing orders itself is the gated action).
 *
 * Status is editable inline (a `Select` per row, plus multi-select bulk change) for any
 * session holding `orders.edit` — mirrors legacy admin `Order.jsx`'s own "Update Status"
 * column/bulk-change bar exactly; a session without it (Retailer never holds `orders.edit`,
 * see PHASE_10_TASKS.md Workstream E Group 5) gets the read-only colored chip instead,
 * mirroring legacy retailer `Dashboard.jsx`'s own read-only Status column. Changing status
 * invalidates the `Order`/`LIST` RTK Query tag both the table and the tab-count query share,
 * so a row moved off the currently-selected status tab disappears from the table and both
 * tab badges update in the same refetch — no manual bookkeeping needed here.
 */
export function OrderListPage() {
  const navigate = useNavigate();
  const { data: me } = useMeQuery();
  const canEdit = useHasPermission("orders.edit");
  const [retailerFilter, setRetailerFilter] = useState<string>(ALL_RETAILERS);
  const [customerFilter, setCustomerFilter] = useState<string>(ALL_CUSTOMERS);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  // `generatePdf`'s success invalidates the list query's cache tag, but that refetch is a
  // separate network round trip that hasn't necessarily landed yet by the time a user clicks
  // View right after Generate finishes — `order.pdfPath` in the still-stale cached row would
  // read as unset and wrongly show the "please generate" error immediately after generating.
  // This map holds the mutation's own returned URL per order id as an immediate override, so
  // View is correct the instant Generate resolves, not only after the next refetch completes.
  const [freshPdfUrls, setFreshPdfUrls] = useState<Record<string, string>>({});
  const pagination = usePagination();

  // A retailer-linked session already only ever sees its own orders (server-side row-level
  // isolation force-overrides any client-supplied retailerId, same as customers/order-groups) —
  // so the retailer picker/column is meaningless for that session and hidden entirely, matching
  // `OrderBuilderPage.tsx`'s/`NewGroupOrderPage.tsx`'s identical retailer-lock pattern.
  const isRetailerLinked = Boolean(me?.retailerId);

  const { data: retailers } = useListRetailersQuery(undefined, { skip: isRetailerLinked });
  const { data: customers } = useListCustomersQuery(retailerFilter ? { retailerId: retailerFilter } : undefined);

  const baseFilter = {
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    ...(customerFilter ? { customerId: customerFilter } : {}),
  };

  // Unpaginated, status-agnostic count of every order matching the retailer/customer filters —
  // feeds the tab badges below, mirroring legacy's own `fetchAllOrders` (a separate, unfiltered
  // -by-status request purely to compute tab counts) rather than the primary paginated fetch.
  const { data: allOrdersForCounts } = useListOrdersQuery(baseFilter);
  const statusCounts = new Map<string, number>();
  for (const order of allOrdersForCounts ?? []) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
  }
  const totalCount = allOrdersForCounts?.length ?? 0;

  const filter = {
    ...baseFilter,
    ...(statusFilter ? { status: statusFilter } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const { data: ordersResponse, isLoading, isError, error } = useListOrdersPaginatedQuery(filter);
  const orders = ordersResponse?.data;

  const [generatePdf] = useGenerateOrderPdfMutation();
  const [setOrderStatus] = useSetOrderStatusMutation();

  const customerNameById = new Map((customers ?? []).map((customer) => [customer.id, customerName(customer)]));

  function handleRetailerFilterChange(event: SelectChangeEvent) {
    setRetailerFilter(event.target.value);
    setCustomerFilter(ALL_CUSTOMERS);
    pagination.onPageChange(1);
  }

  function handleCustomerFilterChange(event: SelectChangeEvent) {
    setCustomerFilter(event.target.value);
    pagination.onPageChange(1);
  }

  function handleStatusTabChange(value: string) {
    setStatusFilter(value);
    setSelectedIds([]);
    pagination.onPageChange(1);
  }

  function handleView(event: React.MouseEvent, order: OrderListItem) {
    event.stopPropagation();
    const pdfUrl = freshPdfUrls[order.id] ?? order.pdfPath;
    if (!pdfUrl) {
      setToastMessage("This order's PDF doesn't exist yet — please generate it first.");
      return;
    }
    window.open(resolveUploadUrl(pdfUrl), "_blank", "noopener,noreferrer");
  }

  async function handleGenerate(event: React.MouseEvent, order: OrderListItem) {
    event.stopPropagation();
    setGeneratingId(order.id);
    try {
      const result = await generatePdf(order.id).unwrap();
      setFreshPdfUrls((current) => ({ ...current, [order.id]: result.path }));
    } catch (err) {
      setToastMessage(getApiErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleRowStatusChange(event: { stopPropagation: () => void }, order: OrderListItem, status: string) {
    event.stopPropagation();
    try {
      await setOrderStatus({ id: order.id, status }).unwrap();
    } catch (err) {
      setToastMessage(getApiErrorMessage(err, "Failed to update order status."));
    }
  }

  function toggleSelected(orderId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, orderId] : current.filter((id) => id !== orderId)));
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? (orders ?? []).map((order) => order.id) : []);
  }

  async function handleBulkStatusChange(status: string) {
    setBulkStatus("");
    try {
      await Promise.all(selectedIds.map((id) => setOrderStatus({ id, status }).unwrap()));
      setSelectedIds([]);
    } catch (err) {
      setToastMessage(getApiErrorMessage(err, "Failed to update status for one or more selected orders."));
    }
  }

  const allOnPageSelected = (orders ?? []).length > 0 && (orders ?? []).every((order) => selectedIds.includes(order.id));
  const someOnPageSelected = selectedIds.length > 0 && !allOnPageSelected;
  const columnCount = 6 + (canEdit ? 1 : 0);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Orders
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          {!isRetailerLinked && (
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="order-retailer-filter-label">Filter by retailer</InputLabel>
              <Select
                labelId="order-retailer-filter-label"
                label="Filter by retailer"
                value={retailerFilter}
                onChange={handleRetailerFilterChange}
              >
                <MenuItem value={ALL_RETAILERS}>All retailers</MenuItem>
                {retailers?.map((retailer) => (
                  <MenuItem key={retailer.id} value={retailer.id}>
                    {retailer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="order-customer-filter-label">Filter by customer</InputLabel>
            <Select
              labelId="order-customer-filter-label"
              label="Filter by customer"
              value={customerFilter}
              onChange={handleCustomerFilterChange}
            >
              <MenuItem value={ALL_CUSTOMERS}>All customers</MenuItem>
              {customers?.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customerName(customer)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Bulk status change — admin-only (`orders.edit`), mirrors legacy `Order.jsx`'s own
            checkbox-multi-select + "Multiple Status Change" bar, pinned to the far right of the
            filter row rather than its own row below the tabs. */}
        {canEdit && selectedIds.length > 0 && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">{selectedIds.length} selected</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="bulk-status-label">Change status to…</InputLabel>
              <Select
                labelId="bulk-status-label"
                label="Change status to…"
                value={bulkStatus}
                onChange={(event) => handleBulkStatusChange(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}
      </Stack>

      <Tabs
        value={statusFilter}
        onChange={(_event, value: string) => handleStatusTabChange(value)}
        variant="scrollable"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {STATUS_TABS.map((tab) => {
          const count = tab.value === "" ? totalCount : (statusCounts.get(tab.value) ?? 0);
          return <Tab key={tab.value} value={tab.value} label={`${tab.label} (${count})`} />;
        })}
      </Tabs>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load orders.")}
        </Alert>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                {canEdit && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={someOnPageSelected}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </TableCell>
                )}
                <TableCell>Order Number</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>View</TableCell>
                <TableCell>Generate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <Typography color="text.secondary">No orders yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {orders?.map((order) => (
                <TableRow
                  key={order.id}
                  hover
                  role="row"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  {canEdit && (
                    <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onChange={(event) => toggleSelected(order.id, event.target.checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{customerNameById.get(order.customerId) ?? "—"}</TableCell>
                  <TableCell>
                    <OrderTypeChip order={order} />
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    {canEdit ? (
                      <Select
                        size="small"
                        variant="standard"
                        value={order.status}
                        onChange={(event) => handleRowStatusChange(event, order, event.target.value)}
                        sx={{
                          fontSize: "0.8125rem",
                          width: 100,
                          "& .MuiSelect-select": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                        }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value} sx={{ fontSize: "0.8125rem" }}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    ) : (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <StatusChip order={order} />
                        {order.isRepeat ? (
                          <Typography variant="caption" color="text.secondary">
                            (Repeat)
                          </Typography>
                        ) : null}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>{order.itemCount}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <RowActionLink onClick={(event) => handleView(event, order)}>View</RowActionLink>
                  </TableCell>
                  <TableCell>
                    {order.status === "Sent" ? (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    ) : (
                      <RowActionLink disabled={generatingId === order.id} onClick={(event) => handleGenerate(event, order)}>
                        {generatingId === order.id ? "Generating…" : "Generate"}
                      </RowActionLink>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls total={ordersResponse?.pagination.total ?? 0} {...pagination} />
        </TableContainer>
      )}

      <Snackbar
        open={toastMessage !== null}
        autoHideDuration={5000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setToastMessage(null)} severity="error" sx={{ width: "100%" }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
