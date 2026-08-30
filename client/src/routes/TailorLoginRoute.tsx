import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import type { RootState } from "../app/store";
import { TailorLoginPage } from "../features/tailorAuth/TailorLoginPage";
import { LoadingSpinner } from "../components/LoadingSpinner";

/**
 * Tailor-portal counterpart to `LoginRoute.tsx` — an already-authenticated
 * tailor session hitting `/tailor/login` goes straight to `/tailor/jobs`;
 * a staff session goes to `/dashboard` instead (mirrors `LoginRoute.tsx`'s
 * reverse check for a tailor session hitting `/login`).
 */
export function TailorLoginRoute() {
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
  if (token && me) {
    return <Navigate to="/tailor/jobs" replace />;
  }
  if (token && !isFetchBaseQueryError(error) && (isLoading || isUninitialized)) {
    return <LoadingSpinner />;
  }
  return <TailorLoginPage />;
}
