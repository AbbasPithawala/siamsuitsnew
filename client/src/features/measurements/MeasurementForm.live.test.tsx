import { useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { MeasurementForm } from "./MeasurementForm";
import type { MeasurementValue } from "./MeasurementForm";
import type { ProductMeasurementLink } from "./measurementsApi";
import type { FeatureValue, ProductFeature } from "../featureSelector/featuresApi";

/** No-op defaults for the `measurementNote`/`features` props (PHASE_9_TASKS.md Group 3) tests below don't otherwise exercise. */
const NOOP_NOTE_PROPS = { measurementNote: "", onMeasurementNoteChange: () => {} };
const NOOP_FEATURE_PROPS = { features: [] as FeatureValue[], onFeaturesChange: () => {} };

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring the pattern established by `src/api/baseApi.live.test.ts` and
 * `src/features/auth/auth.live.test.tsx`: log in with the seeded dev admin,
 * then exercise the real RTK Query pipeline end to end. Skips itself
 * (rather than failing `npm test`) if the server isn't reachable.
 *
 * Rather than inventing fixture products, this uses the real Phase 2 ETL
 * catalog already migrated into the dev DB (`server` `PHASE_2_TASKS.md`
 * Group 6, completed 2026-08-08: 6 products / 43 measurement definitions /
 * 60 product_measurements links) to find two products whose linked
 * measurement-definition sets genuinely differ — the actual proof this
 * component requires, not a synthetic stand-in for it. The one exception is
 * the "zero measurements" case: no seeded product happens to have an empty
 * set, so that one throwaway product is created (and deleted) here.
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

async function fetchSeedToken(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SEED_CREDENTIALS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { token: string } };
    return body.data.token;
  } catch {
    return null;
  }
}

const seededToken = await fetchSeedToken();

async function apiRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildTestStore(token: string | null) {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token }) => state;
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function labelFor(link: ProductMeasurementLink): string {
  const { name, thaiName } = link.measurementDefinition;
  return thaiName ? `${name} (${thaiName})` : name;
}

interface RealProduct {
  id: string;
  name: string;
  links: ProductMeasurementLink[];
}

/** Finds two real products whose measurement sets differ in both directions (each has at least one link the other lacks) — the strongest, least-hardcoded proof of "genuinely different sets". */
function pickTwoWithAsymmetricDifference(products: RealProduct[]): { a: RealProduct; b: RealProduct; aOnly: ProductMeasurementLink; bOnly: ProductMeasurementLink } | null {
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i]!;
      const b = products[j]!;
      const bIds = new Set(b.links.map((l) => l.measurementDefinitionId));
      const aIds = new Set(a.links.map((l) => l.measurementDefinitionId));
      const aOnly = a.links.find((l) => !bIds.has(l.measurementDefinitionId));
      const bOnly = b.links.find((l) => !aIds.has(l.measurementDefinitionId));
      if (aOnly && bOnly) {
        return { a, b, aOnly, bOnly };
      }
    }
  }
  return null;
}

