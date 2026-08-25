# Phase 4 — Frontend Foundation: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_3_TASKS.md`. Scope: the frontend project itself — Redux Toolkit + RTK Query, auth, permission-gated routing, a single UI library, and the app shell. No real feature screens yet (no measurements, no styling, no order builder — that's Phase 5). Living document.*

---

## Scope boundary

**In Phase 4:** a new `siam/client` project (TypeScript + React + Vite — not the legacy Create React App setup), Redux Toolkit + RTK Query wired to `siam/server`'s API, a login flow, session persistence, permission-gated route guards, MUI v5 as the only UI library, a theme matching the legacy visual design (per the earlier "reuse, don't redesign" decision), and the app shell (header/sidebar/layout) — with a minimal placeholder dashboard, since there's nothing real to route to yet.

**Not in Phase 4:** any actual business screens (catalog management, measurements, fabric/styling, order builder, factory/manufacturing screens, payroll) — those start in Phase 5. Don't let shell work quietly grow into building real pages.

**One backend prerequisite** (Group 0, not frontend work): `GET /api/me` — the frontend can't do permission-gated anything without a way to ask "who am I and what am I allowed to do."

**Phase 4 complete (2026-08-09).** All 7 groups done and verified, including real live-browser checks (not just `tsc`/unit tests) for every user-facing group. `siam/client` now has a working login → session-persisted → permission-gated-shell flow against the real `siam/server`. 20 tests passing.

Two real bugs were caught specifically because of the live-browser verification requirement, not by type-checking or unit tests alone:
- Group 4: this project's Vite 8 (Rolldown) dependency optimizer mis-transforms `@mui/icons-material/X` deep imports, throwing at render time despite clean types — fixed by using named barrel imports instead, now a standing note in `frontend-developer.md`.
- Group 5: deep-linking directly to a protected route with a valid persisted session briefly bounced to `/dashboard`, because `RequireAuth`'s first render ran before session restoration finished — fixed by hydrating the token synchronously via Redux `preloadedState` instead of a post-mount effect.

One architecture correction made mid-phase: `react-router-dom` was upgraded from the originally-specified v6 to v7.18.0+ after Group 1 found an unpatched moderate CVE in v6.x (open redirect, no back-port planned) — caught and fixed before any routing code existed, so the switch was free.

**Also fixed in passing**: the `npx tsc --noEmit` command silently no-ops from the client project root (the base `tsconfig.json` uses `files: []` + `references`) — `npx tsc -b` is the real check; now documented in `frontend-developer.md` so it isn't rediscovered per-group.

---

## Group 0 — Backend: `GET /api/me` (prerequisite, not frontend work)

Depends on: nothing (Phase 3 is complete).

- [x] `GET /api/me` in `siam/server`: authenticated route (via existing `authenticate` middleware) returning `{ id, name, username, actorType, tenantId, permissions: string[] }` for a `user` actor (reuse `resolveUserPermissions` from `permissions.service.ts` — don't reimplement it). For a `tailor` actor, return the same shape with `permissions: []` (tailors have no permission system, per Phase 3 Group 0's decision) rather than erroring.
- [x] Test: returns the seeded admin's full 28-permission set; returns an empty permission array for a tailor token; 401 with no/invalid token.

*Acceptance: a real curl with a real bearer token returns real permissions — this is what Group 3 below builds against.*

---

## Group 1 — Project scaffolding

Depends on: Group 0 not required (parallel-safe with it).

