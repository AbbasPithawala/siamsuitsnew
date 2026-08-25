import { useState } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useHasPermission } from "../auth/useHasPermission";
import { useGetFittingQuery, useSetFittingValuesMutation } from "./fittingsApi";
import type { FittingWithValues } from "./fittingsApi";
import { useProductMeasurementsQuery } from "../measurements/measurementsApi";
import type { ProductMeasurementLink } from "../measurements/measurementsApi";
import "../../styles/legacyAdmin/App.css";
import "../../styles/legacyAdmin/admin.css";

function labelFor(link: ProductMeasurementLink): string {
  const { name, thaiName } = link.measurementDefinition;
  return thaiName ? `${name} (${thaiName})` : name;
}

/**
 * The fit x measurement matrix editor for one fitting — PHASE_8_TASKS.md
 * Group 6.3. Deliberately transposed from legacy `ManageMeasurementFitsProduct.jsx`
 * (which lays out one row per fitting, one column per measurement, for every
 * fitting at once): this build is one row per the product's real linked
 * measurements, in their configured `sequence_order` (Group 1), with a
 * single editable adjustment-value cell for the one fitting currently being
 * edited — matching the per-fitting screen navigation `FittingsPage.tsx`
 * links into ("Edit Values" per row) rather than an all-fittings table.
 *
 * `orderedValues` is seeded once from the resolved `fitting`/`links` queries
 * via `FittingValuesEditor`, remounted per `fittingId` (this page's own
 * `key`) rather than resynced through an effect — same reasoning as
 * `ManageLinkedItemsDialog`'s doc comment (this project's
 * `react-hooks/set-state-in-effect` lint rule) and the same loading-gate
 * precaution `ProductMeasurementsDialog` needed: the editor only renders
 * once both the fitting's real values and the product's real measurement
 * links have resolved, not while either is still `undefined`.
 */
export function FittingValuesPage() {
  const { productId, fittingId } = useParams<{ productId: string; fittingId: string }>();
  if (!productId || !fittingId) {
    return <Alert severity="error">Missing product or fitting.</Alert>;
  }
  return <FittingValuesPageContent key={fittingId} productId={productId} fittingId={fittingId} />;
}

function FittingValuesPageContent({ productId, fittingId }: { productId: string; fittingId: string }) {
  const canManage = useHasPermission("catalog.fittings.manage");
  const { data: fitting, isLoading: fittingLoading, isError: fittingIsError, error: fittingError } =
    useGetFittingQuery(fittingId);
  const { data: links, isLoading: linksLoading, isError: linksIsError, error: linksError } =
    useProductMeasurementsQuery(productId);

  const backLink = (
    <RouterLink to={`/catalog/products/${productId}/fittings`} className="action backButton">
      <ArrowBackIcon />
    </RouterLink>
  );

  if (fittingLoading || linksLoading) {
    return <LoadingSpinner />;
  }

  if (fittingIsError || !fitting) {
    return (
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Fitting Values</strong>
            {backLink}
          </div>
          <Alert severity="error" sx={{ m: 2 }}>
            {getApiErrorMessage(fittingError, "Failed to load this fitting.")}
          </Alert>
        </div>
      </div>
    );
  }

  if (linksIsError || !links) {
    return (
      <div className="content-wrapper">
        <div className="order-table manage-page">
          <div className="top-heading-title">
            <strong>Fitting Values</strong>
            {backLink}
          </div>
          <Alert severity="error" sx={{ m: 2 }}>
            {getApiErrorMessage(linksError, "Failed to load this product's measurements.")}
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <FittingValuesEditor fitting={fitting} links={links} canManage={canManage} backLink={backLink} />
  );
}

function FittingValuesEditor({
  fitting,
  links,
  canManage,
  backLink,
}: {
  fitting: FittingWithValues;
  links: ProductMeasurementLink[];
  canManage: boolean;
  backLink: ReactNode;
}) {
  const [setFittingValues, { isLoading: isSaving, error: saveError }] = useSetFittingValuesMutation();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fitting.values.map((entry) => [entry.measurementDefinitionId, entry.value]))
  );
  const [saved, setSaved] = useState(false);

  function handleValueChange(measurementDefinitionId: string, next: string) {
    setSaved(false);
    setValues((current) => ({ ...current, [measurementDefinitionId]: next }));
  }

  async function handleSave() {
    const payload = links
      .map((link) => ({
        measurementDefinitionId: link.measurementDefinitionId,
        value: (values[link.measurementDefinitionId] ?? "").trim(),
      }))
      .filter((entry) => entry.value !== "");
    try {
      await setFittingValues({ id: fitting.id, values: payload }).unwrap();
      setSaved(true);
    } catch {
      // surfaced below via saveError
    }
  }

  return (
    <div className="content-wrapper">
      <div className="order-table manage-page">
        <div className="top-heading-title">
          <strong>{fitting.name} — Fitting Values</strong>
          {backLink}
        </div>

        <div className="factory-user-from-NM pd-15">
          {links.length === 0 ? (
            <p>This product has no measurements to set fitting values for.</p>
          ) : (
            <div className="modal-inner-content">
              <table className="table">
                <thead>
                  <tr>
                    <th>Measurement</th>
                    <th>Adjustment Value</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td>{labelFor(link)}</td>
                      <td>
                        <input
                          className="measurementfit"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`${labelFor(link)} adjustment value`}
                          value={values[link.measurementDefinitionId] ?? ""}
                          onChange={(event) => handleValueChange(link.measurementDefinitionId, event.target.value)}
                          disabled={!canManage}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {saveError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {getApiErrorMessage(saveError, "Failed to save fitting values.")}
                </Alert>
              )}
              {saved && !saveError && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Fitting values saved.
                </Alert>
              )}

              {canManage && (
                <div className="append-inputs-btn mt-15">
                  <button type="button" className="custom-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
