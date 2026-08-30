import { baseApi } from "../../api/baseApi";

/**
 * Matches `server/src/services/storage.service.ts`'s `StorageBackend.upload`
 * return shape exactly, as relayed by `POST /api/uploads`
 * (`server/src/routes/uploads.routes.ts`, `res.status(201).json({ data: result })`).
 * `url` is path-only (e.g. `/uploads/<key>`) in local-disk/dev — see
 * `resolveUploadUrl` below — and fully-qualified once an S3 backend or
 * `PUBLIC_BASE_URL` is configured.
 */
export interface UploadResult {
  key: string;
  url: string;
}

interface UploadResponseEnvelope {
  data: UploadResult;
}

/**
 * Generic, order-agnostic file upload (PHASE_9_TASKS.md Group 1's endpoint) —
 * this is its first real client consumer (Group 5's reference-image upload),
 * not order-specific in any way, so any later consumer (e.g. Phase 8 Group 4's
 * still-open feature/style-image upload) can inject this same endpoint again
 * rather than duplicating the multipart-body plumbing.
 */
export const uploadsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadFile: builder.mutation<UploadResult, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        // No `Content-Type` header set here on purpose: `fetchBaseQuery`
        // only JSON-serializes/sets a JSON content type for plain
        // objects/arrays (`isJsonifiable` in RTK Query's source), never for
        // `FormData` — the browser sets the real multipart boundary itself.
        return { url: "/uploads", method: "POST", body };
      },
      transformResponse: (response: UploadResponseEnvelope) => response.data,
    }),
  }),
});

export const { useUploadFileMutation } = uploadsApi;

/**
 * `POST /api/uploads`'s `url` is served from the API origin itself (Express's
 * `/uploads` static route, mounted alongside `/api`, not under it — see
 * `server/src/app.ts`), not from `VITE_API_BASE_URL` (which already has
 * `/api` on the end) and not from Vite's own dev-server origin (a different
 * origin from the API in dev — the real bug this scoping fixes: a bare
 * `/uploads/...` `<img src>` resolves against the *page's* origin by default,
 * i.e. the Vite dev server, which doesn't have the file, not the API server,
 * which does). Already fully-qualified URLs (the S3 backend, or
 * `PUBLIC_BASE_URL` set in production) pass through unchanged.
 *
 * Only rewrites paths under this server's own real upload prefix (mirrors
 * `server/src/services/storage.service.ts`'s `resolveServerImageUrl` — same
 * narrow scoping, same reasoning): `styles.image`/`style_options.image` (and
 * `products.image`) can *also* legitimately hold a client-public-folder path
 * (e.g. `/ImagesFabric/jacket/sloping.png`, seeded directly for Shoulder
 * Type/Monogram Position — never uploaded) or a bare not-yet-migrated legacy
 * filename (e.g. `download-1.jpg`) — neither should be rewritten against the
 * API origin, so both pass through untouched.
 */
export function resolveUploadUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith("/uploads/")) return url;
  const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL;
  const origin = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${origin}${url}`;
}