- [x] New `siam/client` — Vite + React + TypeScript (not Create React App — no reason to carry forward `react-scripts`' slower dev server and eject complexity into a fresh project). Legacy `siamClient` stays untouched as reference until cutover, same pattern as `siam/server` vs. legacy `siamServer`.
- [x] ESLint + Prettier (mirror `siam/server`'s config where sensible), `tsconfig.json` (strict).
- [x] Install `react-router-dom` (**v7.18.0+, not v6** — corrected post-scaffolding: the agent building this correctly flagged that v6.x carries an unpatched moderate CVE, open-redirect via backslash in `Link`/`useNavigate` [CVE-2026-53669], fixed only in 7.18.0+ with no back-port planned. Since zero code depended on v6 yet at the time this was caught, upgrading cost nothing — done immediately rather than carried forward as debt into Phase 5's real routing work), `@reduxjs/toolkit`, `react-redux`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` (MUI v5's peer deps).
- [x] Vitest + React Testing Library for component tests.
- [x] `.env`/`.env.example` for the API base URL (pointing at `siam/server`, e.g. `http://localhost:4545/api` in dev).
- [x] Folder skeleton: `src/app/` (store, root component), `src/features/` (auth slice lives here), `src/api/` (RTK Query base setup), `src/routes/`, `src/components/` (shell pieces), `src/theme/`.

*Acceptance: `npm run dev` serves a blank Vite+React page; `npm test` runs (even just a placeholder test); `tsc --noEmit` and lint are clean.*

---

## Group 2 — Theme

Depends on: Group 1.

- [x] Build an MUI v5 theme (`src/theme/`) matching the legacy `siamClient`'s visual design — pull actual color values, font choices, and spacing conventions from the legacy CSS files (`App.css` and the component-level `.css` files) rather than inventing a new look. This is the concrete first application of the "reuse, don't redesign" decision from `REWRITE_ARCHITECTURE.md` §3.
- [x] Document (briefly, in a comment or short README section) which legacy CSS files were used as the source, so Phase 5's screen-by-screen work has a reference point.

*Acceptance: a themed MUI `<Button>`/`<AppBar>` visually reads as "the same app," not a generic MUI starter theme.*

---

## Group 3 — Redux store & RTK Query base

Depends on: Group 1 (parallel-safe with Group 2).

- [x] `src/app/store.ts` — Redux Toolkit store setup.
- [x] `src/api/baseApi.ts` — one RTK Query API slice as the single source of server-state caching (per `REWRITE_ARCHITECTURE.md` §3's decision: RTK Query by default, hand-written slices only for genuinely complex client-only state). Base query reads the auth token from the Redux auth slice (Group 4) and sets `Authorization: Bearer <token>` — this is the new backend's convention (header, not the legacy's body-token pattern), get it right from the start.
- [x] A `me` endpoint definition hitting Group 0's `GET /api/me`, as the first real proof the wiring works end to end.
- [x] Base query error handling: a 401 response should be a hook point for Group 4's logout-on-expired-token behavior (don't hardcode the reaction here, just make the base query surface it cleanly).

*Acceptance: a component calling the `me` query against a real running `siam/server` (with a manually-obtained token) gets back real data.*

---

## Group 4 — Auth slice, login, session persistence

Depends on: Group 3, Group 0.

- [x] `src/features/auth/authSlice.ts` — holds the current token and the `me` response (or nothing, if logged out). This is exactly the kind of genuinely-complex-enough-for-a-slice state `REWRITE_ARCHITECTURE.md` calls out — session state needs explicit login/logout actions, not just cache invalidation.
- [x] Token persistence: store the token in `localStorage` (same mechanism the legacy app used for "stay logged in," but now just a token, not an entire serialized user object) and restore it on app load, immediately firing the `me` query to validate it and populate the slice — if that fails (expired/invalid), clear it and treat as logged out.
- [x] A login page/form: posts to `siam/server`'s `POST /api/auth/login` (tenant slug + username + password), stores the returned token, triggers the `me` query.
- [x] Logout: clear the token and slice state, clear `localStorage`.
- [x] Tests (React Testing Library): login success populates the slice and persists the token; a 401 on the `me` query during session restoration clears a stale token instead of leaving the app stuck in a broken "logged in but no data" state.

*Acceptance: refreshing the browser after a real login stays logged in; an expired/invalid stored token doesn't strand the user on a broken screen.*

---

## Group 5 — Routing & permission-gated guards

Depends on: Group 4.

- [x] `react-router-dom` v6 with `BrowserRouter` (not the legacy's `HashRouter` — the server already does SPA fallback, no reason to carry forward the hash-routing workaround in a fresh build).
- [x] A `<RequireAuth>` wrapper: redirects to `/login` if the auth slice has no valid session.
- [x] A `<RequirePermission key="...">` wrapper: renders its children only if the `me` response's `permissions` includes the given key, otherwise redirects or shows a clear "not authorized" state — this is real enforcement, not the legacy's sidebar-only hiding.
- [x] One placeholder route behind each wrapper (e.g. a bare `/dashboard` page) purely to prove the guards work — not real screens.

*Acceptance: an unauthenticated request to a protected route redirects to login; an authenticated user missing a specific permission is blocked from a route gated on it, not just hidden from a nav link.*

---

## Group 6 — App shell

Depends on: Group 5, Group 2.

- [x] One unified shell (header + sidebar + content outlet), not the legacy's two separate shells (`RetailerHeader`/`RetailerSidebar` vs `Header`/`Sidebar`) — since the new RBAC model is genuinely permission-driven rather than a hardcoded retailer/staff binary, the sidebar should render nav items based on which permissions the logged-in user actually has, regardless of what kind of user they conceptually are. This is a real simplification the new permission model enables, not just a nice-to-have.
- [x] Sidebar nav items map to permission keys (reuse the same seeded catalog from `siam/server`'s `permissions.ts` as the reference for what nav sections should eventually exist — don't invent new ones) — a user only sees links to sections they can actually access.
- [x] Logout control in the header, using Group 4's logout action.
- [x] Apply Group 2's theme throughout.

*Acceptance: logging in as the seeded admin (all 28 permissions) shows every nav section; a hypothetically limited user would see only theirs (can't fully verify without a second real role/user, but the logic should be visibly permission-driven in the code, not hardcoded to a role name).*

---

## Sequencing summary

```
Group 0 (backend /api/me) ──────────────────────────────────────┐
Group 1 (scaffolding) ─┬─> Group 2 (theme) ───────────────────────┼─> Group 6 (shell)
                        └─> Group 3 (Redux/RTK Query) ─> Group 4 (auth) ─> Group 5 (routing/guards) ─┘
Group 0 and Group 1 are both parallel-safe from the start (different codebases entirely).
Group 2 and Group 3 are parallel-safe once Group 1 lands.
```

---

*Add notes below or inline above.*
