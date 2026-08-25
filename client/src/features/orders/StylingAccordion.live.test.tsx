import { useState } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { afterAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import type { SuperProductComponent } from "../catalog/superProductsApi";
import { StylingAccordion } from "./StylingAccordion";
import type { UnitStylingDraft } from "./StylingAccordion";

/**
 * Integration test against a real, running `siam/server` (not mocked),
 * mirroring `OrderBuilderPage.live.test.tsx`'s/`FeatureSelector.live.test.tsx`'s
 * pattern. Per `PHASE_9_TASKS.md` Group 5's own scope boundary, this mounts
 * `<StylingAccordion>` directly (a small controlled parent standing in for
 * Group 7's future cart), rather than threading it through
 * `OrderBuilderPage.tsx` — that integration is Group 7's job.
 *
 * Fixture: a throwaway 2-component super product (real jacket + pant
 * products, each with their own real "fabric" text feature and real
 * choice-feature tab bars) created via the real API and soft-deleted in
 * `afterAll`.
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
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface RealProductIds {
  jacket: string;
  pant: string;
}

async function fetchRealProductIds(token: string): Promise<RealProductIds> {
  const list = await apiRequest<{ data: { id: string; name: string }[] }>("/products", token);
  const byName = new Map(list.data.map((product) => [product.name, product.id]));
  for (const name of ["jacket", "pant"]) {
    if (!byName.has(name)) throw new Error(`Expected the real seeded catalog to include a "${name}" product`);
  }
  return { jacket: byName.get("jacket")!, pant: byName.get("pant")! };
}

const realProducts = seededToken ? await fetchRealProductIds(seededToken) : null;

interface SuperProductFixture {
  id: string;
  components: SuperProductComponent[];
}

async function createSuperProductFixture(token: string, products: RealProductIds): Promise<SuperProductFixture> {
  const created = await apiRequest<{ data: { id: string; components: SuperProductComponent[] } }>("/super-products", token, {
    method: "POST",
    body: JSON.stringify({
      name: `Styling Accordion Fixture ${Date.now()}`,
      components: [
        { productId: products.jacket, slotLabel: "Jacket" },
        { productId: products.pant, slotLabel: "Pant" },
      ],
    }),
  });
  return { id: created.data.id, components: created.data.components };
}

function buildTestStore() {
  const authReducer = (state: AuthTokenSliceState["auth"] = { token: seededToken }) => state;
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

/**
 * Stands in for Group 7's future cart: owns `quantity`/`value` state and
 * implements `onDeleteUnit` by actually splicing the array and decrementing
 * `quantity` — `<StylingAccordion>` itself never mutates either, per its own
 * controlled-component contract.
 */
function ControlledStylingAccordion({
  components,
  onDelete,
}: {
  components: SuperProductComponent[];
  onDelete: (index: number) => void;
}) {
  const [quantity, setQuantity] = useState(3);
  const [value, setValue] = useState<UnitStylingDraft[]>([]);
  return (
    <StylingAccordion
      components={components}
      quantity={quantity}
      value={value}
      onChange={setValue}
      onDeleteUnit={(index) => {
        onDelete(index);
        setValue((prev) => prev.filter((_, i) => i !== index));
        setQuantity((q) => q - 1);
      }}
    />
  );
}

function renderAccordion(components: SuperProductComponent[], onDelete: (index: number) => void = () => {}) {
  const store = buildTestStore();
  return render(
    <Provider store={store}>
      <ControlledStylingAccordion components={components} onDelete={onDelete} />
    </Provider>
  );
}

/** MUI keeps a collapsed `AccordionDetails` mounted, so multiple units' "Jacket" headings
 * can coexist in the DOM at once — every query below is scoped to one unit's own content
 * region (`#unit-<index>-content`, `StylingAccordion.tsx`'s own id), never global. */
function getUnitContent(index: number): HTMLElement {
  return document.getElementById(`unit-${index}-content`) as HTMLElement;
}

function getComponentSection(unitContent: HTMLElement, slotLabel: string): HTMLElement {
  const heading = within(unitContent).getByRole("heading", { name: new RegExp(`^${slotLabel}\\b`) });
  return heading.closest("div") as HTMLElement;
}

/** A real, tiny (1x1) PNG so the server's real image-MIME `fileFilter` accepts it. */
function makePngFile(name: string): File {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], name, { type: "image/png" });
}

const createdSuperProductIds: string[] = [];

afterAll(async () => {
  if (!seededToken) return;
  for (const id of createdSuperProductIds) {
    await apiRequest(`/super-products/${id}`, seededToken, { method: "DELETE" }).catch((err) =>
      console.error(`Failed to soft-delete super product fixture ${id}:`, err)
    );
  }
});

