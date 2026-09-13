import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { LoginPage } from "../features/auth/LoginPage";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Don't let an already-authenticated user sit on `/login` — but while a
 * freshly-restored token's `me` query is still in flight, show a spinner
 * instead of flashing the login form and then immediately redirecting.
 *
 * A stored tailor session hitting `/login` (the staff login page) goes to
 * its own portal, not `/orders` — a tailor has no permissions there. This
 * mirrors `TailorLoginRoute`'s reverse check for a staff session hitting
 * `/tailor/login`. Same for a stored platform-admin session, sent to the
 * platform panel instead.
 */
export function LoginRoute() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (token && me?.actorType === "tailor") {
    return <Navigate to="/tailor/jobs" replace />;
  }
  if (token && me?.actorType === "platform_admin") {
    return <Navigate to="/platform/tenant-requests" replace />;
  }
  if (token && me) {
    return <Navigate to="/orders" replace />;
  }
  if (token && !isFetchBaseQueryError(error) && (isLoading || isUninitialized)) {
    return <LoadingSpinner />;
  }
  return <LoginPage />;
}
