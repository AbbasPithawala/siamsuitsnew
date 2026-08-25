import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useGetTailorQuery, useListTailorsQuery } from "../tailors/tailorsApi";
import type { ProcessRef } from "../tailors/tailorsApi";

interface CertificationProbeProps {
  tailorId: string;
  onLoaded: (tailorId: string, certifications: ProcessRef[]) => void;
}

/**
 * One `useGetTailorQuery` per tailor, same technique `TailorsPage.tsx`'s
 * `TailorRow` already uses to show each tailor's certified-process count —
 * there is no bulk "certifications for all tailors" endpoint, so this is the
 * established pattern for this data, not a new one. Rendered off-screen; it
 * exists purely to populate `certById` in the parent via `onLoaded`, so the
 * actual `<Select>` below can render plain `<MenuItem>` children (MUI's
 * `Select` reads `value` directly off its immediate children, so the
 * filtering has to happen before those children are built, not inside them).
 */
function CertificationProbe({ tailorId, onLoaded }: CertificationProbeProps) {
  const { data } = useGetTailorQuery(tailorId);
  useEffect(() => {
    if (data) {
      onLoaded(tailorId, data.certifications);
    }
  }, [data, tailorId, onLoaded]);
  return null;
}

interface CertifiedTailorSelectProps {
  processId: string | null;
  processName: string;
  value: string;
  onChange: (tailorId: string) => void;
  disabled?: boolean;
}

/**
 * PHASE_6_TASKS.md Group 7's job-assignment screen: a tailor picker
 * restricted to tailors certified for the component's next assignable
 * process (checked against `tailor_processes` via the existing
 * `GET /tailors/:id` `certifications` array, Phase 3 Group 7 / Phase 6
 * Group 4). The backend (`assignNextStep`) re-checks certification itself
 * and would 403 `NOT_CERTIFIED` regardless — this is purely a UX
 * improvement so an uncertified tailor is never offered in the first place.
 */
export function CertifiedTailorSelect({ processId, processName, value, onChange, disabled }: CertifiedTailorSelectProps) {
  const { data: tailors } = useListTailorsQuery();
  const [certById, setCertById] = useState<Record<string, ProcessRef[]>>({});

  const handleLoaded = useCallback((tailorId: string, certifications: ProcessRef[]) => {
    setCertById((current) => (current[tailorId] === certifications ? current : { ...current, [tailorId]: certifications }));
  }, []);

  const activeTailors = (tailors ?? []).filter((tailor) => tailor.isActive);
  const certifiedTailors = processId
    ? activeTailors.filter((tailor) => certById[tailor.id]?.some((process) => process.id === processId))
    : [];
  const stillLoading = processId !== null && activeTailors.some((tailor) => certById[tailor.id] === undefined);

  return (
    <Box>
      <Box sx={{ display: "none" }}>
        {activeTailors.map((tailor) => (
          <CertificationProbe key={tailor.id} tailorId={tailor.id} onLoaded={handleLoaded} />
        ))}
      </Box>
      <FormControl fullWidth disabled={disabled || !processId || stillLoading}>
        <InputLabel id="certified-tailor-label">Tailor</InputLabel>
        <Select
          labelId="certified-tailor-label"
          label="Tailor"
          value={certifiedTailors.some((tailor) => tailor.id === value) ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {certifiedTailors.map((tailor) => (
            <MenuItem key={tailor.id} value={tailor.id}>
              {tailor.name}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {stillLoading
            ? "Checking certifications…"
            : certifiedTailors.length === 0
              ? `No active tailor is certified for "${processName}".`
              : `Showing tailors certified for "${processName}".`}
        </FormHelperText>
      </FormControl>
    </Box>
  );
}
