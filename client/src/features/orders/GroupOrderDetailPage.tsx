import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useGetCustomerQuery } from "../customers/customersApi";
import { useListRetailersQuery } from "../retailers/retailersApi";
import { useGetOrderGroupQuery } from "./orderGroupsApi";
import type { OrderDetail } from "./ordersApi";

/**
 * Group Order detail — the group's own info (order number, retailer, date)
 * plus a table of its child orders, each linking to that child order's own
 * real `/orders/:id` detail page (`OrderDetailPage.tsx` is reused wholesale
 * for a single order's full rendering — this page never duplicates that
 * items/components/measurements/features tree, only the group-level
 * shell around it).
 *
 * Customer names are resolved per child order via `useGetCustomerQuery`
 * (one query per row, in `ChildOrderRow` below), NOT an unfiltered
 * `useListCustomersQuery` — `OrderDetailPage.tsx`'s own doc comment records
 * why: `listCustomers` is mandatorily paginated (Workstream C) and a tenant
 * can have hundreds of real customers, so an unfiltered list fetch would
 * silently miss whichever customer isn't on page 1. Real bug this session
 * already found and fixed once there; not repeated here.
 */
export function GroupOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: group, isLoading, isError, error } = useGetOrderGroupQuery(id ?? "", { skip: !id });
  const { data: retailers } = useListRetailersQuery();

  const retailerNameById = new Map((retailers ?? []).map((retailer) => [retailer.id, retailer.name]));

  if (isLoading) return <LoadingSpinner />;

  if (isError || !group) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{getApiErrorMessage(error, "Failed to load group order.")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Group Order {group.orderNumber}</Typography>
        <Typography color="text.secondary">
          Retailer: {retailerNameById.get(group.retailerId) ?? "—"} &middot; Created:{" "}
          {new Date(group.createdAt).toLocaleDateString()}
        </Typography>
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Orders in this group ({group.orders.length})
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Order Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {group.orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">No orders in this group.</Typography>
                </TableCell>
              </TableRow>
            )}
            {group.orders.map((order) => (
              <ChildOrderRow key={order.id} order={order} onClick={() => navigate(`/orders/${order.id}`)} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

interface ChildOrderRowProps {
  order: OrderDetail;
  onClick: () => void;
}

/**
 * Its own component (not inlined in the `.map()` above) so `useGetCustomerQuery`
 * is called once per real child-order row, one stable hook call per mounted
 * row instance — the same rules-of-hooks reasoning `OrderCartStep.tsx`'s
 * `LineItemRow`/`LineItemMeasurementsPanel.tsx`'s `ComponentMeasurementsSection`
 * already document for the analogous "one query per dynamically-sized list
 * item" shape.
 */
function ChildOrderRow({ order, onClick }: ChildOrderRowProps) {
  const { data: customer } = useGetCustomerQuery(order.customerId);
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "—";

  return (
    <TableRow hover role="row" onClick={onClick} sx={{ cursor: "pointer" }}>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{customerName}</TableCell>
      <TableCell>
        <Chip size="small" label={order.status} />
        {order.isRush && <Chip size="small" color="warning" label="Rush" sx={{ ml: 1 }} />}
      </TableCell>
      <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
    </TableRow>
  );
}
