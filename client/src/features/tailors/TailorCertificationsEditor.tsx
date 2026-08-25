import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import { getApiErrorMessage } from "../../api/errorUtils";
import { useListProcessesQuery } from "../catalog/processesApi";
import { useCertifyTailorMutation, useDecertifyTailorMutation } from "./tailorsApi";
import type { ProcessRef } from "./tailorsApi";

interface TailorCertificationsEditorProps {
  tailorId: string;
  certifications: ProcessRef[];
}

/**
 * `TailorsPage.tsx`'s edit-dialog counterpart to `UserRolesEditor.tsx` — a
 * checkbox per real tenant process (reusing `processesApi.ts`'s
 * `useListProcessesQuery`, PHASE_5_TASKS.md Group 1, rather than duplicating
 * that query here), reflecting this tailor's current certifications, each
 * toggle its own committed request against
 * `/tailors/:tailorId/processes[/:processId]`. Same "no bulk reconcile, no
 * local draft" reasoning as `UserRolesEditor.tsx`.
 */
export function TailorCertificationsEditor({ tailorId, certifications }: TailorCertificationsEditorProps) {
  const { data: allProcesses, isLoading } = useListProcessesQuery();
  const [certifyTailor] = useCertifyTailorMutation();
  const [decertifyTailor] = useDecertifyTailorMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const certifiedIds = new Set(certifications.map((process) => process.id));

  async function handleToggle(processId: string, processName: string, checked: boolean) {
    setActionError(null);
    try {
      if (checked) {
        await certifyTailor({ tailorId, processId }).unwrap();
      } else {
        await decertifyTailor({ tailorId, processId }).unwrap();
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, `Failed to ${checked ? "certify" : "decertify"} for "${processName}".`));
    }
  }

  if (isLoading) {
    return <Typography color="text.secondary">Loading processes…</Typography>;
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Certified processes ({certifications.length})
      </Typography>
      {allProcesses?.length === 0 ? (
        <Typography color="text.secondary">No processes exist yet.</Typography>
      ) : (
        <FormGroup>
          {allProcesses?.map((process) => (
            <FormControlLabel
              key={process.id}
              control={
                <Checkbox
                  checked={certifiedIds.has(process.id)}
                  onChange={(event) => handleToggle(process.id, process.name, event.target.checked)}
                />
              }
              label={process.name}
            />
          ))}
        </FormGroup>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {actionError}
        </Alert>
      )}
    </Box>
  );
}
