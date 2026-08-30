import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Gates on both "a token exists" AND "the `me` query resolved successfully"
 * — not just token presence. An expired/invalid stored token gets cleared
 * asynchronously by `AuthSessionProvider`'s 401 handling, but this guard
 * can't wait on that side effect to land: it treats a `me` error as
 * unauthenticated immediately, so a stale token never flashes a protected
 * page before the redirect happens.
 *
 * A `me.actorType === "tailor"` session is redirected to the separate
 * tailor portal instead of rendering staff pages — tailors have no
 * permissions here (`requirePermission.ts`'s own rule) and would just hit
 * `RequirePermission` walls everywhere; `RequireTailorAuth` is the mirror
 * of this check for `/tailor/...` routes.
 */
export function RequireAuth() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (me?.actorType === "tailor") {
    return <Navigate to="/tailor/jobs" replace />;
  }
  if (me) {
    return <Outlet />;
  }
  if (isFetchBaseQueryError(error)) {
    return <Navigate to="/login" replace />;
  }
  if (isLoading || isUninitialized) {
    return <LoadingSpinner />;
  }
  return <Navigate to="/login" replace />;
}
