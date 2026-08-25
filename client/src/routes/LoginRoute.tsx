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
 */
export function LoginRoute() {
  const token = useSelector((state: RootState) => state.auth.token);
  const {
    data: me,
    error,
    isLoading,
    isUninitialized,
  } = useMeQuery(undefined, { skip: !token });

  if (token && me) {
    return <Navigate to="/orders" replace />;
  }
  if (token && !isFetchBaseQueryError(error) && (isLoading || isUninitialized)) {
    return <LoadingSpinner />;
  }
  return <LoginPage />;
}
