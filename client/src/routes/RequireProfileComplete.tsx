import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import type { RootState } from "../app/store";

/**
 * PHASE_11_TASKS.md Workstream G, Decision G1 — sits between `RequireAuth` and `AppShell`
 * (mounted in `AppRoutes.tsx`), so it gates every staff page including `/dashboard` itself.
 * Deliberately reads `useMeQuery`'s already-cached result rather than triggering a new fetch —
 * by the time this renders, `RequireAuth` has already resolved `me` successfully (it only
 * renders `<Outlet />`, which is where this guard lives, once `me` exists).
 *
 * Order matters: `mustChangePassword` is checked first, unconditionally — a forced password
 * change is the more urgent security concern and applies regardless of permissions, since it
 * only ever reflects the *current* user's own flag (never someone else's unfinished business).
 * `profileCompleted` is checked second, and only redirects when the session ALSO holds
 * `invoices.manage` (the same permission `updateTenantSettings` requires) — without this, a
 * staff member added later to a tenant whose Owner never finished onboarding would hit a wall
 * they have no ability to clear themselves, a real lockout given permissions are fully
 * tenant-configurable.
 */
export function RequireProfileComplete() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });

  if (me?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (me && !me.profileCompleted && me.permissions.includes("invoices.manage")) {
    return <Navigate to="/onboarding/complete-profile" replace />;
  }
  return <Outlet />;
}
