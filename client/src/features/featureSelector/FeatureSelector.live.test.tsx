import { useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import { FeatureSelector } from "./FeatureSelector";
import type { FeatureValue } from "./featuresApi";
import { setFeatureAdditionalFlag } from "./testSupport/featureFlagsDbHelper";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `src/api/baseApi.live.test.ts`'s pattern. Covers
 * `PHASE_9_TASKS.md` Group 4's rebuild: render-slot exclusion (Shoulder
 * Type/Monogram Position), the inline text/structured zone vs. the choice
 * tab bar, the additional-styles toggle, `ChoiceFeatureField`'s tri-mode
 * sub-option rendering, and Monogram Position composed into
 * `<MonogramFeatureField>`.
 *
 * Fixtures used:
 *  - the real, pre-migrated "vest" product (only `choice`-type features, all
 *    `isAdditional: false`, no sub-options) — proves the basic tab bar +
 *    auto-advance-to-next-tab against genuine multi-feature data.
 *  - the real "shirt" product — has `fabric` (text), `monogram` (structured),
 *    real `Shoulder Type`/`Monogram Position` render-slot features, and a
 *    "collar" feature whose real styles exercise tri-mode 1 ("pin collar",
 *    options with real images) and tri-mode 2 ("button down", style image +
 *    no option images).
 *  - a throwaway product/feature/style/options created via the real API
 *    with no images anywhere, to exercise tri-mode 3 (plain text list) —
 *    not present in today's real seeded catalog (checked directly, see
 *    `f-*.json` inspection log in the Group 4 writeup).
 *  - a throwaway product with one `isAdditional: true` feature, flipped via
 *    direct DB write (`testSupport/featureFlagsDbHelper.ts`) since no real
 *    admin API sets that flag yet (Group 0 deliberately shipped none) — the
 *    real seeded catalog has zero `isAdditional: true` features today.
 *  - a throwaway product + one `choice`/`text`/`structured` feature each
 *    (unchanged from the original pass), to prove the same component code
 *    renders all three types together with zero per-product branching.
 */

const SEED_CREDENTIALS = {
  tenant: "siam-suits",
  username: "admin",
  password: "ChangeMe123!",
};

const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;

const VEST_PRODUCT_ID = "8b8f1b08-7735-448e-b067-8f367a3b00a6";
const SHIRT_PRODUCT_ID = "15e9db3d-8843-4336-bad7-eccbe346dc95";
const JACKET_PRODUCT_ID = "0a63d0a3-c5f2-4a65-bc13-27c0e0db8a92";

async function apiFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

async function apiJson<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(token, path, init);
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed with ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

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

interface MixedTypeFixture {
  productId: string;
  cleanup: () => Promise<void>;
}

async function createMixedTypeFixture(token: string): Promise<MixedTypeFixture> {
  const suffix = Math.random().toString(36).slice(2, 8);

  const product = (await apiJson<{ data: { id: string } }>(token, "/products", {
    method: "POST",
    body: JSON.stringify({ name: `feature-selector-fixture-${suffix}`, description: "FeatureSelector live test fixture" }),
  })).data;

  const choiceFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: `Fixture Choice ${suffix}`, type: "choice", productIds: [product.id] }),
  })).data;
  await apiFetch(token, `/features/${choiceFeature.id}/styles`, {
    method: "POST",
    body: JSON.stringify({ name: "Fixture Style" }),
  });

  const textFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: `Fixture Fabric ${suffix}`, type: "text", productIds: [product.id] }),
  })).data;

  const structuredFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: `Fixture Monogram ${suffix}`, type: "structured", productIds: [product.id] }),
  })).data;

  return {
    productId: product.id,
    async cleanup() {
      await apiFetch(token, `/features/${choiceFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/features/${textFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/features/${structuredFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/products/${product.id}`, { method: "DELETE" });
    },
  };
}

interface TriModeThreeFixture {
  productId: string;
  featureName: string;
  styleName: string;
  optionNames: [string, string];
  cleanup: () => Promise<void>;
}