describe.skipIf(!seededToken)("MeasurementForm (live siam/server integration)", () => {
  let productA: RealProduct;
  let productB: RealProduct;
  let aOnlyLink: ProductMeasurementLink;
  let bOnlyLink: ProductMeasurementLink;
  let emptyProductId: string;

  beforeAll(async () => {
    const token = seededToken as string;
    const productList = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
    const withLinks: RealProduct[] = [];
    for (const product of productList.data) {
      const linksRes = await apiRequest<{ data: ProductMeasurementLink[] }>(
        `/products/${product.id}/measurements`,
        token
      );
      if (linksRes.data.length > 0) {
        withLinks.push({ id: product.id, name: product.name, links: linksRes.data });
      }
    }

    const picked = pickTwoWithAsymmetricDifference(withLinks);
    if (!picked) {
      throw new Error(
        "Expected at least two seeded products with asymmetrically differing measurement sets " +
          "(the Phase 2 ETL catalog normally provides this, e.g. jacket vs overcoat)"
      );
    }
    productA = picked.a;
    productB = picked.b;
    aOnlyLink = picked.aOnly;
    bOnlyLink = picked.bOnly;

    const created = await apiRequest<{ data: { id: string } }>("/products", token, {
      method: "POST",
      body: JSON.stringify({ name: `MeasurementForm empty-state fixture ${Date.now()}` }),
    });
    emptyProductId = created.data.id;
  });

  afterAll(async () => {
    if (seededToken && emptyProductId) {
      await apiRequest(`/products/${emptyProductId}`, seededToken, { method: "DELETE" });
    }
  });

  it("renders one input row per linked measurement definition for a real product", async () => {
    render(
      <Provider store={buildTestStore(seededToken)}>
        <MeasurementForm productId={productA.id} value={[]} onChange={() => {}} {...NOOP_NOTE_PROPS} {...NOOP_FEATURE_PROPS} />
      </Provider>
    );

    for (const link of productA.links) {
      await screen.findByText(labelFor(link));
    }
    // 2 real textboxes (value/adjustment) per row, plus the always-rendered measurementNote
    // textarea (also role "textbox") — the read-only Total column is a disabled
    // type="number" input (ARIA role "spinbutton"), not counted here.
    expect(screen.getAllByRole("textbox")).toHaveLength(productA.links.length * 2 + 1);
    expect(screen.queryByText(labelFor(bOnlyLink))).not.toBeInTheDocument();
  });

  it("renders a genuinely different set of rows for a second real product, with zero code changes", async () => {
    render(
      <Provider store={buildTestStore(seededToken)}>
        <MeasurementForm productId={productB.id} value={[]} onChange={() => {}} {...NOOP_NOTE_PROPS} {...NOOP_FEATURE_PROPS} />
      </Provider>
    );

    for (const link of productB.links) {
      await screen.findByText(labelFor(link));
    }
    expect(screen.getAllByRole("textbox")).toHaveLength(productB.links.length * 2 + 1);
    expect(screen.queryByText(labelFor(aOnlyLink))).not.toBeInTheDocument();
  });

  it("calls onChange with an immutably-updated array when typing into value/adjustment fields, and live-computes the read-only Total column", async () => {
    function Harness() {
      const [value, setValue] = useState<MeasurementValue[]>([]);
      return (
        <>
          <MeasurementForm productId={productA.id} value={value} onChange={setValue} {...NOOP_NOTE_PROPS} {...NOOP_FEATURE_PROPS} />
          <pre data-testid="current-value">{JSON.stringify(value)}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    const targetLabel = labelFor(productA.links[0]!);
    await screen.findByText(targetLabel);

    const valueInput = screen.getByRole("textbox", { name: `${targetLabel} value` });
    const adjustmentInput = screen.getByRole("textbox", { name: `${targetLabel} adjustment` });
    const totalInput = screen.getByRole("spinbutton", { name: `${targetLabel} total` }) as HTMLInputElement;

    // Body-size/adjustment fields display "0" (not blank) until the customer has a real
    // value, per PHASE_10_TASKS.md's measurement-backfill fix — so the live-computed
    // total for an untouched row is "0.00", not blank.
    expect(totalInput.value).toBe("0.00");

    await user.type(valueInput, "38");
    await user.type(adjustmentInput, "1.5");

    const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
    expect(current).toHaveLength(1);
    expect(current[0]).toEqual({
      measurementDefinitionId: productA.links[0]!.measurementDefinitionId,
      value: "38",
      adjustmentValue: "1.5",
    });
    // Mirrors the server's computeTotalValue (value + adjustmentValue, 2 decimal places) for live display.
    expect(totalInput.value).toBe("39.50");
    expect(totalInput).toBeDisabled();
  });

  it("restricts value/adjustment input to digits and at most 2 integer + 2 decimal digits, matching legacy's real handleValueChange restriction", async () => {
    function Harness() {
      const [value, setValue] = useState<MeasurementValue[]>([]);
      return (
        <>
          <MeasurementForm productId={productA.id} value={value} onChange={setValue} {...NOOP_NOTE_PROPS} {...NOOP_FEATURE_PROPS} />
          <pre data-testid="current-value">{JSON.stringify(value)}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    const targetLabel = labelFor(productA.links[0]!);
    await screen.findByText(targetLabel);
    const valueInput = screen.getByRole("textbox", { name: `${targetLabel} value` });

    // Non-digit characters are dropped entirely, live, not just at submit.
    await user.type(valueInput, "3a8b.c5d");
    expect(valueInput).toHaveValue("38.5");

    // A second decimal point is dropped (only the first one counts).
    await user.clear(valueInput);
    await user.type(valueInput, "1.2.3");
    expect(valueInput).toHaveValue("1.23");

    // At most 2 integer digits.
    await user.clear(valueInput);
    await user.type(valueInput, "12345");
    expect(valueInput).toHaveValue("12");

    // At most 2 decimal digits.
    await user.clear(valueInput);
    await user.type(valueInput, "12.3456");
    expect(valueInput).toHaveValue("12.34");

    const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
    expect(current[0]?.value).toBe("12.34");
  });

  it("round-trips the measurementNote field through the controlled onChange prop", async () => {
    function Harness() {
      const [note, setNote] = useState("");
      return (
        <>
          <MeasurementForm
            productId={productA.id}
            value={[]}
            onChange={() => {}}
            measurementNote={note}
            onMeasurementNoteChange={setNote}
            {...NOOP_FEATURE_PROPS}
          />
          <pre data-testid="current-note">{note}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    await screen.findByText(labelFor(productA.links[0]!));
    const noteField = screen.getByLabelText("Note") as HTMLTextAreaElement;
    await user.type(noteField, "Customer prefers a shorter jacket length");

    expect(screen.getByTestId("current-note").textContent).toBe("Customer prefers a shorter jacket length");
    expect(noteField.value).toBe("Customer prefers a shorter jacket length");
  });

  it("renders a real product with zero linked measurements without error", async () => {
    render(
      <Provider store={buildTestStore(seededToken)}>
        <MeasurementForm productId={emptyProductId} value={[]} onChange={() => {}} {...NOOP_NOTE_PROPS} {...NOOP_FEATURE_PROPS} />
      </Provider>
    );

    await screen.findByText(/no measurements/i);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

/**
 * PHASE_9_TASKS.md Group 3, Decision 4: Shoulder Type render-slot consumption
 * against the real seeded catalog data (Group 0's `seedRenderSlotFeatures`) —
 * a real "jacket" product with a real `render_slot = 'shoulder_type'` feature
 * and 3 real styles (Sloping/Standard/Square), each with a real image path.
 */
describe.skipIf(!seededToken)("MeasurementForm Shoulder Type render slot (live siam/server integration, PHASE_9_TASKS.md Group 3)", () => {
  let jacketProductId: string;
  let shoulderTypeFeature: ProductFeature;

  beforeAll(async () => {
    const token = seededToken as string;
    const productList = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
    const jacket = productList.data.find((p) => p.name.toLowerCase() === "jacket");
    if (!jacket) {
      throw new Error("Expected a real seeded 'jacket' product (PHASE_9_TASKS.md Group 0's seed data)");
    }
    jacketProductId = jacket.id;

    const featuresRes = await apiRequest<{ data: ProductFeature[] }>(
      `/features?productId=${jacketProductId}`,
      token
    );
    const found = featuresRes.data.find((f) => f.renderSlot === "shoulder_type");
    if (!found) {
      throw new Error("Expected the real seeded Shoulder Type feature to be linked to the jacket product");
    }
    shoulderTypeFeature = found;
  });

  it("renders the Shoulder Type section with real styles/images, sourced by renderSlot, and reports selection via onFeaturesChange", async () => {
    function Harness() {
      const [features, setFeatures] = useState<FeatureValue[]>([]);
      return (
        <>
          <MeasurementForm
            productId={jacketProductId}
            value={[]}
            onChange={() => {}}
            {...NOOP_NOTE_PROPS}
            features={features}
            onFeaturesChange={setFeatures}
          />
          <pre data-testid="current-features">{JSON.stringify(features)}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    await screen.findByText(shoulderTypeFeature.name);

    const styles = shoulderTypeFeature.styles ?? [];
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      const radio = screen.getByRole("radio", { name: style.name.trim() }) as HTMLInputElement;
      expect(radio).not.toBeChecked();
      if (style.image) {
        const img = radio.closest("li")?.querySelector("img");
        expect(img).not.toBeNull();
        expect(img?.getAttribute("src")).toBe(style.image);
      }
    }

    const firstStyle = styles[0]!;
    await user.click(screen.getByRole("radio", { name: firstStyle.name.trim() }));

    await waitFor(() => {
      const current = JSON.parse(screen.getByTestId("current-features").textContent ?? "[]") as FeatureValue[];
      expect(current).toEqual([{ featureId: shoulderTypeFeature.id, styleId: firstStyle.id }]);
    });
    expect(screen.getByRole("radio", { name: firstStyle.name.trim() })).toBeChecked();
  });
});

/**
 * PHASE_8_TASKS.md Group 6.4: the "Manual Fit" dropdown consuming Group
 * 6.1-6.3's real `product_fittings`/`fitting_values` — a fresh product +
 * measurement definitions + a real admin-defined fitting with real
 * per-measurement values, isolated from the shared productA/productB fixture
 * above so this doesn't depend on the seeded ETL catalog happening to have a
 * fitting defined on it.
 */
describe.skipIf(!seededToken)("MeasurementForm Manual Fit (live siam/server integration, PHASE_8_TASKS.md Group 6.4)", () => {
  let productId: string;
  let chestDefId: string;
  let waistDefId: string;
  let fittingId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const token = seededToken as string;

    const product = await apiRequest<{ data: { id: string } }>("/products", token, {
      method: "POST",
      body: JSON.stringify({ name: `Manual Fit Product ${suffix}` }),
    });
    productId = product.data.id;

    const chest = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
      method: "POST",
      body: JSON.stringify({ name: `Chest ${suffix}`, slug: `mf-chest-${suffix}` }),
    });
    chestDefId = chest.data.id;
    const waist = await apiRequest<{ data: { id: string } }>("/measurement-definitions", token, {
      method: "POST",
      body: JSON.stringify({ name: `Waist ${suffix}`, slug: `mf-waist-${suffix}` }),
    });
    waistDefId = waist.data.id;

    await apiRequest(`/products/${productId}/measurements`, token, {
      method: "PUT",
      body: JSON.stringify({ measurementDefinitionIds: [chestDefId, waistDefId] }),
    });

    const fitting = await apiRequest<{ data: { id: string } }>(`/products/${productId}/fittings`, token, {
      method: "POST",
      body: JSON.stringify({ name: `Slim ${suffix}` }),
    });
    fittingId = fitting.data.id;

    await apiRequest(`/fittings/${fittingId}/values`, token, {
      method: "PUT",
      body: JSON.stringify({
        values: [
          { measurementDefinitionId: chestDefId, value: "2.50" },
          { measurementDefinitionId: waistDefId, value: "-1.00" },
        ],
      }),
    });
  });

  afterAll(async () => {
    if (seededToken && productId) {
      await apiRequest(`/products/${productId}`, seededToken, { method: "DELETE" });
    }
  });

  it("pre-fills adjustmentValue for every matching measurement from a real fitting's real values, in one onChange call", async () => {
    function Harness() {
      const [value, setValue] = useState<MeasurementValue[]>([]);
      const [changeCount, setChangeCount] = useState(0);
      return (
        <>
          <MeasurementForm
            productId={productId}
            value={value}
            onChange={(next) => {
              setValue(next);
              setChangeCount((count) => count + 1);
            }}
            {...NOOP_NOTE_PROPS}
            {...NOOP_FEATURE_PROPS}
          />
          <pre data-testid="current-value">{JSON.stringify(value)}</pre>
          <pre data-testid="change-count">{changeCount}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    const select = await screen.findByLabelText("Manual Fit");
    await user.selectOptions(select, `Slim ${suffix}`);

    await waitFor(() => {
      const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
      expect(current).toHaveLength(2);
    });

    const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
    const byId = new Map(current.map((entry) => [entry.measurementDefinitionId, entry.adjustmentValue]));
    expect(byId.get(chestDefId)).toBe("2.50");
    expect(byId.get(waistDefId)).toBe("-1.00");

    // Exactly one onChange call for the whole fit selection, not one per measurement.
    expect(screen.getByTestId("change-count").textContent).toBe("1");
  });

  it("preserves an existing manually-typed value on a measurement not touched by the fitting, and overwrites adjustmentValue on one that is", async () => {
    function Harness() {
      const [value, setValue] = useState<MeasurementValue[]>([
        { measurementDefinitionId: chestDefId, value: "40", adjustmentValue: "0.25" },
      ]);
      return (
        <>
          <MeasurementForm
            productId={productId}
            value={value}
            onChange={setValue}
            {...NOOP_NOTE_PROPS}
            {...NOOP_FEATURE_PROPS}
          />
          <pre data-testid="current-value">{JSON.stringify(value)}</pre>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Provider store={buildTestStore(seededToken)}>
        <Harness />
      </Provider>
    );

    const select = await screen.findByLabelText("Manual Fit");
    await user.selectOptions(select, `Slim ${suffix}`);

    await waitFor(() => {
      const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
      const chestEntry = current.find((entry) => entry.measurementDefinitionId === chestDefId);
      expect(chestEntry?.adjustmentValue).toBe("2.50");
    });

    const current = JSON.parse(screen.getByTestId("current-value").textContent ?? "[]") as MeasurementValue[];
    const chestEntry = current.find((entry) => entry.measurementDefinitionId === chestDefId);
    // The customer's real body `value` (not the fitting's adjustment) survives the fit selection untouched.
    expect(chestEntry?.value).toBe("40");
  });
});
