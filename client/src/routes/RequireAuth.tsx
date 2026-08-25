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