/** No option, and no parent style, has an image anywhere — legacy `Options.jsx`'s third tri-mode branch. */
async function createTriModeThreeFixture(token: string): Promise<TriModeThreeFixture> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const featureName = `Fixture NoImage Choice ${suffix}`;
  const styleName = "Fixture Style With Options";

  const product = (await apiJson<{ data: { id: string } }>(token, "/products", {
    method: "POST",
    body: JSON.stringify({ name: `feature-selector-trimode3-${suffix}` }),
  })).data;

  const feature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: featureName, type: "choice", productIds: [product.id] }),
  })).data;

  const style = (await apiJson<{ data: { id: string } }>(token, `/features/${feature.id}/styles`, {
    method: "POST",
    body: JSON.stringify({ name: styleName }),
  })).data;

  await apiFetch(token, `/styles/${style.id}/options`, { method: "POST", body: JSON.stringify({ name: "Option A" }) });
  await apiFetch(token, `/styles/${style.id}/options`, { method: "POST", body: JSON.stringify({ name: "Option B" }) });

  return {
    productId: product.id,
    featureName,
    styleName,
    optionNames: ["Option A", "Option B"],
    async cleanup() {
      await apiFetch(token, `/features/${feature.id}`, { method: "DELETE" });
      await apiFetch(token, `/products/${product.id}`, { method: "DELETE" });
    },
  };
}

interface AdditionalStylesFixture {
  productId: string;
  primaryFeatureName: string;
  additionalFeatureName: string;
  cleanup: () => Promise<void>;
}

async function createAdditionalStylesFixture(token: string): Promise<AdditionalStylesFixture> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const primaryFeatureName = `Fixture Primary ${suffix}`;
  const additionalFeatureName = `Fixture Additional ${suffix}`;

  const product = (await apiJson<{ data: { id: string } }>(token, "/products", {
    method: "POST",
    body: JSON.stringify({ name: `feature-selector-additional-${suffix}` }),
  })).data;

  const primaryFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: primaryFeatureName, type: "choice", productIds: [product.id] }),
  })).data;
  await apiFetch(token, `/features/${primaryFeature.id}/styles`, { method: "POST", body: JSON.stringify({ name: "Primary Style" }) });

  const additionalFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: additionalFeatureName, type: "choice", productIds: [product.id] }),
  })).data;
  await apiFetch(token, `/features/${additionalFeature.id}/styles`, {
    method: "POST",
    body: JSON.stringify({ name: "Additional Style" }),
  });
  await setFeatureAdditionalFlag(additionalFeature.id, true);

  return {
    productId: product.id,
    primaryFeatureName,
    additionalFeatureName,
    async cleanup() {
      await apiFetch(token, `/features/${primaryFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/features/${additionalFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/products/${product.id}`, { method: "DELETE" });
    },
  };
}

interface AutoAdvanceFixture {
  productId: string;
  firstFeatureName: string;
  secondFeatureName: string;
  cleanup: () => Promise<void>;
}

/**
 * Two throwaway `choice` features on a private, never-shared product, each with a single leaf
 * style (no sub-options) — proves the tab-bar's auto-advance-on-final-selection behavior
 * deterministically. Deliberately NOT the shared, real `VEST_PRODUCT_ID` fixture the tab-bar
 * *rendering* test above still uses (that one only needs *some* choice features to exist,
 * order-agnostic, so it's fine against real, external data): this test hardcodes which tab comes
 * next, and the real seeded catalog's own `feature_products.sequence_order` for vest's features
 * has drifted to distinct, non-tied values over time (confirmed directly against the live
 * Postgres `feature_products` table — "front button"/"vest pocket"/"vest back" are `0`/`1`/`2`,
 * not the tied-at-0-broken-by-name state this test used to depend on), an external mutation this
 * test file doesn't control and can't reliably clean up after. Both fixture features are named so
 * their alphabetical order matches the intended tab order: both tie at the DB's real
 * `sequence_order` default (`createFeature` never sets it explicitly, see
 * `features.service.ts#createFeature`), and `listFeaturesInTx` tie-breaks ties by feature name.
 */
