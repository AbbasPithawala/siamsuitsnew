import { baseApi } from "../../api/baseApi";

export type FeatureType = "choice" | "text" | "structured";

/**
 * A small, closed, system-defined set of "well-known roles" a feature can be assigned to
 * (PHASE_9_TASKS.md Decision 4) — Shoulder Type renders fixed on `<MeasurementForm>`,
 * Monogram Position nests inside `<MonogramFeatureField>`, Piping renders as its own
 * always-visible swatch grid instead of a tab in the styling picker (matches legacy — see
 * `catalog.ts`'s `featureRenderSlotEnum` doc comment). Mirrors the server's
 * `feature_render_slot` Postgres enum.
 */
export type FeatureRenderSlot = "shoulder_type" | "monogram_position" | "piping";

export interface FeatureProductLink {
  id: string;
  name: string;
}

export interface FeatureStyleOption {
  id: string;
  styleId: string;
  name: string;
  image: string | null;
}

export interface FeatureStyle {
  id: string;
  featureId: string;
  name: string;
  thaiName: string | null;
  image: string | null;
  price: string;
  workerPrice: string;
  options: FeatureStyleOption[];
}

/**
 * Matches `GET /api/features?productId=...`'s response shape, assembled by
 * `server/src/services/features.service.ts`'s `assembleFeatures`: `styles`
 * is populated only for `type: "choice"` features. For `type: "text"`/
 * `"structured"` features the service leaves it `undefined`, which
 * `res.json()` drops entirely rather than sending `"styles": null` — so
 * `styles` is genuinely absent on the wire for those, not just empty.
 *
 * `isAdditional`/`isRequired`/`renderSlot` — PHASE_9_TASKS.md Group 0. `isAdditional` gained
 * a real admin write path (`FeaturesPage.tsx`'s form) once PHASE_10_TASKS.md Workstream B's
 * PDF-fidelity pass found the gap it drives — the other two stay read-only/system-set
 * (`isRequired` is derived from catalog structure, `renderSlot` is a fixed system enum only
 * the one-time catalog seed sets).
 */
export interface ProductFeature {
  id: string;
  tenantId: string;
  name: string;
  thaiName: string | null;
  type: FeatureType;
  processId: string | null;
  isAdditional: boolean;
  isRequired: boolean;
  renderSlot: FeatureRenderSlot | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  products: FeatureProductLink[];
  styles?: FeatureStyle[];
}

/**
 * Exactly `server/src/services/orders.service.ts`'s `CreateFeatureInput`
 * shape — what `POST /api/orders` expects per order-item-component in its
 * `features[]` array. `<FeatureSelector>`'s `value`/`onChange` contract uses
 * this directly so callers (the Group 7 order-builder wizard) can pass it
 * straight through with no translation layer.
 */
export interface FeatureValue {
  featureId: string;
  styleId?: string | undefined;
  styleOptionId?: string | undefined;
  textValue?: string | undefined;
  structuredValue?: unknown;
}

interface ProductFeaturesEnvelope {
  data: ProductFeature[];
}

/**
 * Injected into the single `baseApi` instance (see its own doc comment) so
 * this shares the app's one cache/tag namespace rather than standing up a
 * second `createApi`.
 */
export const featuresApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    productFeatures: builder.query<ProductFeature[], string>({
      query: (productId) => `/features?productId=${encodeURIComponent(productId)}`,
      transformResponse: (response: ProductFeaturesEnvelope) => response.data,
    }),
  }),
});

export const { useProductFeaturesQuery } = featuresApi;
