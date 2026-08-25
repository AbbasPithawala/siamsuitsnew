import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { PaginationControls } from "../../components/PaginationControls";
import { usePagination } from "../../hooks/usePagination";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { useListOrderGroupsPaginatedQuery } from "./orderGroupsApi";

const ALL_RETAILERS = "";

/**
 * Group Orders list — closes the standing gap `navConfig.ts` flagged
 * ("`Group Orders` has no entry at all... a standing gap", now resolved).
 * Mirrors `OrderListPage.tsx`'s real structure closely: `usePagination()` +
 * `<PaginationControls>`, a retailer filter dropdown (same
 * `useListRetailersQuery` this file's sibling already uses), a table of
 * group rows linking to the detail page. `GET /order-groups` requires
 * `orders.view` — same permission the plain Orders list uses — so this whole
 * page sits behind a page-level `RequirePermission` in `AppRoutes.tsx`,
 * matching `OrderListPage.tsx`'s own precedent rather than a button-level
 * gate.
 *
 * Unlike `OrderListPage.tsx`, there is no customer/status filter here — a
 * group order has no single customer (each child order has its own,
 * rendered on the detail page) and no group-level status column exists in
 * `order_groups` (`server/src/db/schema/orders.ts`'s own doc comment: a
 * group is deliberately "NOT a parallel structure with its own nested
 * manufacturing shape").
 */
export function GroupOrdersPage() {
  const navigate = useNavigate();
  const [retailerFilter, setRetailerFilter] = useState<string>(ALL_RETAILERS);
  const pagination = usePagination();

  const { data: retailers } = useListRetailersQuery();

  const filter = {
    ...(retailerFilter ? { retailerId: retailerFilter } : {}),
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  const { data: groupsResponse, isLoading, isError, error } = useListOrderGroupsPaginatedQuery(filter);
  const groups = groupsResponse?.data;

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));

  function handleRetailerFilterChange(event: SelectChangeEvent) {
    setRetailerFilter(event.target.value);
    pagination.onPageChange(1);
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Group Orders
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="group-order-retailer-filter-label">Filter by retailer</InputLabel>
          <Select
            labelId="group-order-retailer-filter-label"
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
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load group orders.")}
        </Alert>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Group Order Number</TableCell>
                <TableCell>Retailer</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No group orders yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {groups?.map((group) => (
                <TableRow
                  key={group.id}
                  hover
                  role="row"
                  onClick={() => navigate(`/group-orders/${group.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{group.orderNumber}</TableCell>
                  <TableCell>{retailerNameById.get(group.retailerId) ?? "—"}</TableCell>
                  <TableCell>{new Date(group.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls total={groupsResponse?.pagination.total ?? 0} {...pagination} />
        </TableContainer>
      )}
    </Box>
  );
}
