import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Tailor-portal counterpart to `RequireAuth.tsx` — same token+`me` gating,
 * redirect target `/tailor/login` instead of `/login`, and (the actual
 * difference) a `me.actorType === "user"` staff session is bounced to
 * `/dashboard` instead of rendering the tailor portal, mirroring
 * `RequireAuth.tsx`'s reverse check for a tailor session hitting staff
 * routes.
 */
export function RequireTailorAuth() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (!token) {
    return <Navigate to="/tailor/login" replace />;
  }
  if (me?.actorType === "user") {
    return <Navigate to="/dashboard" replace />;
  }
  if (me) {
    return <Outlet />;
  }
  if (isFetchBaseQueryError(error)) {
    return <Navigate to="/tailor/login" replace />;
  }
  if (isLoading || isUninitialized) {
    return <LoadingSpinner />;
  }
  return <Navigate to="/tailor/login" replace />;
}
