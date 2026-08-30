import { useState } from "react";
// Named barrel import — see JobAssignmentPage.tsx-adjacent screens' comment
// on this project's Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { Print as PrintIcon } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
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
import { resolveUploadUrl } from "../uploads/uploadsApi";
import { useListTailorsQuery } from "../tailors/tailorsApi";
import {
  useCreateSettlementMutation,
  useGenerateJobSlipPdfMutation,
  useGenerateSettlementPdfMutation,
  useGetSettlementQuery,
  useListUnpaidJobsQuery,
} from "./payrollApi";
import type { JobDisplayEntry, UnpaidJobEntry } from "./payrollApi";

/** `entry.job.cost + entry.job.stylingPrice`, plus this job's approved-and-unpaid extra payments — a per-row display total only, mirroring `JobAssignmentPage.tsx`'s identical cost+stylingPrice sum. Never trusted for the actual settlement: `createSettlement` always recomputes `subTotal`/`totalPay` server-side (this page's own long-standing doc comment below), this is just what the operator sees before submitting. */
function jobDisplayTotal(entry: UnpaidJobEntry): number {
  const extraTotal = entry.approvedUnpaidExtraPayments.reduce((sum, ep) => sum + Number(ep.cost), 0);
  return Number(entry.job.cost) + Number(entry.job.stylingPrice) + extraTotal;
}

function itemLabel(entry: JobDisplayEntry): string {
  const productName = entry.product?.name ?? "—";
  return entry.component && entry.component.slotLabel !== productName
    ? `${productName} (${entry.component.slotLabel})`
    : productName;
}

/**
 * Tailor payroll settlement screen — PHASE_6_TASKS.md Group 8. Pick a tailor,
 * see their unpaid *completed* jobs (`listUnpaidJobs`, backed by the new
 * `GET /tailors/:id/unpaid-jobs` read `payroll.service.ts`'s
 * `listUnpaidCompletedJobs` added — see that function's doc comment for why
 * this read didn't exist before), select which to settle, optionally deduct
 * rent/a manual bill/an outstanding advance, and submit through the existing
 * `createSettlement` (`payroll.service.ts`, Phase 3 Group 6). Every dollar
 * amount in the confirmation panel — `subTotal`/`deductedAdvance`/`rent`/
 * `manualBill`/`totalPay` — comes straight from the server response; this
 * screen never sums the *selected* jobs' costs itself as a submission
 * preview, per this codebase's hard "financial totals are always
 * server-computed" rule (see e.g. `orders.service.ts`/`invoices.service.ts`
 * and every order/invoice screen built on them) — `jobDisplayTotal` above is
 * a narrower, lower-stakes per-row display sum of already-server-provided
 * numbers, not a payroll total.
 *
 * Table columns (Group 8 follow-up) mirror legacy `ManageJobs.jsx`'s own
 * settlement table — Tailor/Item/Order #/Date/Description/Type/Cost — rather
 * than this rewrite's original narrower Product/Process/Cost/Styling split,
 * so "which order is this for" and "did this job carry an extra payment"
 * (`Type`: `Extra`/`Normal`) are visible without cross-referencing anything.
 * The print icon per row is legacy's own per-job "Print" action
 * (`generateJobSlipPdf`/`jobSlipPdf.service.ts`) — printable here, before
 * the job is ever settled, exactly like legacy's equivalent button.
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
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [jobSlipError, setJobSlipError] = useState<string | null>(null);
  const [jobSlipLoadingId, setJobSlipLoadingId] = useState<string | null>(null);

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
  const [generateSettlementPdf, pdfState] = useGenerateSettlementPdfMutation();
  const [generateJobSlipPdf] = useGenerateJobSlipPdfMutation();

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
    setPdfError(null);
    setJobSlipError(null);
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

  async function handleViewPdf() {
    if (!tailorId || !confirmedSettlementId) return;
    setPdfError(null);
    try {
      const { path } = await generateSettlementPdf({ tailorId, settlementId: confirmedSettlementId }).unwrap();
      window.open(resolveUploadUrl(path), "_blank", "noopener,noreferrer");
    } catch (err) {
      setPdfError(getApiErrorMessage(err, "Failed to generate PDF."));
    }
  }

  async function handlePrintJobSlip(jobId: string) {
    setJobSlipError(null);
    setJobSlipLoadingId(jobId);
    try {
      const { path } = await generateJobSlipPdf(jobId).unwrap();
      window.open(resolveUploadUrl(path), "_blank", "noopener,noreferrer");
    } catch (err) {
      setJobSlipError(getApiErrorMessage(err, "Failed to generate the job slip."));
    } finally {
      setJobSlipLoadingId(null);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom>
        Payroll Settlement
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pick a tailor to see their unpaid, completed jobs, select which ones to settle, and submit — every amount in
        the confirmation panel below is computed by the server, not this page.
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
          {jobSlipError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {jobSlipError}
            </Alert>
          )}

          {unpaidJobs?.length === 0 ? (
            <Typography color="text.secondary">This tailor has no unpaid completed jobs right now.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Tailor</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Order #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell align="right">Action</TableCell>
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
                      <TableCell>{selectedTailor?.name ?? "—"}</TableCell>
                      <TableCell>{itemLabel(entry)}</TableCell>
                      <TableCell>{entry.order?.orderNumber ?? "—"}</TableCell>
                      <TableCell>{new Date(entry.job.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.process?.name ?? "—"}</TableCell>
                      <TableCell>{entry.approvedUnpaidExtraPayments.length > 0 ? "Extra" : "Normal"}</TableCell>
                      <TableCell align="right">THB {jobDisplayTotal(entry).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Print slip for ${itemLabel(entry)}`}
                          onClick={() => handlePrintJobSlip(entry.job.id)}
                          disabled={jobSlipLoadingId === entry.job.id}
                        >
                          <PrintIcon fontSize="small" />
                        </IconButton>
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Settlement confirmed</Typography>
            <Button variant="outlined" onClick={handleViewPdf} disabled={pdfState.isLoading}>
              {pdfState.isLoading ? "Generating…" : "Print / Download PDF"}
            </Button>
          </Stack>
          {pdfError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {pdfError}
            </Alert>
          )}
          {isLoadingConfirmation && <LoadingSpinner />}
          {settlementDetail && (
            <Stack spacing={2}>
              {settlementDetail.jobs.length > 0 && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order #</TableCell>
                        <TableCell>Item</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {settlementDetail.jobs.map((entry) => (
                        <TableRow key={entry.job.id}>
                          <TableCell>{entry.order?.orderNumber ?? "—"}</TableCell>
                          <TableCell>{itemLabel(entry)}</TableCell>
                          <TableCell>{entry.process?.name ?? "—"}</TableCell>
                          <TableCell align="right">
                            THB {(Number(entry.job.cost) + Number(entry.job.stylingPrice)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {settlementDetail.extraPayments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Extra payments paid by this settlement
                  </Typography>
                  <Stack spacing={0.5}>
                    {settlementDetail.extraPayments.map((ep) => (
                      <Typography key={ep.id} variant="body2">
                        THB {ep.cost} added for {ep.category?.name ?? "extra payment"}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

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
