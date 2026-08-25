import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";
import type { Product } from "./productsApi";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `super_products` /
 * `super_product_components` tables plus `superProducts.service.ts`'s
 * `withComponents` helper, which nests each component's `product` (via
 * Drizzle's `with: { product: true }`) so the UI never needs a second
 * request to render a component's product name.
 */
export interface SuperProductComponent {
  id: string;
  superProductId: string;
  productId: string;
  slotLabel: string;
  sequence: number;
  product: Product;
}

export interface SuperProduct {
  id: string;
  name: string;
  thaiName: string | null;
  image: string | null;
  components: SuperProductComponent[];
}

export interface SuperProductInput {
  name: string;
  thaiName?: string;
  image?: string;
  /** Only meaningful on create — `PATCH /super-products/:id` doesn't touch components, see below. */
  components?: ComponentInput[];
}

export type SuperProductUpdateInput = Partial<Pick<SuperProductInput, "name" | "thaiName" | "image">>;

export interface ComponentInput {
  productId: string;
  slotLabel: string;
}

interface SuperProductResponseEnvelope {
  data: SuperProduct;
}

interface SuperProductListResponseEnvelope {
  data: SuperProduct[];
}

interface ComponentListResponseEnvelope {
  data: SuperProductComponent[];
}

function listSuperProductsPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  return `/super-products?${params.toString()}`;
}

/**
 * Injected into the single `baseApi` instance (per its own doc comment),
 * same `id: "LIST"` tag pattern as `productsApi.ts`. There is no bulk
 * "reconcile components" mutation on the backend — `updateSuperProduct`
 * (`server/src/services/superProducts.service.ts`) only ever touches
 * name/thaiName/image, never `components`. Adding/removing/editing a
 * component on an *existing* super product is always its own request
 * against `/super-products/:id/components[/:componentId]`, each of which
 * invalidates the parent `SuperProduct` tag so the list/edit view refetches
 * and reflects the change immediately.
 */
export const superProductsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSuperProducts: builder.query<SuperProduct[], void>({
      query: () => "/super-products",
      transformResponse: (response: SuperProductListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((superProduct) => ({ type: "SuperProduct" as const, id: superProduct.id })),
              { type: "SuperProduct" as const, id: "LIST" },
            ]
          : [{ type: "SuperProduct" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — opt-in-mode paginated variant for `SuperProductsPage`, see `productsApi.ts`'s `listProductsPaginated` doc comment. */
    listSuperProductsPaginated: builder.query<PaginatedResponse<SuperProduct>, PaginationQueryParams>({
      query: listSuperProductsPaginatedQuery,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((superProduct) => ({ type: "SuperProduct" as const, id: superProduct.id })),
              { type: "SuperProduct" as const, id: "LIST" },
            ]
          : [{ type: "SuperProduct" as const, id: "LIST" }],
    }),
    createSuperProduct: builder.mutation<SuperProduct, SuperProductInput>({
      query: (body) => ({ url: "/super-products", method: "POST", body }),
      transformResponse: (response: SuperProductResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "SuperProduct", id: "LIST" }],
    }),
    updateSuperProduct: builder.mutation<SuperProduct, { id: string; body: SuperProductUpdateInput }>({
      query: ({ id, body }) => ({ url: `/super-products/${id}`, method: "PATCH", body }),
      transformResponse: (response: SuperProductResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "SuperProduct", id },
        { type: "SuperProduct", id: "LIST" },
      ],
    }),
    deleteSuperProduct: builder.mutation<void, string>({
      query: (id) => ({ url: `/super-products/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "SuperProduct", id },
        { type: "SuperProduct", id: "LIST" },
      ],
    }),
    addSuperProductComponent: builder.mutation<
      SuperProductComponent[],
      { superProductId: string; body: ComponentInput }
    >({
      query: ({ superProductId, body }) => ({
        url: `/super-products/${superProductId}/components`,
        method: "POST",
        body,
      }),
      transformResponse: (response: ComponentListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { superProductId }) => [
        { type: "SuperProduct", id: superProductId },
        { type: "SuperProduct", id: "LIST" },
      ],
    }),
    updateSuperProductComponent: builder.mutation<
      SuperProductComponent[],
      { superProductId: string; componentId: string; body: Partial<ComponentInput> }
    >({
      query: ({ superProductId, componentId, body }) => ({
        url: `/super-products/${superProductId}/components/${componentId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ComponentListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { superProductId }) => [
        { type: "SuperProduct", id: superProductId },
        { type: "SuperProduct", id: "LIST" },
      ],
    }),
    removeSuperProductComponent: builder.mutation<void, { superProductId: string; componentId: string }>({
      query: ({ superProductId, componentId }) => ({
        url: `/super-products/${superProductId}/components/${componentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { superProductId }) => [
        { type: "SuperProduct", id: superProductId },
        { type: "SuperProduct", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListSuperProductsQuery,
  useListSuperProductsPaginatedQuery,
  useCreateSuperProductMutation,
  useUpdateSuperProductMutation,
  useDeleteSuperProductMutation,
  useAddSuperProductComponentMutation,
  useUpdateSuperProductComponentMutation,
  useRemoveSuperProductComponentMutation,
} = superProductsApi;
