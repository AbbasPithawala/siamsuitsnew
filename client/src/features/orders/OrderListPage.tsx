import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useListCustomersQuery } from "../customers/customersApi";
import type { Customer } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { useListOrdersPaginatedQuery } from "./ordersApi";
import type { OrderListItem } from "./ordersApi";

const ALL_RETAILERS = "";
const ALL_CUSTOMERS = "";

function customerName(customer: Customer): string {
  return customer.lastName ? `${customer.firstName} ${customer.lastName}` : customer.firstName;
}

function manufacturingSummaryLabel(order: OrderListItem): string {
  if (order.manufacturingStepsTotal === 0) return "No manufacturing steps";
  return `${order.manufacturingStepsComplete}/${order.manufacturingStepsTotal} steps complete`;
}

function manufacturingSummaryColor(order: OrderListItem): "default" | "success" | "warning" {
  if (order.manufacturingStepsTotal === 0) return "default";
  if (order.manufacturingStepsComplete === order.manufacturingStepsTotal) return "success";
  return "warning";
}

/**
 * Order list — PHASE_6_TASKS.md Group 6. `GET /orders` requires `orders.view`
 * (`server/src/routes/orders.routes.ts`), so unlike the Group 1-3 catalog
 * screens this whole page sits behind a page-level `RequirePermission` in
 * `AppRoutes.tsx`, matching the Group 4/7 admin-page precedent rather than
 * an open-page/button-level gate (there is no meaningful "read is open,
 * write is gated" split here — viewing orders itself is the gated action).
 *
 * The manufacturing progress rollup (`manufacturingStepsTotal`/
 * `manufacturingStepsComplete`) comes straight off `listOrders`'s response —
 * a small additive aggregate query Group 6 added there (one query across all
 * listed orders' `manufacturing_steps`, not a follow-up request per row) —
 * rather than this page fetching each order's full nested detail just to
 * count steps.
 */
export function OrderListPage() {
  const navigate = useNavigate();
  const [retailerFilter, setRetailerFilter] = useState<string>(ALL_RETAILERS);
  const [customerFilter, setCustomerFilter] = useState<string>(ALL_CUSTOMERS);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const pagination = usePagination();

  const { data: retailers } = useListRetailersQuery();
  const { data: customers } = useListCustomersQuery(retailerFilter ? { retailerId: retailerFilter } : undefined);

  const filter = {
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    ...(customerFilter ? { customerId: customerFilter } : {}),
    ...(statusFilter.trim() ? { status: statusFilter.trim() } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const { data: ordersResponse, isLoading, isError, error } = useListOrdersPaginatedQuery(filter);
  const orders = ordersResponse?.data;

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));
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

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    pagination.onPageChange(1);
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Orders
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
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

        <TextField
          label="Filter by status"
          size="small"
          value={statusFilter}
          onChange={(event) => handleStatusFilterChange(event.target.value)}
          sx={{ minWidth: 220 }}
        />
      </Stack>

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
                <TableCell>Order Number</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Retailer</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Manufacturing Progress</TableCell>
                <TableCell>Order Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
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
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{customerNameById.get(order.customerId) ?? "—"}</TableCell>
                  <TableCell>{retailerNameById.get(order.retailerId) ?? "—"}</TableCell>
                  <TableCell>
                    {order.status}
                    {order.isRush ? " (Rush)" : ""}
                    {order.isRepeat ? " (Repeat)" : ""}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={manufacturingSummaryLabel(order)} color={manufacturingSummaryColor(order)} />
                  </TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls total={ordersResponse?.pagination.total ?? 0} {...pagination} />
        </TableContainer>
      )}
    </Box>
  );
}
