import { baseApi } from "../../api/baseApi";

/**
 * Mirrors `server/src/db/schema/orders.ts`'s `customerMeasurementProfileValues`
 * table exactly (camelCase, as Drizzle returns it) — the identical numeric-
 * column shape `order_item_component_measurements` already uses
 * (PHASE_10_TASKS.md Workstream D Decision 1), all three numeric columns
 * `string | null` over the wire (Drizzle's `numeric` columns serialize as
 * strings, and a measurement a customer's profile has never recorded a value
 * for is a real, legitimate `null`, not an absent key).
 */
export interface CustomerMeasurementProfileValue {
  id: string;
  profileId: string;
  measurementDefinitionId: string;
  value: string | null;
  adjustmentValue: string | null;
  totalValue: string | null;
}

/**
 * `measurementProfiles.service.ts#getCustomerMeasurementProfile`'s real
 * return shape: the `customer_measurement_profiles` row spread with its
 * `values` relation eagerly attached, verified directly against that
 * service/`measurementProfiles.routes.ts` rather than assumed.
 */
export interface CustomerMeasurementProfile {
  id: string;
  tenantId: string;
  customerId: string;
  productId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  values: CustomerMeasurementProfileValue[];
}

interface CustomerMeasurementProfileResponseEnvelope {
  data: CustomerMeasurementProfile | null;
}

/**
 * `measurementProfiles.service.ts#getMeasurementBaseline`'s real return shape — deliberately
 * NOT `CustomerMeasurementProfile` above: this is the customer's most recent specific PRIOR
 * ORDER's measurements for this product (excluding `excludeOrderId`, when editing), the same
 * comparison `order_item_component_measurements.changed_from_profile` uses server-side, not
 * the "latest known value across any write" the profile answers (see that column's own schema
 * doc comment for why the two diverge). No `id`/`profileId` — these rows are
 * `order_item_component_measurements`, not `customer_measurement_profile_values`.
 */
export interface MeasurementBaselineValue {
  measurementDefinitionId: string;
  value: string | null;
  adjustmentValue: string | null;
  totalValue: string | null;
}

export interface MeasurementBaseline {
  values: MeasurementBaselineValue[];
}

interface MeasurementBaselineResponseEnvelope {
  data: MeasurementBaseline | null;
}

/**
 * A brand-new customer+product pairing legitimately has no profile yet —
 * `GET /customers/:customerId/measurement-profiles/:productId` returns
 * `{ data: null }`, not a 404, for that case (`measurementProfiles.routes.ts`'s
 * own doc comment), so this query's success type is `CustomerMeasurementProfile
 * | null`, not just the profile shape.
 *
 * Own file (not folded into `measurementsApi.ts`, which stays scoped to
 * catalog measurement definitions/links) — mirrors
 * `measurementProfiles.service.ts` being kept separate from
 * `measurements.service.ts` server-side for the identical one-concern-per-file
 * reason (PHASE_10_TASKS.md Workstream D Group 1).
 *
 * Injected into the single `baseApi` instance, matching `fittingsApi.ts`'s/
 * `measurementsApi.ts`'s established convention. GET is ungated server-side
 * beyond `authenticate` (the order-builder needs this the same as everything
 * else it reads), so no permission-based `skip` logic belongs here either.
 */
export const measurementProfilesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerMeasurementProfile: builder.query<
      CustomerMeasurementProfile | null,
      { customerId: string; productId: string }
    >({
      query: ({ customerId, productId }) => `/customers/${customerId}/measurement-profiles/${productId}`,
      transformResponse: (response: CustomerMeasurementProfileResponseEnvelope) => response.data,
      // Two tags per result: the specific (customer, product) pair this query
      // itself is keyed on, plus a customer-wide one `ordersApi.ts#createOrder`
      // invalidates on every order submission (an order write-path always
      // upserts the submitting customer's profile, PHASE_10_TASKS.md
      // Workstream D Decision 2) — `createOrder`'s own input only ever carries
      // `customerId`, not each component's real `productId` (see
      // `CreateOrderComponentInput`'s own doc comment: components are
      // identified by `superProductComponentId`), so a per-pair tag alone
      // could never be invalidated correctly from that call site.
      providesTags: (_result, _error, { customerId, productId }) => [
        { type: "CustomerMeasurementProfile" as const, id: `${customerId}:${productId}` },
        { type: "CustomerMeasurementProfile" as const, id: customerId },
      ],
    }),
    /**
     * Backs the order-builder's live "changed from profile" checkmark (PHASE_10_TASKS.md
     * follow-up) — `excludeOrderId` is the order currently open in the edit wizard, if any, so
     * that order's own not-yet-resaved component never counts as its own baseline (omitted
     * entirely for order creation, where nothing exists yet to exclude). Same
     * `CustomerMeasurementProfile` tags as the query above: an order write invalidates both,
     * since either could change as a result (a new order becomes the next baseline, and/or
     * updates the profile pre-fill).
     */
    getMeasurementBaseline: builder.query<
      MeasurementBaseline | null,
      { customerId: string; productId: string; excludeOrderId?: string | undefined }
    >({
      query: ({ customerId, productId, excludeOrderId }) =>
        `/customers/${customerId}/measurement-baseline/${productId}${excludeOrderId ? `?excludeOrderId=${excludeOrderId}` : ""}`,
      transformResponse: (response: MeasurementBaselineResponseEnvelope) => response.data,
      providesTags: (_result, _error, { customerId, productId }) => [
        { type: "CustomerMeasurementProfile" as const, id: `${customerId}:${productId}` },
        { type: "CustomerMeasurementProfile" as const, id: customerId },
      ],
    }),
  }),
});

export const { useGetCustomerMeasurementProfileQuery, useGetMeasurementBaselineQuery } = measurementProfilesApi;