describe.skipIf(!seededToken)("StylingAccordion (live siam/server integration)", () => {
  it("renders N independent per-unit accordions with a live summary panel, supports copy-previous/delete/image-upload", async () => {
    const token = seededToken as string;
    const products = realProducts as RealProductIds;
    const fixture = await createSuperProductFixture(token, products);
    createdSuperProductIds.push(fixture.id);
    const jacketComponent = fixture.components.find((c) => c.slotLabel === "Jacket")!;

    const deletedIndexes: number[] = [];
    const user = userEvent.setup();
    renderAccordion(fixture.components, (index) => deletedIndexes.push(index));

    // 3 real, independent accordions.
    await screen.findAllByText(/Fabric Information for/);
    expect(screen.getByRole("button", { name: /Item 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Item 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Item 3/ })).toBeInTheDocument();

    // Unit 1 (Item 1) is expanded by default; its summary panel is live.
    expect(screen.getByText("Summary — Item 1")).toBeInTheDocument();
    const unit0 = getUnitContent(0);
    const item1Jacket = getComponentSection(unit0, "Jacket");
    const item1Fabric = await within(item1Jacket).findByLabelText(/^fabric/i);
    await user.type(item1Fabric, "ITEM1-FABRIC");
    const item1Note = within(item1Jacket).getByLabelText(/^note$/i);
    await user.type(item1Note, "Item 1 note");

    await waitFor(() => expect(screen.getByText("ITEM1-FABRIC")).toBeInTheDocument());

    // Expand Item 2 — its own independent copy-previous checkbox appears (unit index > 0 only).
    await user.click(screen.getByRole("button", { name: /Item 2/ }));
    await screen.findByText("Summary — Item 2");
    const unit1 = getUnitContent(1);
    const copyCheckbox = within(unit1).getByRole("checkbox", { name: /copy styles of the previous item/i });
    expect(copyCheckbox).not.toBeChecked();

    const item2Jacket = getComponentSection(unit1, "Jacket");
    const item2Fabric = await within(item2Jacket).findByLabelText(/^fabric/i);
    expect(item2Fabric).toHaveValue("");

    // Checking it deep-copies unit 1's full draft into unit 2.
    await user.click(copyCheckbox);
    await waitFor(() => expect(item2Fabric).toHaveValue("ITEM1-FABRIC"));
    const item2Note = within(item2Jacket).getByLabelText(/^note$/i);
    expect(item2Note).toHaveValue("Item 1 note");
    // Unit 2's OWN summary panel (nested inside its own accordion, per the fix
    // to match legacy's real per-unit `fabric-left`/`fabric-right` structure)
    // reflects the copy. Scoped to unit 1's content region — unit 0's summary
    // also legitimately shows "ITEM1-FABRIC" now (it's unit 0's real value),
    // so an unscoped `screen.getByText` would match both and throw.
    expect(within(unit1).getByText("ITEM1-FABRIC")).toBeInTheDocument();
    // Unit 1's own data is untouched by copying into unit 2 (independence proof).
    expect(item1Fabric).toHaveValue("ITEM1-FABRIC");
    expect(within(unit0).getByText("ITEM1-FABRIC")).toBeInTheDocument();

    // Unchecking clears unit 2 back to empty.
    await user.click(copyCheckbox);
    await waitFor(() => expect(item2Fabric).toHaveValue(""));
    expect(item2Note).toHaveValue("");

    // Reference-image upload: local preview first (no network), then a real upload.
    // Scoped to the reference-image `<label>` specifically — the jacket's own Monogram
    // Font Style tab already renders 9 real `<img>`s elsewhere in this same section.
    const referenceImageInputId = `reference-image-1-${jacketComponent.id}`;
    const referenceImageSelector = `label[for="${referenceImageInputId}"] img`;
    const fileInput = item2Jacket.querySelector(`#${referenceImageInputId}`) as HTMLInputElement;
    const file = makePngFile("ref.png");
    await user.upload(fileInput, file);
    await waitFor(() => expect(item2Jacket.querySelector(referenceImageSelector)).toBeTruthy());
    const previewSrc = item2Jacket.querySelector(referenceImageSelector)?.getAttribute("src");
    expect(previewSrc).toMatch(/^blob:/);

    const uploadButton = within(item2Jacket).getByRole("button", { name: "Upload" });
    expect(uploadButton).toBeEnabled();
    await user.click(uploadButton);

    await waitFor(() => expect(uploadButton).toBeDisabled(), { timeout: 10000 });
    await waitFor(() => {
      const uploadedSrc = item2Jacket.querySelector(referenceImageSelector)?.getAttribute("src");
      expect(uploadedSrc).toMatch(/\/uploads\/generic\//);
      expect(uploadedSrc).not.toMatch(/^blob:/);
    });

    // Delete Item 3 — the component only ever asks (onDeleteUnit); this test's own
    // controlled parent is what actually removes it and re-renders with N-1 units.
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons).toHaveLength(3);
    await user.click(deleteButtons[2] as HTMLElement);

    expect(deletedIndexes).toEqual([2]);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Item 3/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Item 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Item 2/ })).toBeInTheDocument();
  }, 60000);
});