async function createAutoAdvanceFixture(token: string): Promise<AutoAdvanceFixture> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const firstFeatureName = `Fixture AutoAdvance A ${suffix}`;
  const secondFeatureName = `Fixture AutoAdvance B ${suffix}`;

  const product = (await apiJson<{ data: { id: string } }>(token, "/products", {
    method: "POST",
    body: JSON.stringify({ name: `feature-selector-autoadvance-${suffix}` }),
  })).data;

  const firstFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: firstFeatureName, type: "choice", productIds: [product.id] }),
  })).data;
  await apiFetch(token, `/features/${firstFeature.id}/styles`, {
    method: "POST",
    body: JSON.stringify({ name: "First Style" }),
  });

  const secondFeature = (await apiJson<{ data: { id: string } }>(token, "/features", {
    method: "POST",
    body: JSON.stringify({ name: secondFeatureName, type: "choice", productIds: [product.id] }),
  })).data;
  await apiFetch(token, `/features/${secondFeature.id}/styles`, {
    method: "POST",
    body: JSON.stringify({ name: "Second Style" }),
  });

  return {
    productId: product.id,
    firstFeatureName,
    secondFeatureName,
    async cleanup() {
      await apiFetch(token, `/features/${firstFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/features/${secondFeature.id}`, { method: "DELETE" });
      await apiFetch(token, `/products/${product.id}`, { method: "DELETE" });
    },
  };
}

function buildTestStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: (state = { token: seededToken }) => state,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

/**
 * A real stateful parent around `<FeatureSelector>`, exactly the shape any
 * real caller (Group 7's wizard) needs to provide for a *controlled*
 * component: `FeatureSelector` itself owns no state, so a test driving user
 * interaction needs something that re-renders it with the updated `value`
 * after each `onChange`, same as production usage would.
 */
function ControlledFeatureSelector({
  productId,
  onChangeSpy,
}: {
  productId: string;
  onChangeSpy: (value: FeatureValue[]) => void;
}) {
  const [value, setValue] = useState<FeatureValue[]>([]);
  return (
    <FeatureSelector
      productId={productId}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy(next);
      }}
    />
  );
}

function renderSelector(productId: string, onChangeSpy: (value: FeatureValue[]) => void = vi.fn()) {
  const store = buildTestStore();
  return render(
    <Provider store={store}>
      <ControlledFeatureSelector productId={productId} onChangeSpy={onChangeSpy} />
    </Provider>
  );
}

/**
 * The `<Box>` wrapping one *inline* (text/structured) feature's heading +
 * its rendered field — those still render an `<h6>` heading, unlike `choice`
 * features (now tabs, found via `getByRole("tab", ...)` instead).
 */
function getInlineFeatureSection(headingPattern: RegExp): HTMLElement {
  const heading = screen.getByRole("heading", { name: headingPattern });
  return heading.closest("div") as HTMLElement;
}

