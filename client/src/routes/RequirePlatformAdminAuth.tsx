import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Structural mirror of `RequireTailorAuth.tsx` for the platform admin panel
 * (PHASE_11_TASKS.md Workstream F Group 0) — same token+`me` gating,
 * redirect target `/platform/login` instead of `/tailor/login`, and a
 * `me.actorType === "user"`/`"tailor"` session is bounced to its own home
 * (`/dashboard`/`/tailor/jobs`) instead of rendering the platform panel.
 */
export function RequirePlatformAdminAuth() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (!token) {
    return <Navigate to="/platform/login" replace />;
  }
  if (me?.actorType === "user") {
    return <Navigate to="/dashboard" replace />;
  }
  if (me?.actorType === "tailor") {
    return <Navigate to="/tailor/jobs" replace />;
  }
  if (me) {
    return <Outlet />;
  }
  if (isFetchBaseQueryError(error)) {
    return <Navigate to="/platform/login" replace />;
  }
  if (isLoading || isUninitialized) {
    return <LoadingSpinner />;
  }
  return <Navigate to="/platform/login" replace />;
}
