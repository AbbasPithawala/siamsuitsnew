import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/**
 * Mirrors `server/src/db/schema/tenancy.ts`'s `roles`/`permissions`/
 * `role_permissions` tables. `permissions` is a global, non-tenant-scoped
 * catalog (see `permissions.routes.ts`'s doc comment) — its wire shape is
 * declared here and re-exported from `permissionsApi.ts` rather than
 * duplicated, since both files' server-side data ultimately comes from the
 * same `permissions` table.
 */
export interface PermissionRecord {
  id: string;
  key: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  /** The tenant's protected system role (PHASE_8_TASKS.md Group 3) — server rejects deleting it or removing its permissions. */
  isSystem: boolean;
}

export interface RoleDetail extends Role {
  permissions: PermissionRecord[];
}

export interface RoleInput {
  name: string;
}

export type RoleUpdateInput = Partial<RoleInput>;

interface RoleResponseEnvelope {
  data: Role;
}

interface RoleDetailResponseEnvelope {
  data: RoleDetail;
}

interface RoleListResponseEnvelope {
  data: Role[];
}

interface PermissionListResponseEnvelope {
  data: PermissionRecord[];
}

function listRolesPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/roles?${qs}` : "/roles";
}

/**
 * PHASE_5_TASKS.md Group 4. `GET /roles[/:id]` requires only `authenticate`
 * (`server/src/routes/roles.routes.ts`'s doc comment) — same read-open
 * convention as the Group 1-3 catalog resources — but `RolesPage.tsx` is
 * still wrapped in `RequirePermission` at the route level in
 * `AppRoutes.tsx` (a deliberate page-level gate for this admin surface,
 * unlike the catalog pages' button-level-only gating), so no
 * `useHasPermission` button checks are needed inside the page itself.
 *
 * `getRole` is the single source of a role's granted permissions — used
 * both by `RolePermissionsEditor`'s checkboxes and by `RolesPage`'s list
 * row (to show a live permission count), so granting/revoking a permission
 * (which invalidates this same `{Role, id}` tag) updates both places at
 * once without a manual refetch.
 */
export const rolesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRoles: builder.query<Role[], void>({
      query: () => "/roles",
      transformResponse: (response: RoleListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((role) => ({ type: "Role" as const, id: role.id })), { type: "Role" as const, id: "LIST" }]
          : [{ type: "Role" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `RolesPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listRolesPaginated: builder.query<PaginatedResponse<Role>, PaginationQueryParams>({
      query: listRolesPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((role) => ({ type: "Role" as const, id: role.id })), { type: "Role" as const, id: "LIST" }]
          : [{ type: "Role" as const, id: "LIST" }],
    }),
    getRole: builder.query<RoleDetail, string>({
      query: (id) => `/roles/${id}`,
      transformResponse: (response: RoleDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Role", id }],
    }),
    createRole: builder.mutation<Role, RoleInput>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      transformResponse: (response: RoleResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "Role", id: "LIST" }],
    }),
    updateRole: builder.mutation<RoleDetail, { id: string; body: RoleUpdateInput }>({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: "PATCH", body }),
      transformResponse: (response: RoleDetailResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Role", id },
        { type: "Role", id: "LIST" },
      ],
    }),
    deleteRole: builder.mutation<void, string>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Role", id },
        { type: "Role", id: "LIST" },
      ],
    }),
    addRolePermission: builder.mutation<PermissionRecord[], { roleId: string; permissionId: string }>({
      query: ({ roleId, permissionId }) => ({ url: `/roles/${roleId}/permissions`, method: "POST", body: { permissionId } }),
      transformResponse: (response: PermissionListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { roleId }) => [{ type: "Role", id: roleId }],
    }),
    removeRolePermission: builder.mutation<void, { roleId: string; permissionId: string }>({
      query: ({ roleId, permissionId }) => ({ url: `/roles/${roleId}/permissions/${permissionId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { roleId }) => [{ type: "Role", id: roleId }],
    }),
  }),
});

export const {
  useListRolesQuery,
  useListRolesPaginatedQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useAddRolePermissionMutation,
  useRemoveRolePermissionMutation,
} = rolesApi;