describe.skipIf(!seededToken)("FeatureSelector (live siam/server integration)", () => {
  it("renders a real product with only choice-type features as a tab bar (vest)", async () => {
    renderSelector(VEST_PRODUCT_ID);

    await screen.findByRole("tab", { name: /front button/i });
    expect(screen.getByRole("tab", { name: /vest back/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /vest pocket/i })).toBeInTheDocument();
    // "Piping" is linked to 6 real products (jacket, overcoat, tuxedojacket, shirt, pant,
    // vest) — rendering it correctly here proves multi-product linkage doesn't confuse a
    // single product's feature list. It has `render_slot = 'piping'` (matches legacy's real
    // always-visible swatch grid, never a tab — see `PipingFeatureField`'s doc comment), so
    // it must NOT appear in the tab bar, only as its own inline heading/section.
    expect(screen.queryByRole("tab", { name: /piping/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^piping$/i })).toBeInTheDocument();
    // No real "additional" feature exists on vest — the toggle section
    // shouldn't render at all when there's nothing to gate.
    expect(screen.queryByText(/show additional styles/i)).not.toBeInTheDocument();
  });

  describe("auto-advance to the next tab (fixture, immune to the shared vest product's real sequence_order drift)", () => {
    let fixture: AutoAdvanceFixture;

    beforeAll(async () => {
      fixture = await createAutoAdvanceFixture(seededToken as string);
    });

    afterAll(async () => {
      await fixture.cleanup();
    });

    it("fires onChange with a correctly shaped FeatureValue when a style is picked, and auto-advances to the next tab", async () => {
      const handleChange = vi.fn();
      renderSelector(fixture.productId, handleChange);
      const user = userEvent.setup();

      const firstTabPattern = new RegExp(fixture.firstFeatureName, "i");
      const secondTabPattern = new RegExp(fixture.secondFeatureName, "i");

      await screen.findByRole("tab", { name: firstTabPattern });
      expect(screen.getByRole("tab", { name: firstTabPattern })).toHaveAttribute("aria-selected", "true");

      const tabPanel = screen.getByRole("tabpanel");
      const [firstStyleButton] = await within(tabPanel).findAllByRole("button");
      await user.click(firstStyleButton as HTMLElement);

      await waitFor(() => expect(handleChange).toHaveBeenCalled());
      const lastCall = handleChange.mock.calls.at(-1)?.[0] as FeatureValue[];
      expect(lastCall).toHaveLength(1);
      const [entry] = lastCall;
      expect(entry?.styleOptionId).toBeUndefined();
      expect(entry?.featureId).toEqual(expect.any(String));
      expect(entry?.styleId).toEqual(expect.any(String));

      // Leaf style (no sub-options) → a "final" selection → advances to the next tab.
      await waitFor(() => expect(screen.getByRole("tab", { name: secondTabPattern })).toHaveAttribute("aria-selected", "true"));
      expect(screen.queryByRole("tab", { name: firstTabPattern })).toHaveAttribute("aria-selected", "false");
    });
  });

  it("never renders Shoulder Type or Monogram Position as ordinary tabs or headings (real render-slot data, jacket)", async () => {
    renderSelector(JACKET_PRODUCT_ID);

    await screen.findByRole("tab", { name: /jacket lapel/i });
    expect(screen.queryByText(/shoulder type/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /monogram position/i })).not.toBeInTheDocument();
  });

  it("renders fabric (text) and monogram (structured) inline, above the tab bar (shirt)", async () => {
    renderSelector(SHIRT_PRODUCT_ID);

    await screen.findByLabelText(/^fabric/i);
    expect(screen.getByRole("heading", { name: /^monogram\b/i })).toBeInTheDocument();
    // Tag/Tag Optional are placeholder-only (no MUI `label` prop — see
    // `MonogramFeatureField.tsx`), so these are real placeholders, not accessible labels.
    expect(screen.getByPlaceholderText(/^tag$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tag optional/i)).toBeInTheDocument();
    expect(screen.getByText(/monogram font style/i)).toBeInTheDocument();
    expect(screen.getByText(/monogram color/i)).toBeInTheDocument();
    await screen.findByRole("tab", { name: /^collar/i });
  });

  it("renders sections in the fixed order Fabric, Lining, Piping, Monogram, then Normal styles (jacket)", async () => {
    renderSelector(JACKET_PRODUCT_ID);

    await screen.findByRole("heading", { name: /^fabric$/i });
    const headingNames = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent)
      .filter((text): text is string => text !== null);

    const fabricIndex = headingNames.findIndex((text) => /^fabric$/i.test(text));
    const liningIndex = headingNames.findIndex((text) => /^lining code$/i.test(text));
    const pipingIndex = headingNames.findIndex((text) => /^piping$/i.test(text));
    const monogramIndex = headingNames.findIndex((text) => /^monogram$/i.test(text));
    const normalStylesIndex = headingNames.findIndex((text) => /^normal styles$/i.test(text));

    expect([fabricIndex, liningIndex, pipingIndex, monogramIndex, normalStylesIndex]).not.toContain(-1);
    expect(fabricIndex).toBeLessThan(liningIndex);
    expect(liningIndex).toBeLessThan(pipingIndex);
    expect(pipingIndex).toBeLessThan(monogramIndex);
    expect(monogramIndex).toBeLessThan(normalStylesIndex);
  });

  it("nests the real Monogram Position feature inside the Monogram block, not as a tab (shirt)", async () => {
    const handleChange = vi.fn();
    renderSelector(SHIRT_PRODUCT_ID, handleChange);
    const user = userEvent.setup();

    const monogramSection = await screen.findByText(/^monogram position$/i);
    // It's real, plain text (a `<p>`), not a heading and not a tab.
    expect(monogramSection.tagName.toLowerCase()).toBe("p");
    expect(screen.queryByRole("tab", { name: /monogram position/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /monogram position/i })).not.toBeInTheDocument();

    // The native radio is `display:none` (legacy's own hidden-radio-plus-styled-label CSS
    // trick — the `<label>` is the visible/clickable surface). That makes its accessible
    // name compute to empty even with `hidden: true` (the accname algorithm treats the
    // hidden control itself as unnameable, not just untraversed), so locate it via its
    // associated `<label>` instead of a role query, and click the label — exactly how a
    // real user (or the browser's native label → control click-forwarding) interacts with it.
    const leftSideLabel = screen.getByText(/^left side$/i).closest("label") as HTMLLabelElement;
    const rightSideLabel = screen.getByText(/^right side$/i).closest("label") as HTMLLabelElement;
    const leftSide = document.getElementById(leftSideLabel.htmlFor) as HTMLInputElement;
    const rightSide = document.getElementById(rightSideLabel.htmlFor) as HTMLInputElement;
    expect(leftSide).toBeInTheDocument();
    expect(rightSide).toBeInTheDocument();

    await user.click(rightSideLabel);
    await waitFor(() => expect(rightSide).toBeChecked());

    const lastCall = handleChange.mock.calls.at(-1)?.[0] as FeatureValue[];
    // The Monogram Position feature's own real featureId/styleId — a genuine
    // `order_item_component_features`-shaped entry, distinct from the
    // monogram structured-value entry itself.
    const positionEntry = lastCall.find((entry) => entry.styleId !== undefined && entry.structuredValue === undefined);
    expect(positionEntry?.featureId).toEqual(expect.any(String));
    expect(positionEntry?.styleId).toEqual(expect.any(String));
  });

  it("tri-mode 1: any option image present → an image grid (shirt collar 'pin collar')", async () => {
    renderSelector(SHIRT_PRODUCT_ID);
    const user = userEvent.setup();

    const collarTab = await screen.findByRole("tab", { name: /^collar/i });
    await user.click(collarTab);
    // A style with real sub-options renders as a radio row (legacy `Options.jsx`'s real shape,
    // PHASE_10_TASKS.md follow-up), not an image card — only a leaf style with no sub-options does.
    const pinCollarRadio = await screen.findByRole("radio", { name: /^pin collar$/i });
    await user.click(pinCollarRadio);

    const curvedOption = await screen.findByText(/curved pin collar/i);
    const pointOption = screen.getByText(/point pin collar/i);
    expect(curvedOption.closest("button")?.querySelector("img")).toBeInTheDocument();
    expect(pointOption.closest("button")?.querySelector("img")).toBeInTheDocument();
  });

  it("tri-mode 2: no option image but the style has one → a shared image + a <select> dropdown (shirt collar 'button down')", async () => {
    const handleChange = vi.fn();
    renderSelector(SHIRT_PRODUCT_ID, handleChange);
    const user = userEvent.setup();

    const collarTab = await screen.findByRole("tab", { name: /^collar/i });
    await user.click(collarTab);
    const buttonDownRadio = await screen.findByRole("radio", { name: /^button down$/i });
    await user.click(buttonDownRadio);

    const dropdown = await screen.findByRole("combobox");
    expect(dropdown.closest("div")?.querySelector("img")).toBeInTheDocument();
    await user.selectOptions(dropdown, "button down 2.5 inc");

    await waitFor(() => {
      const last = handleChange.mock.calls.at(-1)?.[0] as FeatureValue[];
      const collarValue = last.find((entry) => entry.styleOptionId !== undefined);
      expect(collarValue?.styleOptionId).toEqual(expect.any(String));
      expect(collarValue?.styleId).toEqual(expect.any(String));
    });
  });

  describe("tri-mode 3: neither options nor style have an image → a plain text list (fixture)", () => {
    let fixture: TriModeThreeFixture;

    beforeAll(async () => {
      fixture = await createTriModeThreeFixture(seededToken as string);
    });

    afterAll(async () => {
      await fixture.cleanup();
    });

    it("renders plain option tiles with no <img>, and does not auto-advance (revealing sub-options isn't a final selection)", async () => {
      renderSelector(fixture.productId);
      const user = userEvent.setup();

      const tab = await screen.findByRole("tab", { name: new RegExp(fixture.featureName, "i") });
      expect(tab).toHaveAttribute("aria-selected", "true");
      const styleRadio = await screen.findByRole("radio", { name: new RegExp(`^${fixture.styleName}$`, "i") });
      await user.click(styleRadio);

      const [optionAName, optionBName] = fixture.optionNames;
      const optionAButton = await screen.findByRole("button", { name: new RegExp(`^${optionAName}$`, "i") });
      const optionBButton = screen.getByRole("button", { name: new RegExp(`^${optionBName}$`, "i") });
      expect(optionAButton.querySelector("img")).not.toBeInTheDocument();
      expect(optionBButton.querySelector("img")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

      // Only one tab exists on this fixture, so "did it advance" can't be
      // observed via tab index — instead, confirm the sub-option tier is
      // still visible (a real advance in a multi-tab product would unmount
      // this feature's panel entirely).
      expect(tab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("additional-styles toggle (fixture, real seeded catalog has no isAdditional:true features today)", () => {
    let fixture: AdditionalStylesFixture;

    beforeAll(async () => {
      fixture = await createAdditionalStylesFixture(seededToken as string);
    });

    afterAll(async () => {
      await fixture.cleanup();
    });

    it("hides the additional feature's tab until the checkbox is checked", async () => {
      renderSelector(fixture.productId);
      const user = userEvent.setup();

      await screen.findByRole("tab", { name: new RegExp(fixture.primaryFeatureName, "i") });
      expect(screen.queryByRole("tab", { name: new RegExp(fixture.additionalFeatureName, "i") })).not.toBeInTheDocument();

      const checkbox = screen.getByRole("checkbox", { name: /show additional styles/i });
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      await screen.findByRole("tab", { name: new RegExp(fixture.additionalFeatureName, "i") });

      await user.click(checkbox);
      await waitFor(() =>
        expect(screen.queryByRole("tab", { name: new RegExp(fixture.additionalFeatureName, "i") })).not.toBeInTheDocument()
      );
    });
  });

  describe("mixed choice/text/structured product (fixture)", () => {
    let fixture: MixedTypeFixture;

    beforeAll(async () => {
      fixture = await createMixedTypeFixture(seededToken as string);
    });

    afterAll(async () => {
      await fixture.cleanup();
    });

    it("renders choice as a tab and text/structured inline, with the same component code", async () => {
      renderSelector(fixture.productId);

      await screen.findByRole("tab", { name: /fixture choice/i });
      expect(screen.getByText(/fixture style/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fixture fabric/i)).toBeInTheDocument();
      expect(getInlineFeatureSection(/fixture monogram/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^tag$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/tag optional/i)).toBeInTheDocument();
      // This fixture has no `render_slot = 'monogram_position'` feature linked — the
      // nested position block must not appear at all, not even empty.
      expect(screen.queryByText(/monogram position/i)).not.toBeInTheDocument();
    });

    it("fires onChange with textValue for a text-type feature", async () => {
      const handleChange = vi.fn();
      renderSelector(fixture.productId, handleChange);
      const user = userEvent.setup();

      const fabricInput = await screen.findByLabelText(/fixture fabric/i);
      await user.type(fabricInput, "ABC-100");

      await waitFor(() => expect(handleChange).toHaveBeenCalled());
      const lastCall = handleChange.mock.calls.at(-1)?.[0] as FeatureValue[];
      const textEntry = lastCall.find((entry) => entry.textValue !== undefined);
      expect(textEntry?.textValue).toBe("ABC-100");
    });

    it("fires onChange with a structuredValue object for the monogram feature", async () => {
      const handleChange = vi.fn();
      renderSelector(fixture.productId, handleChange);
      const user = userEvent.setup();

      const tagInput = await screen.findByPlaceholderText(/^tag$/i);
      await user.type(tagInput, "AB");

      await waitFor(() => expect(handleChange).toHaveBeenCalled());
      const lastCall = handleChange.mock.calls.at(-1)?.[0] as FeatureValue[];
      const structuredEntry = lastCall.find((entry) => entry.structuredValue !== undefined);
      expect(structuredEntry?.structuredValue).toMatchObject({ text: "AB" });
    });
  });
});
