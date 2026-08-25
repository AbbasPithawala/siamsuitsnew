import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/db/schema/catalog.ts`'s `products` table (camelCase
 * fields as Drizzle returns them): `id`, `name`, `thaiName`, `description`,
 * `image` — the latter three nullable, matching `createProductSchema` in
 * `server/src/routes/products.routes.ts` where only `name` is required.
 */
export interface Product {
  id: string;
  name: string;
  thaiName: string | null;
  description: string | null;
  image: string | null;
  /** PHASE_10_TASKS.md Workstream E Group 6.1 — per-product static diagram the Manual Size annotation editor renders labels on top of, distinct from `image` above. */
  measurementDiagramImage: string | null;
}

export interface ProductInput {
  name: string;
  thaiName?: string;
  description?: string;
  image?: string;
  measurementDiagramImage?: string;
}

interface ProductResponseEnvelope {
  data: Product;
}

interface ProductListResponseEnvelope {
  data: Product[];
}

function listProductsPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  return `/products?${params.toString()}`;
}

/**
 * Injected into the single `baseApi` instance (per its own doc comment).
 * `Product`/`id: "LIST"` tag pattern: list re-fetches on any create/update/
 * delete, individual product cache entries invalidate precisely on their
 * own update/delete.
 */
export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<Product[], void>({
      query: () => "/products",
      transformResponse: (response: ProductListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((product) => ({ type: "Product" as const, id: product.id })), { type: "Product" as const, id: "LIST" }]
          : [{ type: "Product" as const, id: "LIST" }],
    }),
    /**
     * PHASE_10_TASKS.md Workstream C Group 4 — opt-in-mode paginated variant
     * for `ProductsPage`'s admin table, a separate cache entry from
     * `listProducts` above (same `/products` URL, always-explicit `page`/
     * `pageSize`). `listProducts` itself is untouched and keeps returning
     * every real product with no pagination params — the order-builder's own
     * product picker (`useListProductsQuery()`) and every other existing
     * caller are completely unaffected by this addition.
     */
    listProductsPaginated: builder.query<PaginatedResponse<Product>, PaginationQueryParams>({
      query: listProductsPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((product) => ({ type: "Product" as const, id: product.id })), { type: "Product" as const, id: "LIST" }]
          : [{ type: "Product" as const, id: "LIST" }],
    }),
    /** `GET /products/:id` (`getProduct` in `products.service.ts`) — used by the per-product Fittings screens (PHASE_8_TASKS.md Group 6.3) to show which product a fitting belongs to without refetching the whole list. */
    getProduct: builder.query<Product, string>({
      query: (id) => `/products/${id}`,
      transformResponse: (response: ProductResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Product", id }],
    }),
    createProduct: builder.mutation<Product, ProductInput>({
      query: (body) => ({ url: "/products", method: "POST", body }),
      transformResponse: (response: ProductResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),
    updateProduct: builder.mutation<Product, { id: string; body: ProductInput }>({
      query: ({ id, body }) => ({ url: `/products/${id}`, method: "PATCH", body }),
      transformResponse: (response: ProductResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListProductsQuery,
  useListProductsPaginatedQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
