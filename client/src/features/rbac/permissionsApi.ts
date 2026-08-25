import { baseApi } from "../../api/baseApi";
import type { PermissionRecord } from "./rolesApi";

export type { PermissionRecord };

interface PermissionListResponseEnvelope {
  data: PermissionRecord[];
}

/**
 * Read-only global catalog — `GET /api/permissions` (`permissions.routes.ts`),
 * gated by `authenticate` only, deliberately not `rbac.permissions.view` (see
 * that route's doc comment: a viewer needs to see the catalog to understand
 * what a role grants even without rights to edit it). `RolePermissionsEditor`
 * is this endpoint's only consumer, rendering the full 28-key catalog grouped
 * by module as checkboxes against a role's current grants.
 */
export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPermissions: builder.query<PermissionRecord[], void>({
      query: () => "/permissions",
      transformResponse: (response: PermissionListResponseEnvelope) => response.data,
      providesTags: [{ type: "Permission", id: "LIST" }],
    }),
  }),
});

export const { useListPermissionsQuery } = permissionsApi;
