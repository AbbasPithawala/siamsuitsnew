import { useEffect } from "react";
import type { ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useMeQuery } from "../api/baseApi";
import { isFetchBaseQueryError } from "../api/errorUtils";
import { logout } from "../features/auth/authSlice";
import type { AppDispatch, RootState } from "./store";

/**
 * Runs once at the app root, independent of routing: reacts to an
 * expired/invalid token (a 401 on `me`) by logging out, regardless of
 * which route that 401 happens to surface on. This is the reactive half of
 * the old `AuthGate` (Group 4); the conditional-render half is gone,
 * replaced by real routes/guards (`RequireAuth`, `RequirePermission`,
 * `LoginRoute`) which only *read* auth state.
 *
 * Restoring a *persisted* token is deliberately NOT done here as a
 * mount-time effect — see `authSlice.ts`'s `readStoredToken` doc comment
 * for why that races with route guards on deep links. It's read
 * synchronously into `store.ts`'s `preloadedState` instead, before this
 * component (or any guard) ever renders.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.token);

  const { error } = useMeQuery(undefined, { skip: !token });

  useEffect(() => {
    if (isFetchBaseQueryError(error) && error.status === 401) {
      dispatch(logout());
    }
  }, [error, dispatch]);

  return <>{children}</>;
}
