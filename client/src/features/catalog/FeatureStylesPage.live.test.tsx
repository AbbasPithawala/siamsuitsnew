import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { baseApi } from "../../api/baseApi";
import type { AuthTokenSliceState } from "../../api/baseApi";
import { FeatureStylesPage } from "./FeatureStylesPage";

/**
 * Integration tests against a real, running `siam/server` (not mocked),
 * mirroring `FittingValuesPage.live.test.tsx`'s pattern for the same kind of
 * drill-down page. Covers the styles/style-options management flow that used
 * to live inline in `FeaturesPage.tsx`'s edit dialog (`FeatureStylesEditor.tsx`,
 * now deleted) and now lives on its own page — see `FeaturesPage.live.test.tsx`'s
 * doc comment for the split. The "paste an image URL" text field that editor
 * had is gone too; this suite only exercises the name/thai-name/price fields
 * (no existing live test in this codebase exercises a real file upload yet —
 * see `StyleImageField`'s "Upload image" button render-check instead).
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

const seededToken = await fetchSeedToken();

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

function renderPage(featureId: string, token: string | null) {
  return render(
    <Provider store={buildTestStore(token)}>
      <MemoryRouter initialEntries={[`/catalog/features/${featureId}/styles`]}>
        <Routes>
          <Route path="/catalog/features/:featureId/styles" element={<FeatureStylesPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const NETWORK_WAIT = { timeout: 10000 };

const createdFeatureIds: string[] = [];

/** See `FeaturesPage.live.test.tsx`'s identical helper — `softDeleteFeature` doesn't cascade to styles/options. */
async function cleanupFeature(token: string, featureId: string) {
  const detail = await apiRequest<{
    data: { styles?: { id: string; options: { id: string }[] }[] };
  }>(`/features/${featureId}`, token).catch(() => null);
  for (const style of detail?.data.styles ?? []) {
    for (const option of style.options) {
      await apiRequest(`/style-options/${option.id}`, token, { method: "DELETE" }).catch(() => {});
    }
    await apiRequest(`/styles/${style.id}`, token, { method: "DELETE" }).catch(() => {});
  }
  await apiRequest(`/features/${featureId}`, token, { method: "DELETE" }).catch(() => {});
}

afterEach(async () => {
  if (!seededToken) return;
  while (createdFeatureIds.length > 0) {
    const id = createdFeatureIds.pop();
    if (!id) continue;
    await cleanupFeature(seededToken, id);
  }
});

describe.skipIf(!seededToken)("FeatureStylesPage (live siam/server integration)", () => {
  it(
    "adds a style with a style option, edits the style, then deletes both entirely through the UI",
    async () => {
      const token = seededToken as string;
      const suffix = Date.now();
      const feature = await apiRequest<{ data: { id: string } }>("/features", token, {
        method: "POST",
        body: JSON.stringify({ name: `Live Styles Page Feature ${suffix}`, type: "choice" }),
      });
      createdFeatureIds.push(feature.data.id);

      const user = userEvent.setup();
      renderPage(feature.data.id, token);

      await screen.findByText(/— Styles$/, {}, NETWORK_WAIT);
      expect(screen.getByText("Styles (0)")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add style" }));
      await user.type(screen.getByLabelText("Style name"), "Piped edge");
      await user.type(screen.getByLabelText("Style thai name"), "ขอบเชือก");
      // The image URL text field from the old inline editor is gone — an upload
      // button in its place, the literal point of this change.
      expect(screen.getByRole("button", { name: "Upload image" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save new style" }));
      await screen.findByText(/Piped edge/, {}, NETWORK_WAIT);

      // Only one style exists at this point, so unscoped `screen` queries are
      // unambiguous — no need to find the enclosing Paper row by DOM shape.
      await user.click(screen.getByRole("button", { name: "Add option" }));
      await user.type(screen.getByLabelText("Option name"), "Narrow");
      await user.click(screen.getByRole("button", { name: "Save new option" }));
      await screen.findByText("Narrow", {}, NETWORK_WAIT);
      expect(screen.getByText("Style options (1)")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Edit style Piped edge" }));
      const nameInput = screen.getByLabelText("Style name");
      await user.clear(nameInput);
      await user.type(nameInput, "Piped edge (wide)");
      await user.click(screen.getByRole("button", { name: "Save style Piped edge" }));
      await screen.findByText(/Piped edge \(wide\)/, {}, NETWORK_WAIT);

      const serverDetail = await apiRequest<{
        data: { styles: { name: string; thaiName: string | null; options: { name: string }[] }[] };
      }>(`/features/${feature.data.id}`, token);
      expect(serverDetail.data.styles).toHaveLength(1);
      expect(serverDetail.data.styles[0]?.name).toBe("Piped edge (wide)");
      expect(serverDetail.data.styles[0]?.thaiName).toBe("ขอบเชือก");
      expect(serverDetail.data.styles[0]?.options.map((o) => o.name)).toEqual(["Narrow"]);

      await user.click(screen.getByRole("button", { name: "Delete option Narrow" }));
      await waitFor(() => expect(screen.queryByText("Narrow")).not.toBeInTheDocument(), NETWORK_WAIT);

      await user.click(screen.getByRole("button", { name: "Delete style Piped edge (wide)" }));
      await waitFor(() => expect(screen.queryByText(/Piped edge/)).not.toBeInTheDocument(), NETWORK_WAIT);
      await screen.findByText("Styles (0)", {}, NETWORK_WAIT);
    },
    30000
  );
});
