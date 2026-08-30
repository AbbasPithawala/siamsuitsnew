import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useListOwnExtraPaymentsQuery } from "./tailorPortalApi";
import type { ExtraPaymentStatus } from "../extraPayments/extraPaymentsApi";

/**
 * Tailor-portal counterpart to `ExtraPaymentsApprovalPage.tsx` — same status filter, but
 * read-only (no Approve/Decline actions, no tailor filter/column since every row already
 * belongs to the logged-in tailor: `tailorPortalApi.ts`'s `listOwnExtraPayments` forces
 * `tailorId` to `req.actor!.id` server-side, so this never shows another tailor's earnings).
 */
export function TailorExtraPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<ExtraPaymentStatus>("pending");

  const { data: extraPayments, isLoading, isError, error } = useListOwnExtraPaymentsQuery({ status: statusFilter });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        My Extra Payments
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        The status of every extra payment you've attached to a job — an extra payment only pays out once approved.
      </Typography>

      <FormControl sx={{ minWidth: 200, mb: 3 }}>
        <InputLabel id="own-ep-status-label">Status</InputLabel>
        <Select
          labelId="own-ep-status-label"
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ExtraPaymentStatus)}
        >
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </Select>
      </FormControl>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getApiErrorMessage(error, "Failed to load your extra payments.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell>Date</TableCell>
              {statusFilter !== "pending" && <TableCell align="right">Status</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {extraPayments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={statusFilter !== "pending" ? 6 : 5}>
                  <Typography color="text.secondary">No {statusFilter} extra payments.</Typography>
                </TableCell>
              </TableRow>
            )}
            {extraPayments?.map((extraPayment) => (
              <TableRow key={extraPayment.id}>
                <TableCell>{extraPayment.order?.orderNumber ?? "—"}</TableCell>
                <TableCell>{extraPayment.component?.slotLabel ?? "—"}</TableCell>
                <TableCell>
                  {extraPayment.category?.name ?? "—"}
                  {extraPayment.category?.thaiName ? ` / ${extraPayment.category.thaiName}` : ""}
                </TableCell>
                <TableCell align="right">{extraPayment.cost}</TableCell>
                <TableCell>{new Date(extraPayment.createdAt).toLocaleDateString()}</TableCell>
                {statusFilter !== "pending" && (
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={extraPayment.approved ? "success" : "error"}
                      label={extraPayment.approved ? "Approved" : "Rejected"}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
