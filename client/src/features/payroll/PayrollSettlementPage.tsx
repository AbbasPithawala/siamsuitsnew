import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
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
import { useListTailorsQuery } from "../tailors/tailorsApi";
import { useCreateSettlementMutation, useGetSettlementQuery, useListUnpaidJobsQuery } from "./payrollApi";

/**
 * Tailor payroll settlement screen — PHASE_6_TASKS.md Group 8. Pick a tailor,
 * see their unpaid *completed* jobs (`listUnpaidJobs`, backed by the new
 * `GET /tailors/:id/unpaid-jobs` read `payroll.service.ts`'s
 * `listUnpaidCompletedJobs` added — see that function's doc comment for why
 * this read didn't exist before), select which to settle, optionally deduct
 * rent/a manual bill/an outstanding advance, and submit through the existing
 * `createSettlement` (`payroll.service.ts`, Phase 3 Group 6). Every dollar
 * amount shown after submission — `subTotal`/`deductedAdvance`/`rent`/
 * `manualBill`/`totalPay` — comes straight from the server response; this
 * screen deliberately never sums the selected jobs' costs itself, even as a
 * pre-submit preview, per this codebase's hard "financial totals are always
 * server-computed" rule (see e.g. `orders.service.ts`/`invoices.service.ts`
 * and every order/invoice screen built on them).
 *
 * Uses plain MUI (no legacy `factory.css`), matching the convention Groups
 * 4-7 of this phase already established for the rebuilt factory-floor/admin
 * screens (see e.g. `JobAssignmentPage.tsx`'s doc comment) rather than
 * porting the legacy `ManageJobs.jsx`'s bespoke table/inline-style layout.
 */
