import { baseApi } from "../../api/baseApi";
import type { PaginatedResponse, PaginationQueryParams } from "../../api/pagination";

/** Mirrors `server/src/db/schema/tenancy.ts`'s `users` table, minus `passwordHash` — never sent over the wire (see `users.service.ts`'s `sanitize`). */
export interface User {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
}

/** The bare shape `withRoles` in `users.service.ts` returns for a user's assigned roles — no nested permissions, just enough to render/toggle a checkbox list. */
export interface RoleRef {
  id: string;
  name: string;
}

export interface UserDetail extends User {
  roles: RoleRef[];
  /** `null` = no retailer linkage (plain staff). See `users.service.ts`'s `withRetailerId`. */
  retailerId: string | null;
}

export interface UserCreateInput {
  name: string;
  username: string;
  /** Plaintext, sent once; `createUser` in `users.service.ts` hashes it via `auth.service.ts` before it ever touches the database. Never re-fetched or displayed. */
  password: string;
  isActive?: boolean;
  /** Undefined = omitted/untouched, `null` = explicitly no retailer, a uuid = linked to that retailer — mirrors `CreateUserInput` in `users.service.ts`. */
  retailerId?: string | null;
}

export type UserUpdateInput = Partial<Pick<UserCreateInput, "name" | "username" | "isActive" | "retailerId">>;

interface UserResponseEnvelope {
  data: User;
}

interface UserDetailResponseEnvelope {
  data: UserDetail;
}

interface UserListResponseEnvelope {
  data: User[];
}

interface RoleRefListResponseEnvelope {
  data: RoleRef[];
}

function listUsersPaginatedQuery(args: PaginationQueryParams): string {
  const params = new URLSearchParams();
  if (args.page !== undefined) params.set("page", String(args.page));
  if (args.pageSize !== undefined) params.set("pageSize", String(args.pageSize));
  const qs = params.toString();
  return qs ? `/users?${qs}` : "/users";
}

/**
 * PHASE_5_TASKS.md Group 4. `GET /users[/:id]` requires only `authenticate`
 * (`server/src/routes/users.routes.ts`'s doc comment) — same read-open
 * convention as the Group 1-3 catalog resources — but `UsersPage.tsx` is
 * still wrapped in `RequirePermission` at the route level in
 * `AppRoutes.tsx` (a deliberate page-level gate for this admin surface),
 * so no `useHasPermission` button checks are needed inside the page itself.
 *
 * `getUser` is the source of a user's assigned roles, consumed by
 * `UserRolesEditor`'s checkboxes; assign/unassign invalidate that same
 * `{User, id}` tag so the checkbox state updates immediately on toggle.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<User[], void>({
      query: () => "/users",
      transformResponse: (response: UserListResponseEnvelope) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((user) => ({ type: "User" as const, id: user.id })), { type: "User" as const, id: "LIST" }]
          : [{ type: "User" as const, id: "LIST" }],
    }),
    /** PHASE_10_TASKS.md Workstream C Group 4 — paginated variant for `UsersPage`, see `customersApi.ts`'s `listCustomersPaginated` doc comment. */
    listUsersPaginated: builder.query<PaginatedResponse<User>, PaginationQueryParams>({
      query: listUsersPaginatedQuery,
      providesTags: (result) =>
        result
          ? [...result.data.map((user) => ({ type: "User" as const, id: user.id })), { type: "User" as const, id: "LIST" }]
          : [{ type: "User" as const, id: "LIST" }],
    }),
    getUser: builder.query<UserDetail, string>({
      query: (id) => `/users/${id}`,
      transformResponse: (response: UserDetailResponseEnvelope) => response.data,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),
    createUser: builder.mutation<User, UserCreateInput>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      transformResponse: (response: UserResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    updateUser: builder.mutation<UserDetail, { id: string; body: UserUpdateInput }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      transformResponse: (response: UserDetailResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),
    assignUserRole: builder.mutation<RoleRef[], { userId: string; roleId: string }>({
      query: ({ userId, roleId }) => ({ url: `/users/${userId}/roles`, method: "POST", body: { roleId } }),
      transformResponse: (response: RoleRefListResponseEnvelope) => response.data,
      invalidatesTags: (_result, _error, { userId }) => [{ type: "User", id: userId }],
    }),
    unassignUserRole: builder.mutation<void, { userId: string; roleId: string }>({
      query: ({ userId, roleId }) => ({ url: `/users/${userId}/roles/${roleId}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { userId }) => [{ type: "User", id: userId }],
    }),
  }),
});

export const {
  useListUsersQuery,
  useListUsersPaginatedQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useAssignUserRoleMutation,
  useUnassignUserRoleMutation,
} = usersApi;
