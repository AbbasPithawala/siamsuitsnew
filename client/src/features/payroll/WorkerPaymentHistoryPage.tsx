import { useState } from "react";
// Named barrel import — see JobAssignmentPage.tsx-adjacent screens' comment
// on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { RemoveRedEye as ViewIcon } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
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
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { useListTailorsQuery } from "../tailors/tailorsApi";
import { useGenerateSettlementPdfMutation, useListSettlementsQuery } from "./payrollApi";

/**
 * Read-only settlement history + printable slip — the rewrite's counterpart
 * to legacy `WorkPaymentHistory.jsx`, which had no equivalent anywhere in
 * this app until now even though every settlement it would list has existed
 * since Phase 3 Group 6 (`payment_settlements`). Pick a tailor, see every
 * settlement ever created for them (`listSettlements`, backed by the new
 * `GET /tailors/:id/settlements` read `payroll.service.ts` added), and open
 * a printable PDF slip per row (`generateSettlementPdf`/
 * `settlementPdf.service.ts` — server-rendered, matching this rewrite's
 * `invoicePdf.service.ts` convention, unlike legacy's client-side `jsPDF`).
 *
 * No start/end date filter, unlike legacy — this list is already scoped to
 * one tailor and settlements are infrequent enough that scrolling a full
 * history is not the burden a date range would be solving elsewhere; easy
 * to add against the same `listSettlements` read later if that changes.
 */
export function WorkerPaymentHistoryPage() {
  const { data: tailors } = useListTailorsQuery();
  const [tailorId, setTailorId] = useState("");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const {
    data: settlements,
    isFetching: isLoading,
    isError,
    error,
  } = useListSettlementsQuery(tailorId, { skip: !tailorId });

  const [generateSettlementPdf] = useGenerateSettlementPdfMutation();

  const activeTailors = (tailors ?? []).filter((t) => t.isActive);

  function handleTailorChange(nextTailorId: string) {
    setTailorId(nextTailorId);
    setPdfError(null);
  }

  async function handleViewPdf(settlementId: string) {
    setPdfError(null);
    setPdfLoadingId(settlementId);
    try {
      const { path } = await generateSettlementPdf({ tailorId, settlementId }).unwrap();
      window.open(resolveUploadUrl(path), "_blank", "noopener,noreferrer");
    } catch (err) {
      setPdfError(getApiErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPdfLoadingId(null);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Worker Payment History
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pick a tailor to see every payroll settlement ever paid to them, and open a printable summary slip for any of
        them.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <FormControl sx={{ minWidth: 320 }}>
          <InputLabel id="payment-history-tailor-label">Tailor</InputLabel>
          <Select
            labelId="payment-history-tailor-label"
            label="Tailor"
            value={tailorId}
            onChange={(event) => handleTailorChange(event.target.value)}
          >
            {activeTailors.map((tailor) => (
              <MenuItem key={tailor.id} value={tailor.id}>
                {tailor.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {pdfError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pdfError}
        </Alert>
      )}

      {tailorId && isLoading && <LoadingSpinner />}

      {tailorId && isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getApiErrorMessage(error, "Failed to load payment history for this tailor.")}
        </Alert>
      )}

      {tailorId && !isLoading && !isError && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell align="right">Paid Amount</TableCell>
                <TableCell>Paid Date</TableCell>
                <TableCell align="right">PDF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settlements?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">No payment history for this tailor yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {settlements?.map((settlement, index) => (
                <TableRow key={settlement.id}>
                  <TableCell>Invoice {index + 1}</TableCell>
                  <TableCell align="right">THB {settlement.totalPay}</TableCell>
                  <TableCell>{new Date(settlement.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={`View settlement ${index + 1} PDF`}
                      onClick={() => handleViewPdf(settlement.id)}
                      disabled={pdfLoadingId === settlement.id}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