export function PayrollSettlementPage() {
  const { data: tailors } = useListTailorsQuery();

  const [tailorId, setTailorId] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [rent, setRent] = useState("");
  const [manualBill, setManualBill] = useState("");
  const [deductedAdvance, setDeductedAdvance] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedSettlementId, setConfirmedSettlementId] = useState<string | null>(null);

  const {
    data: unpaidJobs,
    isFetching: isLoadingJobs,
    isError: isJobsError,
    error: jobsError,
  } = useListUnpaidJobsQuery(tailorId, { skip: !tailorId });

  const [createSettlement, createState] = useCreateSettlementMutation();
  const { data: settlementDetail, isFetching: isLoadingConfirmation } = useGetSettlementQuery(
    tailorId && confirmedSettlementId ? { tailorId, settlementId: confirmedSettlementId } : { tailorId: "", settlementId: "" },
    { skip: !tailorId || !confirmedSettlementId }
  );

  const selectedTailor = (tailors ?? []).find((t) => t.id === tailorId);
  const activeTailors = (tailors ?? []).filter((t) => t.isActive);

  function handleTailorChange(nextTailorId: string) {
    setTailorId(nextTailorId);
    setSelectedJobIds([]);
    setRent("");
    setManualBill("");
    setDeductedAdvance("");
    setSubmitError(null);
    setConfirmedSettlementId(null);
  }

  function toggleJob(jobId: string, checked: boolean) {
    setSelectedJobIds((current) => (checked ? [...current, jobId] : current.filter((id) => id !== jobId)));
  }

  async function handleSubmit() {
    if (!tailorId || selectedJobIds.length === 0) return;
    setSubmitError(null);
    try {
      const settlement = await createSettlement({
        tailorId,
        jobIds: selectedJobIds,
        ...(rent.trim() ? { rent: Number(rent) } : {}),
        ...(manualBill.trim() ? { manualBill: Number(manualBill) } : {}),
        ...(deductedAdvance.trim() ? { deductedAdvance: Number(deductedAdvance) } : {}),
      }).unwrap();
      setSelectedJobIds([]);
      setRent("");
      setManualBill("");
      setDeductedAdvance("");
      setConfirmedSettlementId(settlement.id);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, "Failed to create settlement."));
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Payroll Settlement
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pick a tailor to see their unpaid, completed jobs, select which ones to settle, and submit — every amount below
        the selection table is computed by the server, not this page.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <FormControl sx={{ minWidth: 320 }}>
          <InputLabel id="settlement-tailor-label">Tailor</InputLabel>
          <Select
            labelId="settlement-tailor-label"
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
        {selectedTailor && (
          <Typography sx={{ mt: 1 }} color="text.secondary">
            Outstanding advance balance: THB {selectedTailor.advanceBalance}
          </Typography>
        )}
      </Paper>

      {tailorId && isLoadingJobs && <LoadingSpinner />}

      {tailorId && isJobsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getApiErrorMessage(jobsError, "Failed to load unpaid jobs for this tailor.")}
        </Alert>
      )}

      {tailorId && !isLoadingJobs && !isJobsError && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Unpaid completed jobs
          </Typography>
          {unpaidJobs?.length === 0 ? (
            <Typography color="text.secondary">This tailor has no unpaid completed jobs right now.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Product / piece</TableCell>
                    <TableCell>Process</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell align="right">Styling</TableCell>
                    <TableCell>Pending extra payments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unpaidJobs?.map((entry) => (
                    <TableRow key={entry.job.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedJobIds.includes(entry.job.id)}
                          onChange={(event) => toggleJob(entry.job.id, event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {entry.product?.name ?? "—"}
                        {entry.component ? ` (${entry.component.slotLabel})` : ""}
                      </TableCell>
                      <TableCell>{entry.process?.name ?? "—"}</TableCell>
                      <TableCell align="right">THB {entry.job.cost}</TableCell>
                      <TableCell align="right">THB {entry.job.stylingPrice}</TableCell>
                      <TableCell>
                        {entry.approvedUnpaidExtraPayments.length === 0
                          ? "—"
                          : entry.approvedUnpaidExtraPayments.map((ep) => `THB ${ep.cost}`).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Divider sx={{ my: 3 }} />

          <Stack spacing={2} sx={{ maxWidth: 360 }}>
            <TextField
              label="Rent"
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              value={rent}
              onChange={(event) => setRent(event.target.value)}
            />
            <TextField
              label="Manual bill"
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              value={manualBill}
              onChange={(event) => setManualBill(event.target.value)}
            />
            <TextField
              label="Deducted advance"
              type="number"
              inputProps={{ min: 0, step: "0.01" }}
              value={deductedAdvance}
              onChange={(event) => setDeductedAdvance(event.target.value)}
              helperText={selectedTailor ? `Outstanding balance: THB ${selectedTailor.advanceBalance}` : undefined}
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}

            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={selectedJobIds.length === 0 || createState.isLoading}
              sx={{ alignSelf: "flex-start" }}
            >
              {createState.isLoading ? "Submitting…" : `Create Settlement (${selectedJobIds.length} job(s))`}
            </Button>
          </Stack>
        </Paper>
      )}

      {confirmedSettlementId && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Settlement confirmed
          </Typography>
          {isLoadingConfirmation && <LoadingSpinner />}
          {settlementDetail && (
            <Stack spacing={2}>
              <Table size="small" sx={{ maxWidth: 420 }}>
                <TableBody>
                  <TableRow>
                    <TableCell>Sub-total</TableCell>
                    <TableCell align="right">THB {settlementDetail.settlement.subTotal}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Deducted advance</TableCell>
                    <TableCell align="right">THB {settlementDetail.settlement.deductedAdvance}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Rent</TableCell>
                    <TableCell align="right">THB {settlementDetail.settlement.rent}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Manual bill</TableCell>
                    <TableCell align="right">THB {settlementDetail.settlement.manualBill}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>Total pay</TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      THB {settlementDetail.settlement.totalPay}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Typography color="text.secondary">{settlementDetail.jobs.length} job(s) settled and marked paid.</Typography>

              {settlementDetail.extraPayments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Extra payments paid by this settlement
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {settlementDetail.extraPayments.map((ep) => (
                      <Chip key={ep.id} label={`THB ${ep.cost}`} color="success" size="small" />
                    ))}
                  </Stack>
                </Box>
              )}

              {settlementDetail.clearedAdvances.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Cash advances cleared by this settlement
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {settlementDetail.clearedAdvances.map((advance) => (
                      <Chip key={advance.id} label={`THB ${advance.amount} — Cleared`} color="success" size="small" />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </Paper>
      )}
    </Box>
  );
}
