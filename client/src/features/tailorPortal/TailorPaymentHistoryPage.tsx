import { useState } from "react";
// Named barrel import — see JobAssignmentPage.tsx-adjacent screens' comment
// on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { RemoveRedEye as ViewIcon } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
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
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { useGenerateOwnSettlementPdfMutation, useListOwnSettlementsQuery } from "./tailorPortalApi";

/**
 * Tailor-portal counterpart to `WorkerPaymentHistoryPage.tsx` — same table/printable-slip
 * design, minus the tailor `<Select>` (always the logged-in tailor, forced server-side by
 * `tailorPortalApi.ts`'s `listOwnSettlements`/`generateOwnSettlementPdf`).
 */
export function TailorPaymentHistoryPage() {
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const { data: settlements, isFetching: isLoading, isError, error } = useListOwnSettlementsQuery();
  const [generateOwnSettlementPdf] = useGenerateOwnSettlementPdfMutation();

  async function handleViewPdf(settlementId: string) {
    setPdfError(null);
    setPdfLoadingId(settlementId);
    try {
      const { path } = await generateOwnSettlementPdf(settlementId).unwrap();
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
        My Payment History
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Every payroll settlement paid to you, with a printable summary slip for any of them.
      </Typography>

      {pdfError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pdfError}
        </Alert>
      )}

      {isLoading && <LoadingSpinner />}

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getApiErrorMessage(error, "Failed to load your payment history.")}
        </Alert>
      )}

      {!isLoading && !isError && (
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
                    <Typography color="text.secondary">No payment history yet.</Typography>
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
