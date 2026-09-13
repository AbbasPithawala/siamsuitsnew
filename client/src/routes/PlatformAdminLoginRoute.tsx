import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { PlatformAdminLoginPage } from "../features/platformAuth/PlatformAdminLoginPage";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Structural mirror of `TailorLoginRoute.tsx` for the platform admin panel —
 * an already-authenticated platform-admin session hitting `/platform/login`
 * goes straight to `/platform/tenant-requests`; a staff session goes to
 * `/dashboard`, a tailor session to `/tailor/jobs` (mirrors
 * `TailorLoginRoute.tsx`'s/`LoginRoute.tsx`'s own reverse checks).
 */
export function PlatformAdminLoginRoute() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (token && me?.actorType === "user") {
    return <Navigate to="/dashboard" replace />;
  }
  if (token && me?.actorType === "tailor") {
    return <Navigate to="/tailor/jobs" replace />;
  }
  if (token && me) {
    return <Navigate to="/platform/tenant-requests" replace />;
  }
  if (token && !isFetchBaseQueryError(error) && (isLoading || isUninitialized)) {
    return <LoadingSpinner />;
  }
  return <PlatformAdminLoginPage />;
}
