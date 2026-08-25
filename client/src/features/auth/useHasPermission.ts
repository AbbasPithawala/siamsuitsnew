import { useSelector } from "react-redux";
import { useMeQuery } from "../../api/baseApi";
import type { RootState } from "../../app/store";

/**
 * Button/action-level permission check, distinct from `RequirePermission`
 * (which gates an entire route). The catalog admin screens (PHASE_5_TASKS.md
 * Group 1) reflect the backend's actual access rule: reads are open to any
 * authenticated user (`authenticate` only, see e.g.
 * `server/src/routes/products.routes.ts`'s doc comment), only writes require
 * `catalog.*.manage`. So the page itself sits behind `RequireAuth` alone,
 * and this hook decides whether to render the mutating buttons (Add/Edit/
 * Delete), not whether to render the page.
 */
export function useHasPermission(permission: string): boolean {
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });
  return me?.permissions.includes(permission) ?? false;
}
