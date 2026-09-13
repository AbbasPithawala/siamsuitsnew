# Phase 11 — Platform Superadmin & Tenant Onboarding: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_10_TASKS.md` (format/conventions precedent — `PaginationParams`/`{data, pagination}` envelope, `withTenant`/RLS posture, the "Key architectural decisions" doc format, disclosing rather than silently patching blast-radius findings). This is a brand-new architectural layer, not an extension of an existing one: today the app has zero concept of anything *above* a tenant. The only way a tenant is created today is `server/src/db/seed/index.ts`, whose own comment already flags a "cross-tenant super admin concept... explicitly deferred — not implemented here." This phase implements it. Scope/architecture were decided in a prior planning session with the user (one explicit confirmation: business-profile completion after approval is **hybrid** — optional superadmin pre-fill at approval time, forced completion on first login otherwise); this doc does not re-litigate those decisions, only sequences and details them against the real current code. Living document.*

---

## Scope boundary

**In Phase 11:**
- **A.** A new, non-tenant-scoped actor type (`platform_admin`) and its auth plumbing.
- **B.** A `tenant_requests` table and lifecycle: public submission, superadmin list/detail.
- **C.** Extracting a reusable `provisionTenant()` out of the seed script; approve/reject routes; platform-level tenant listing/deactivation.
- **D.** The two new columns (`users.must_change_password`, `tenants.profile_completed`) and their backend endpoints (self-service change-password, profile completion).
- **E–G.** Frontend: public request page, platform admin panel, forced first-login flow for tenant owners.
- **H.** End-to-end tests/live verification of the whole request → approve → email → login → forced-flow → normal-usage path, plus the reject path and actor-isolation coverage.

**Not in Phase 11:** billing/plans enforcement (`tenants.plan` stays a free-text field an approving superadmin can set, nothing reads it yet), platform-admin-side audit logging/activity history, self-service tenant *signup with immediate provisioning* (every new tenant goes through human superadmin approval — no auto-approve path), multi-platform-admin roles/permissions (every platform admin is equally privileged, mirroring the already-established "tailors have no role system" precedent), and self-service password change for `tailor`/`platform_admin` actor types (only `users` gets `must_change_password`/the forced flow — see Workstream D).

---

## Conventions locked up front (so later groups don't drift)

1. **`platform_admins` and `tenant_requests` are global tables, not tenant-scoped** — no `tenant_id` column, no RLS policy, queried with plain `db.query...`/`db.insert(...)` the same way the already-global `permissions` table is (`tenancy.ts`'s own comment on `permissions`). Never wrapped in `withTenant` — there is no tenant to scope to.
2. **New schema file `server/src/db/schema/platform.ts`** (not folded into `tenancy.ts`) — this is a genuinely new layer *above* tenancy, not a tenancy table; keeping it physically separate matches the conceptual separation. Exported via `index.ts`'s existing `export * from "./platform"` pattern.
3. **One combined migration for this phase's whole schema footprint** — `platform_admins`, `tenant_requests`, `users.must_change_password`, and `tenants.profile_completed` all land together (mirrors `PHASE_10_TASKS.md` Workstream D Group 0's precedent of bundling a cross-workstream column into one migration pass). Unlike every prior new top-level tenant table, this migration needs **no** hand-written RLS companion migration — neither new table has a `tenant_id` to key a policy off, matching `permissions`' own precedent (absent from `0001_enable_row_level_security.sql`'s table list).
4. **No new permission-catalog entries.** Platform admins have no permission system at all (Decision A3 below); every tenant-side capability this phase touches (self-service password change, profile completion) is either identity-based (any authenticated `user` acting on their own record) or reuses an existing permission key (`invoices.manage`, Workstream D Group 2's decision).

---

# Workstream A — Platform admin identity

## Key architectural decisions

**A1. `req.actor.tenantId` becomes `string | null` — sized and hardened, not hand-waved.** `authenticate.ts`'s new third branch sets `tenantId: null` for a `platform_admin` token (per the locked design). This is a real, wide-blast-radius type change: `req.actor!.tenantId` is passed directly into `withTenant(tenantId: string, ...)` (or an equivalent tenant-scoped service call) at roughly **140+ call sites across ~22 route files** (confirmed by grep — `customers`, `orders`, `invoices`, `features`, `payroll`, `manufacturing`, `roles`, `users`, `tailors`, `tenantSettings`, `measurementProfiles`, `retailers`, `superProducts`, `processes`, `products`, `measurements`, `fittings`, `shipping`, `extra-payments`, `extraPaymentCategories`, `order-groups`, `tailorPortal`). Once `tenantId` is nullable, `tsc --noEmit` will fail at every one of them — **treat every resulting compile error as a real review, not a blind `!`-assertion exercise**: each site is safe to assert non-null only because it's already reachable exclusively by `actorType: "user"` or `"tailor"` (via `requirePermission`/`requireTailorActor`, both of which already 403 anything else) — confirm that's actually true at each site before asserting, not just to make `tsc` pass.
   - **The real remaining gap this doesn't cover**: routes gated by `authenticate` alone with no further actor-type check at all — this codebase's deliberate "open reads" convention (`GET /products`, `/features`, `/customers`, `/measurements`, etc. — see `PHASE_10_TASKS.md` Workstream E Decision 4). A `platform_admin` token sails through `authenticate` on these exactly like today, then the service calls `withTenant(null, ...)`. **Fix: `withTenant`'s existing malformed-tenant-id guard** (`server/src/db/withTenant.ts`, the `UUID_RE.test(tenantId)` check) **changes from throwing a bare `Error` (today: an unhandled 500) to throwing `HttpError(403, "FORBIDDEN", "This actor has no tenant context")`.** One small, self-contained change that closes the gap uniformly across every current and future "open read" route, without auditing or modifying any of those 22 route files individually. `null` fails the existing UUID regex exactly like any other malformed value already would.
   - Rejected alternative, and why: a separate `req.platformAdmin` field instead of reusing `req.actor` (avoids the type-widening blast radius entirely) was considered, but the already-locked design explicitly sets `req.actor.tenantId = null` — deviating would be a preference-level re-design, not a resolution of a genuine unknown, so this doc builds around the locked shape and absorbs its real cost explicitly instead.

**A2. `ActorType`/`TokenPayload` extension.** `auth.service.ts`: `ActorType = "user" | "tailor" | "platform_admin"`; `tokenPayloadSchema`'s `tenantId: z.string()` → `z.string().nullable()`; `actorType` enum gains the new value. `express.d.ts`'s `Request.actor.tenantId` → `string | null` (feeds A1).

**A3. No permission system for platform admins** — same reasoning `requireTailorActor.ts` already documents for tailors: a platform admin's capability set is fixed (everything under `/api/platform/*`), not role-configurable. `requirePlatformAdmin.ts` is a structural copy of `requireTailorActor.ts` (~7 lines: must run after `authenticate`, 403 if `actorType !== "platform_admin"`).

**A4. Seeding the first superadmin is a separate, standalone script — not folded into `db/seed/index.ts`.** That script seeds one specific tenant's dev/CI data and is safe to re-run freely by design; a platform admin is a cross-cutting, rarely-created credential that should never be an accidental side effect of routine tenant seeding. New `server/src/db/seed/platformAdmin.ts` (idempotent: skip if a `platform_admins` row with the given username already exists), reading `PLATFORM_ADMIN_NAME`/`_EMAIL`/`_USERNAME`/`_PASSWORD` from the environment (falling back to documented dev-only defaults, same posture as `SEED_ADMIN_PASSWORD`), run via a new `npm run db:seed:platform` script.

## Group 0 — Schema

Depends on: nothing.

- [ ] `platform_admins` (`idColumn`, `name`, `email` text not null, `username` text not null, `passwordHash`, `isActive` boolean default true, `timestampColumns`) — no `tenantId`, no `softDeleteColumn` (deactivate via `isActive`, matching `users`/`tailors`; a superadmin account being hard-gone vs. merely disabled isn't a real product need here). `uniqueIndex` on `username` only (the login field — matches `users`/`tailors`' own precedent of not separately constraining a non-login contact field).
- [ ] Migration: part of the one combined migration (Convention 3). No custom RLS companion.

*Acceptance: `npm run db:migrate` clean; `information_schema.columns` confirms the table shape; `pg_class` confirms `relrowsecurity = false` (deliberately, unlike every tenant table).*

## Group 1 — Backend: auth plumbing

Depends on: Group 0.

- [ ] `auth.service.ts` — A2's `ActorType`/`tokenPayloadSchema` changes.
- [ ] `authenticate.ts` — third branch: `payload.actorType === "platform_admin"` resolves against `db.query.platformAdmins`, sets `req.actor = { id, tenantId: null, actorType: "platform_admin", retailerId: null }` (skip the `retailerUsers` lookup entirely for this branch — it's meaningless for a non-tenant actor).
- [ ] `express.d.ts` — `tenantId: string | null`.
- [ ] `withTenant.ts` — A1's 403-not-500 fix.
- [ ] Full-codebase fallout: `tsc --noEmit` in `server/`, fix every resulting error per A1's per-site review discipline. **This is the single largest mechanical task in this workstream — size it accordingly, don't treat it as a one-line follow-up to the middleware change.**
- [ ] `requirePlatformAdmin.ts` (A3).

*Acceptance: `tsc --noEmit` clean across the whole server. A hand-crafted `platform_admin` JWT hitting any existing `authenticate`-only route (e.g. `GET /products`) gets a clean 403, not a 500 — verified with a real request, not code review alone. Every existing `requirePermission`/`requireTailorActor`-gated route's existing behavior is unchanged for `user`/`tailor` actors (regression: run the full existing server test suite).*

## Group 2 — Backend: login route + `/me` + seed script

Depends on: Group 1.

- [ ] `server/src/routes/platformAuth.routes.ts` — `POST /api/platform/login`, structural copy of `tailor.routes.ts`: body `{ username, password }` (**no `tenant` field** — the one real shape difference from both existing login endpoints), looks up `platformAdmins` by `username` directly (no tenant to scope the lookup by), issues a token with `tenantId: null, actorType: "platform_admin"`.
- [ ] `me.routes.ts` — third branch for `actorType === "platform_admin"`: returns `{ id, name, username, actorType: "platform_admin", tenantId: null, retailerId: null, permissions: [], logo: null }` (same envelope shape every other branch already returns, so the client's existing `Me` consumers need only a type-union widening, not new branching logic). Client: `Me.actorType` widens to `"user" | "tailor" | "platform_admin"` in `baseApi.ts`.
- [ ] `app.ts` — mount `platformAuthRouter` at `/api/platform`.
- [ ] `server/src/db/seed/platformAdmin.ts` + `package.json`'s `db:seed:platform` script (A4).

*Acceptance: `POST /api/platform/login` with the seeded superadmin's real credentials returns a token; that token's `/me` resolves correctly; wrong credentials 401; an inactive platform admin 401 (mirrors `tailor.routes.ts`'s existing inactive-account check). A `user`/`tailor` token posted to `/api/platform/login`'s sibling `authenticate`+`requirePlatformAdmin`-gated routes (Workstream B/C) 403s, and vice versa (a `platform_admin` token against any `requirePermission`/`requireTailorActor`-gated route 403s) — both directions, both real requests (this pairs with Workstream H's broader isolation sweep, but the basic case is proven here first).*

---

# Workstream B — Tenant request lifecycle

## Key architectural decisions

**B1. `tenant_requests` is global, per Convention 1** — a request exists before any tenant does, so it structurally cannot carry a `tenant_id` of its own; `createdTenantId` (nullable FK to `tenants`) is the *result* link, populated only after Workstream C's approval provisions a real tenant.

**B2. List/detail routes reuse the existing pagination convention wholesale.** `GET /api/platform/tenant-requests` is a single-purpose list (no dual "admin table + picker" consumer the way some catalog endpoints are — see `PHASE_10_TASKS.md` Workstream C's own category split) — **mandatory-pagination mode**, same `paginationQuerySchema`/`paginatedResult` helpers (`server/src/utils/pagination.ts`) reused verbatim, no new pagination mechanism invented. Same for Workstream C Group 2's `GET /api/platform/tenants`.

**B3. Status is a Postgres native enum** (`pending | approved | rejected`), matching this schema's existing precedent for small fixed sets (e.g. `manufacturingStepStatusEnum` — `REWRITE_ARCHITECTURE.md` §2's own reasoning: native enum for a closed set an admin never extends, not a varchar+lookup-table).

## Group 0 — Schema

Depends on: nothing (parallel-safe with Workstream A Group 0 — both land in the same combined migration per Convention 3).

- [ ] `tenantRequestStatusEnum` (`pending | approved | rejected`, default `pending`).
- [ ] `tenant_requests` (`idColumn`, `businessName`, `contactName`, `email`, `phone`, `requestedSlug`, `notes` text nullable, `status` (the enum), `reviewedByPlatformAdminId` nullable FK → `platform_admins.id`, `reviewedAt` nullable timestamp, `rejectionReason` nullable text, `createdTenantId` nullable FK → `tenants.id`, `timestampColumns`). No `softDeleteColumn` — a request's terminal state is `approved`/`rejected`, not deletion; nothing in this design ever needs to hide a request from the superadmin's own history view.
- [ ] No uniqueness constraint on `requestedSlug` at this table's level (two people can request the same desired slug; only one can ever be *approved* into it — enforced by `tenants.slug`'s existing unique index at approval time, per C1 below).

*Acceptance: schema compiles, migration runs, `information_schema` confirms shape/FKs; a `tenant_requests` row and its `createdTenantId` correctly reference a real `tenants.id` once one exists.*

## Group 1 — Backend: service + routes

Depends on: Group 0, Workstream A Group 1 (`requirePlatformAdmin`) for the gated routes only — the public submit route has no dependency on Workstream A at all and can be built first/in parallel.

- [ ] `server/src/services/tenantRequests.service.ts` — `createTenantRequest(input)` (public, no actor), `listTenantRequests(pagination, statusFilter?)`, `getTenantRequest(id)`. Approve/reject *transitions* live in Workstream C Group 1 (they're inseparable from provisioning/email), not here — this group is submit + read only.
- [ ] `server/src/routes/tenantRequests.routes.ts`:
  - `POST /api/platform/tenant-requests` — **no `authenticate` at all** (genuinely public — this is the one deliberately unauthenticated write endpoint in the whole API). Validates: `businessName`/`contactName`/`email`/`phone`/`requestedSlug` required, `requestedSlug` format-checked (`^[a-z0-9-]+$`, matching `tenants.slug`'s real shape), `notes` optional. A basic rate-limit/spam consideration is flagged but **not built** this phase (no existing rate-limiting middleware anywhere in this codebase to extend — out of scope, noted for whoever owns hardening this endpoint before it's internet-facing for real).
  - `GET /api/platform/tenant-requests` (+ optional `?status=` filter) and `GET /api/platform/tenant-requests/:id` — `authenticate` + `requirePlatformAdmin`, mandatory pagination (B2) on the list.
- [ ] `app.ts` — mount `tenantRequestsRouter` at `/api/platform`.

*Acceptance: an unauthenticated `POST` creates a real `pending` request; a malformed slug/missing field 400s; the superadmin list/detail routes 401 with no token, 403 with a `user`/`tailor` token, and return real paginated data with a valid platform-admin token; the status filter composes correctly with pagination (mirrors `PHASE_10_TASKS.md` Workstream C Group 1's own filter+pagination composition test shape).*

---

# Workstream C — Provisioning + approve/reject + tenant listing

## Key architectural decisions

**C1. `provisionTenant()` is a real extraction, not a verbatim lift — it must run inside `withTenant`, unlike the seed script it's extracted from.** `db/seed/index.ts` writes to `roles`/`rolePermissions`/`users`/`userRoles` (all RLS-protected) via the plain, RLS-bypassing `db` object — safe *only* because the CLI seed script's connection authenticates as a Postgres superuser (`REWRITE_ARCHITECTURE.md` §2's own RLS note). `provisionTenant()` is real application code invoked from a live HTTP route, not a CLI script — it must go through `withTenant(newTenant.id, tx => ...)` like every other service function in this codebase does, for the same reason RLS exists at all. Concretely: `db.insert(tenants)` (the tenant row itself has no `tenant_id`/RLS to worry about, same as every other tenant-row insert in this codebase) happens first as a plain, ungated write; everything after that (Owner role, permission grants, the owner `users` row, the `userRoles` link) happens inside one `withTenant(tenant.id, ...)` transaction. This is **not** a single atomic transaction spanning both halves (`withTenant` always opens its own transaction; nesting a second `db.transaction` inside a plain one isn't how this codebase's transaction helper is built, and reworking `withTenant` itself to accept an externally-supplied outer transaction is out of scope for this phase) — see the idempotency note below for how partial failure is actually handled instead.

**C2. `provisionTenant()` is shared by both the approve route and the seed script — with explicit override parameters so the seed script's existing, well-known dev behavior doesn't silently change.** Signature: `provisionTenant({ businessName, slug, ownerName, ownerEmail, ownerUsername, tempPassword?, mustChangePassword?, profileFields? })`, returning `{ tenant, ownerUser, tempPassword }`.
   - The **approve route** omits `tempPassword` (a real random one is generated — new `generateTemporaryPassword()` in `auth.service.ts`, `crypto.randomBytes`-based, not `Math.random()`, since this is a real credential mailed to a stranger) and lets `mustChangePassword` default to `true` (the real new-tenant behavior).
   - The **seed script** passes `tempPassword: SEED_ADMIN_PASSWORD, mustChangePassword: false` explicitly, preserving today's exact behavior byte-for-byte: `db/seed/index.ts`'s own tenant/Owner-role/admin-user block is replaced with a call to `provisionTenant(...)` (dogfooding the extraction — proving it's correct by continuing to rely on it for real dev/CI setup, not just type-checking it in isolation). **Found by tracing real test dependencies, not assumed**: `server/test/auth.routes.test.ts` logs in as the seeded `admin`/`ChangeMe123!` user directly — this must keep working unchanged, which is exactly what the explicit override achieves. The seed script's separate "Retailer" role block and catalog render-slot backfills are **not** part of this extraction (the locked design's own Decision 5 only names the Owner-role block) — left as-is, sequenced after the `provisionTenant()` call, unchanged.
   - `profileFields` (`logo`/`address`/`invoiceFooterText`, all optional) implements the hybrid pre-fill: when any are provided, they're written onto the new tenant row and `profileCompleted` is set `true` immediately; when none are provided, `profileCompleted` stays at its schema default (`false`, forcing Workstream G's flow on first login). The seed script never passes these — its dev tenant already gets backfilled to `true` regardless, per Workstream D Group 0's migration (below), so this is moot for it either way.

**C3. Partial-failure handling: idempotent retry, not cross-phase atomicity.** Per C1, tenant-row creation and the RLS-scoped role/user creation are two sequential operations, not one transaction — if the second half throws (e.g. a duplicate username collision that slipped past a pre-check), `provisionTenant()` mirrors the seed script's own established "check-then-create" idempotency pattern (`if (!tenant) ... if (!ownerRole) ...`) so **retrying the same approve action after the underlying issue is fixed resumes cleanly instead of creating a duplicate tenant.** The approve route itself only flips the `tenant_requests` row to `approved` (setting `createdTenantId`/`reviewedByPlatformAdminId`/`reviewedAt`) *after* `provisionTenant()` returns successfully — a request that failed partway through stays `pending`, visibly retryable from the superadmin's own queue, not silently lost.

**C4. Email send is decoupled from the DB provisioning transaction entirely.** `sendTenantWelcomeEmail()` (Workstream C Group 1) is called by the approve route *after* `provisionTenant()` has already committed, in its own `try/catch` — a `503 EMAIL_NOT_CONFIGURED` (the existing, expected failure mode in dev/test per `email.service.ts`'s own lazy-transporter posture) must never roll back or fail the whole approval. The approve route's response includes `emailSent: boolean` plus the real generated credentials in the body regardless, so a superadmin working in an environment without SMTP configured can still relay them manually. This mirrors the same reasoning `sendPdfEmail` already established for a distinct-but-analogous failure mode.

**C5. Slug conflict is resolved at approval time, not request time.** `tenant_requests.requestedSlug` carries no uniqueness constraint (B0); the approve request body accepts an optional `slug` override (surfaced in the approve dialog per Workstream F's own spec — "optional slug/plan/business-detail overrides") for exactly this case. `provisionTenant()`'s `tenants` insert reuses the existing `tenants_slug_unique` index + `catchUniqueViolation` pattern (already established in `users.service.ts`/`roles.service.ts`) to turn a real collision into a clean `409`, not a 500 — the superadmin retries the same approve action with a different slug.

## Group 0 — Backend: `provisionTenant()` extraction + seed script refactor

Depends on: Workstream A Group 0 (n/a directly, but the resulting service is what Group 1 below wires to `requirePlatformAdmin`-gated routes), Workstream B Group 0 (the `tenant_requests` FK it will eventually populate — not required for this group itself, which is pure extraction).

- [ ] `server/src/services/provisioning.service.ts` — `provisionTenant()` per C1/C2, including `generateTemporaryPassword()` in `auth.service.ts`.
- [ ] Refactor `db/seed/index.ts` to call it (C2's explicit-override path) for its tenant/Owner-role/admin-user block; the Retailer-role block and catalog backfills are untouched.
- [ ] Regression: `npm run db:seed` against a fresh DB still produces the exact same result it does today (same tenant slug, same admin username, same known password) — run `server/test/auth.routes.test.ts` against a freshly-seeded DB and confirm it still passes unmodified.

*Acceptance: `provisionTenant()` is independently callable and covered by its own unit/integration test (creates a real tenant+Owner role+all-but-`orders.create` grants+owner user, `mustChangePassword`/`profileCompleted` behave per C2's defaults and overrides); the seed script's real, observable behavior is unchanged — verified by running it, not by reading the diff.*

## Group 1 — Backend: approve/reject routes

Depends on: Group 0, Workstream A Group 1 (`requirePlatformAdmin`), Workstream B Group 1 (the request row to act on), Workstream D Group 0 (the two new columns `provisionTenant()` writes).

- [ ] `sendTenantWelcomeEmail()` in `email.service.ts` — same lazy-transporter pattern as `sendPdfEmail`, plain text/HTML (tenant slug, username, temp password, a login URL). **New env var `CLIENT_APP_URL`** (optional, matching every other env var's degrade-gracefully posture) added to `env.ts`, used to build the login URL — no such client-facing base URL exists anywhere in the current env schema (`PUBLIC_BASE_URL` is the *server's* own asset-serving base URL, a different concern).
- [ ] `tenantRequests.service.ts` gains `approveTenantRequest(id, platformAdminId, overrides)` and `rejectTenantRequest(id, platformAdminId, reason)` — both 409 if the request isn't currently `pending` (no re-approving/re-rejecting a terminal request).
- [ ] Routes on `tenantRequests.routes.ts` (extends Group 1's file from Workstream B): `POST /api/platform/tenant-requests/:id/approve` (body: optional `slug`/`plan`/`logo`/`address`/`invoiceFooterText` overrides, per C5), `POST /api/platform/tenant-requests/:id/reject` (body: `reason` required) — both `authenticate` + `requirePlatformAdmin`.

*Acceptance: approving a real request creates a real tenant + Owner role (all permissions except `orders.create`) + owner user (`mustChangePassword: true`) + `userRoles` link, flips the request to `approved` with `reviewedByPlatformAdminId`/`reviewedAt`/`createdTenantId` all set correctly, attempts the welcome email (verified both with SMTP configured — real email received in a test inbox/mailhog-style sink — and unconfigured — `emailSent: false`, approval still succeeds); a slug collision 409s cleanly with the DB otherwise untouched; rejecting sets `rejectionReason`/`reviewedAt`/`reviewedByPlatformAdminId`, creates no tenant; re-approving/re-rejecting an already-terminal request 409s.*

## Group 2 — Backend: platform-level tenant listing/deactivation

Depends on: Workstream A Group 1. Not named as its own lettered workstream in the original plan, but a genuine gap: Workstream F's `TenantsPage.tsx` ("list all provisioned tenants, view/deactivate") has no backend surface to call without it — `tenantSettings.service.ts` only ever operates on *the caller's own* tenant (`req.actor!.tenantId`), which is the wrong shape entirely for a superadmin browsing every tenant.

- [ ] `server/src/services/platformTenants.service.ts` — `listTenants(pagination)` (B2's mandatory-pagination convention, reused again), `setTenantActive(id, isActive)`.
- [ ] `server/src/routes/platformTenants.routes.ts` — `GET /api/platform/tenants`, `PATCH /api/platform/tenants/:id` (body `{ isActive: boolean }`) — both `authenticate` + `requirePlatformAdmin`.
- [ ] **Deactivation semantics, decided explicitly**: `tenants.isActive = false` alone is not currently checked anywhere on the tenant-login path (`auth.routes.ts`'s `POST /login` checks `user.isActive`, never `tenant.isActive`) — confirmed by reading the route. This phase adds that check (`!tenant.isActive` → the same `401 INVALID_CREDENTIALS` as any other login failure, not a distinct error code — deliberately indistinguishable from "wrong password" to a client-side caller, mirroring this route's existing posture of not leaking *why* a login failed) so deactivating a tenant from the platform panel actually locks out every one of its users, not just a cosmetic flag.
- [ ] `app.ts` — mount `platformTenantsRouter` at `/api/platform`.

*Acceptance: the list paginates correctly across real seeded tenants; toggling `isActive` off immediately 401s every subsequent login attempt for that tenant's users (verified live, not just the flag's DB value); toggling back on restores login.*

---

# Workstream D — Forced first-login flow, backend half

## Key architectural decisions

**D1. The two new columns, and a critical, non-obvious migration-writing requirement.** `users.must_change_password` (boolean, default `false`) is a normal single-default column — every existing user (seeded, test-fixture, or real) correctly stays `false`. **`tenants.profile_completed` is not** — traced against this codebase's own real test fixtures (`server/test/helpers/catalog-test-auth.ts#createTenantWithUser`, `client/src/routes/testSupport/permissionFixtures.ts`'s four `createTenantWith...` helpers, and the real seeded `siam-suits` dev tenant), **every one of them inserts a `tenants` row directly and would silently inherit `profile_completed: false`** under a naive `ADD COLUMN ... DEFAULT false`. Combined with Workstream G's forced-redirect guard, that would wall off a large fraction of this project's existing live-test suite the moment this ships — every test that logs in as an Owner/Admin-permission-holding session (which includes the real seeded `admin` user directly, since Owner holds `invoices.manage`, the permission Workstream D Group 2 gates completion by) would get redirected into the onboarding flow instead of landing on the page the test expects. **Fix: a hand-written migration, not the raw `drizzle-kit generate` output** — `ALTER TABLE tenants ADD COLUMN profile_completed boolean NOT NULL DEFAULT true` (retroactively marks every tenant that already exists *before* this migration runs — including every fixture helper's future inserts up until this migration, and the real dev/CI `siam-suits` tenant — as already complete, which is semantically correct: they've been operating fine without this concept), immediately followed by `ALTER TABLE tenants ALTER COLUMN profile_completed SET DEFAULT false` (so only tenants inserted *after* this migration — real `provisionTenant()` calls, and this phase's own new test fixtures that explicitly want to exercise the incomplete state — start out `false`). This asymmetric-default pattern is the actual point of Group 0 below; a reviewer should treat a plain `db:generate`d migration for this column as a real defect, not a style nit.

**D2. Self-service change-password is new — nothing like it exists today.** Confirmed by grep: zero `change-password`/`/me/password`-shaped routes anywhere. `updateUser`'s password field is an *admin resetting someone else's* password, a different operation. New `PATCH /api/me/password` (colocated in `me.routes.ts`, not a new router file — it's a "the current actor's own record" concern, matching where `GET /me` already lives), body `{ currentPassword, newPassword }`, `authenticate`-gated and internally restricted to `actorType === "user"` (tailors/platform admins have no `mustChangePassword` concept and this phase doesn't add self-service password change for them — not asked for, not built). Verifies `currentPassword` via `verifyPassword`, and **unconditionally clears `mustChangePassword` to `false` on any successful change**, not only when it was `true` — a voluntary password change satisfies the same requirement a forced one would.

**D3. Broaden the existing `tenantSettings` endpoint in place, rather than building a second one — with the tradeoff stated explicitly, per this doc's own instruction not to pick silently.** The three fields a completed profile needs (`logo`/`address`/`invoiceFooterText`) are *already* exactly `tenantSettings.service.ts`'s existing `updateTenantSettings` input, and its existing gate (`invoices.manage`) already happens to be correct for the one real caller this flow has (a freshly-provisioned Owner holds `invoices.manage` automatically, per the seed's own carve-out list excluding only `orders.create`). Two options were weighed:
   - **(Chosen) Broaden in place**: `updateTenantSettings` additionally sets `profile_completed = true` whenever called with at least one of the three fields — true regardless of caller, monotonic (nothing ever un-completes a profile), and zero new route/permission surface. The client's onboarding "complete your profile" screen reuses the *existing* `invoiceSettingsApi.ts` mutation directly, unmodified. **Tradeoff accepted**: the route/mount path (`/invoice-settings`) and its doc comment describe it as invoicing-scoped, which is now mildly overloaded — a future reader has to know this same endpoint also drives first-login onboarding. Judged acceptable because the underlying *data* genuinely is the same three columns (the `tenants` schema's own doc comment already frames them as "invoice letterhead," and "your business's letterhead" is a reasonable literal description of what a new tenant is filling in at onboarding too) — this isn't two different concepts sharing a route by coincidence.
   - **(Rejected) Dedicated `/onboarding/complete-profile` route**: would need its own permission decision (reuse `invoices.manage` anyway, or invent a new key for a one-off flow) and would duplicate `updateTenantSettings`'s body/logic behind a second route for no behavioral gain — rejected as unjustified surface area for a problem the existing endpoint already solves.
   - `tenantSettings.routes.ts`'s doc comment gets one sentence added noting the dual purpose, so this decision is discoverable in-code, not just in this doc.

## Group 0 — Schema & migration

Depends on: nothing (bundled into the same combined migration as Workstreams A/B per Convention 3).

- [ ] `users.must_change_password` (D1, plain default).
- [ ] `tenants.profile_completed` (D1, asymmetric-default hand-written migration).

*Acceptance: `information_schema.columns` confirms both columns; a direct query against the real dev/CI `siam-suits` tenant (and every tenant any pre-existing test fixture helper creates, re-run once post-migration) confirms `profile_completed = true`; a freshly `provisionTenant()`-created tenant (no `profileFields` supplied) confirms `profile_completed = false`.*

## Group 1 — Backend: change-password + `/me` fields

Depends on: Group 0, Workstream A Group 2 (this touches the same `me.routes.ts` file/response shape).

- [ ] `PATCH /api/me/password` (D2).
- [ ] `/me`'s `actorType === "user"` branch response gains two flat fields: `mustChangePassword: boolean` (the real column value) and `profileCompleted: boolean` (the caller's tenant's real column value, fetched alongside the existing `logo` tenant lookup this branch already does — no new query). **Flat fields, not a nested `tenant`/`user` sub-object**, despite the locked design's own shorthand phrasing ("`me.user.mustChangePassword` / `me.tenant.profileCompleted`") reading as nested — resolved here as a genuine but low-stakes ambiguity: `Me`'s existing shape is flat (`id`/`name`/`permissions`/`logo`/... all top-level) and is consumed that way by a nontrivial number of existing components; restructuring into nested objects would be a breaking change to every current `Me` consumer for zero information gain over two additional flat booleans. The `tailor`/`platform_admin` branches return `mustChangePassword: false, profileCompleted: true` (fixed, inapplicable-but-harmless defaults — Workstream G's guard never actually reaches these branches since it's mounted only under the staff `RequireAuth` tree, but this keeps the type honest regardless).
- [ ] Client: `Me` interface in `baseApi.ts` gains both fields.

*Acceptance: a real password change succeeds with the correct current password, 401s with the wrong one, and `mustChangePassword` reads back `false` immediately after (re-fetch `/me`) regardless of its prior value; `/me` correctly reflects both new fields for a freshly-provisioned owner (`true`/`false` until they act) versus an ordinary existing user (`false`/`true`, post-D1's backfill).*

## Group 2 — Backend: broaden `tenantSettings`

Depends on: Group 0 (needs `profile_completed` to exist).

- [ ] `updateTenantSettings` (D3): set `profileCompleted: true` alongside its existing field updates whenever the input has at least one of `logo`/`address`/`invoiceFooterText` defined.
- [ ] `tenantSettings.routes.ts`'s doc comment: one added sentence per D3.

*Acceptance: a `PATCH /invoice-settings` call from a freshly-provisioned owner (currently `profileCompleted: false`) with at least one real field flips `profile_completed` to `true`, verified by a subsequent `/me`; an empty-body/no-op call doesn't spuriously flip it (there's nothing to complete); calling it again later (an already-complete tenant tweaking their footer) is a harmless no-op on the flag.*

---

# Workstream E — Frontend: public request page

Depends on: Workstream B Group 1 (the public submit route).

## Group 0 — `RequestAccessPage.tsx`

- [ ] `client/src/features/requestAccess/requestAccessApi.ts` — one `injectEndpoints` mutation, `POST /platform/tenant-requests`, no auth header needed (the route is public; `baseApi`'s `prepareHeaders` harmlessly omits the header when `state.auth.token` is falsy, same as every unauthenticated request today).
- [ ] `client/src/features/requestAccess/RequestAccessPage.tsx` — the signup form (business name, contact name, contact email, contact phone, desired slug — all required; approx. retail locations/order volume and "how did you hear about us" folded into the one optional `notes` free-text field, per the locked field list rather than inventing extra structured columns for informational-only data).
- [ ] New route `/request-access` in `AppRoutes.tsx` — **no guard at all** (not `RequireAuth`, not anything) — a top-level sibling to `/login`/`/tailor/login`, reachable whether or not a token exists.
- [ ] Success state: a confirmation message ("your request has been received"), not a redirect into the app (there's nothing to log into yet).

*Acceptance: submitting a valid form creates a real `tenant_requests` row (verified via a platform-admin session, once Workstream F exists — or directly against the route in isolation until then); client-side validation matches the backend's required-field list; a duplicate slug submission is still accepted at this stage (per C5 — conflict resolution is deferred to approval), not blocked here.*

---

# Workstream F — Frontend: platform admin panel

Depends on: Workstream A Group 2 (login route + `/me`), Workstream B/C (the data these pages call).

## Group 0 — Auth shell: login/guard/shell

Direct structural mirror of `client/src/features/tailorAuth/` + `client/src/routes/RequireTailorAuth.tsx`/`TailorLoginRoute.tsx` + `client/src/components/tailorShell/TailorPortalShell.tsx` — same `authSlice`/`AUTH_TOKEN_STORAGE_KEY`/token-storage mechanism (a platform-admin login and a staff/tailor login still share the single browser token slot, exactly as staff and tailor sessions already do today — not a new tradeoff this phase introduces, just inheriting the existing one), same `useMeQuery`-driven `actorType` branching.

- [ ] `client/src/features/platformAuth/platformAdminAuthApi.ts` — mirrors `tailorAuthApi.ts`, `POST /platform/login`, **request body has no `tenant` field** (the one real shape difference).
- [ ] `client/src/features/platformAuth/PlatformAdminLoginPage.tsx` — mirrors `TailorLoginPage.tsx`, minus the tenant-slug input.
- [ ] `client/src/routes/RequirePlatformAdminAuth.tsx` — mirrors `RequireTailorAuth.tsx`: no token → `/platform/login`; `me.actorType === "user"` → `/dashboard`; `me.actorType === "tailor"` → `/tailor/jobs`; `me` (platform_admin) → render.
- [ ] `client/src/routes/PlatformAdminLoginRoute.tsx` — mirrors `TailorLoginRoute.tsx`'s three-way already-authenticated redirect (to `/platform/tenant-requests`, `/dashboard`, or `/tailor/jobs` as applicable).
- [ ] `client/src/components/platformShell/PlatformAdminShell.tsx` — mirrors `TailorPortalShell.tsx`'s flat-tab-bar shape (two tabs: "Tenant Requests", "Tenants" — no accordion, nothing to group, same reasoning as the tailor shell's own doc comment).
- [ ] `AppRoutes.tsx` wiring: `/platform/login` (ungated, alongside `/login`/`/tailor/login`), `/platform/*` nested under `RequirePlatformAdminAuth` → `PlatformAdminShell`, mirroring the existing tailor block's structure exactly.

*Acceptance: login/logout/redirect-on-already-authenticated/redirect-on-wrong-actor-type all work exactly like the tailor portal's equivalent, verified with real requests (live test), not just component-level mocking.*

## Group 1 — `TenantRequestsPage.tsx`

Depends on: Group 0, Workstream B Group 1, Workstream C Group 1.

- [ ] `client/src/features/platformAdmin/tenantRequestsApi.ts` — list (paginated, `?status=` filter), detail, approve mutation, reject mutation. New `TenantRequest` RTK Query tag registered in `baseApi.ts`'s `tagTypes`.
- [ ] `TenantRequestsPage.tsx` — table + status filter (reuses `usePagination()`/`<PaginationControls>` from `PHASE_10_TASKS.md` Workstream C Group 3, not a new pagination mechanism) + an approve dialog (optional slug/plan/logo/address/invoiceFooterText overrides — the hybrid pre-fill surface) + a reject dialog (required reason).

*Acceptance: the full list/filter/approve/reject cycle works end-to-end against the real backend; an approved request shows its resulting tenant; a rejected request shows its reason; a terminal request's actions are disabled/hidden, not just left clickable-but-erroring.*

## Group 2 — `TenantsPage.tsx`

Depends on: Group 0, Workstream C Group 2.

- [ ] `client/src/features/platformAdmin/platformTenantsApi.ts` — list (paginated), toggle-active mutation. New `PlatformTenant` tag.
- [ ] `TenantsPage.tsx` — table with an active/inactive toggle per row.

*Acceptance: the list renders real provisioned tenants; toggling deactivates/reactivates and is reflected immediately (cache invalidation, no manual refresh); a deactivated tenant's own users genuinely can't log in (cross-checked against Workstream C Group 2's backend behavior, not just the toggle's visual state).*

---

# Workstream G — Frontend: forced change-password + complete-profile flow

Depends on: Workstream D (both backend groups), `client/src/routes/RequireAuth.tsx`/`AppRoutes.tsx` (the composition point).

## Key architectural decision

**G1. The guard sits between `RequireAuth` and `AppShell`, and is gated on more than just the raw flags — to avoid a real lockout, not a hypothetical one.** `mustChangePassword` is checked unconditionally (safe by construction: it only ever reflects the *current* user's own flag, so it can never wall off a user for someone else's unfinished business). `profileCompleted`, however, is **additionally gated on the current session holding `invoices.manage`** (the same permission Workstream D Group 2's completion endpoint requires) before the redirect fires — a staff member added later to a tenant whose Owner never finished onboarding would otherwise hit a wall they have no ability to clear themselves, a real lockout risk given roles/permissions are fully tenant-configurable. Concretely, in `me.permissions.includes("invoices.manage")` terms, not a new permission concept. **Order matters**: `mustChangePassword` is checked first — a not-yet-changed temp password should be forced before profile completion regardless of permission, since it's the more urgent security concern of the two.

## Group 0 — Guard + pages

- [ ] `client/src/routes/RequireProfileComplete.tsx` — reads `useMeQuery`'s existing cached result (no new fetch): `me.mustChangePassword` → `<Navigate to="/change-password" />`; else `me.tenant`... (flat, per D1) `!me.profileCompleted && me.permissions.includes("invoices.manage")` → `<Navigate to="/onboarding/complete-profile" />`; else render `<Outlet />`. Mounted in `AppRoutes.tsx` as `RequireAuth` → `RequireProfileComplete` → `AppShell`, so it gates literally every staff page including `/dashboard` itself — matching the "before AppShell renders" requirement.
- [ ] `client/src/features/onboarding/ChangePasswordPage.tsx` — current/new/confirm-new password form, calls Workstream D Group 1's `PATCH /me/password`, on success re-fetches `/me` (so the guard immediately stops redirecting) and navigates into the app.
- [ ] `client/src/features/onboarding/CompleteProfilePage.tsx` — thin wrapper reusing the **existing** `invoiceSettingsApi.ts` mutation/query directly (per D3 — no new client API file), framed as "finish setting up your business" rather than "invoice settings," with the same three fields.
- [ ] Both pages are reachable *without* going through the guard redirect loop themselves — i.e. they render inside `RequireAuth` but **not** inside `RequireProfileComplete` (a page whose whole purpose is clearing the condition can't itself be gated by that same condition), matching how `RequireTailorAuth`/`RequireAuth` are siblings, not nested.
- [ ] `AppRoutes.tsx`: `/change-password` and `/onboarding/complete-profile` routes.

*Acceptance: a freshly-provisioned owner logging in for the first time is forced through change-password, then (if no pre-fill was given at approval) profile completion, then lands on the real app — each step un-gates itself immediately after completion, verified live end-to-end, not per-guard in isolation. An owner who WAS pre-filled at approval skips straight to the app after only the password step. An existing, already-onboarded tenant's login is completely unaffected (this is the regression this workstream is most likely to introduce if D1's migration fix isn't real — Workstream H re-verifies it explicitly).*

---

# Workstream H — Tests + live verification

Depends on: everything above.

## Group 0 — End-to-end and isolation coverage

- [ ] **Full happy path, one real live test**: `POST /request-access` (E) → superadmin logs in (F Group 0) → sees the pending request (F Group 1) → approves with no pre-fill → real tenant/Owner/user created (C Group 1) → welcome email attempted (real SMTP sink if available in the test environment, else asserted via `emailSent: false` + credentials still present in the response, per C4) → the new owner logs in with the temp password → forced to `/change-password` → forced to `/onboarding/complete-profile` → lands on `/dashboard` → can use the tenant normally (create a customer, place an order — proving the provisioned Owner role's grants are real and correctly excludes `orders.create` per the seed's own carve-out, still enforced end-to-end here).
- [ ] **Hybrid pre-fill variant**: same path, but the superadmin supplies `logo`/`address`/`invoiceFooterText` at approval — the resulting owner skips profile completion (only the password step fires).
- [ ] **Reject path**: submit → superadmin rejects with a reason → request shows `rejected`/reason, no tenant created, re-approving/re-rejecting 409s.
- [ ] **Regression: the D1 backfill migration actually prevents the predicted blast radius.** A real, pre-existing-style test tenant (created the same way `createTenantWithUser`/`createLimitedUserInTenant` already do, i.e. simulating "a tenant that existed before this phase") logs in as its Owner-equivalent user and lands directly on a protected page with **no** onboarding redirect — the concrete proof that D1's asymmetric-default migration did its job, not just an assertion that the migration ran.
- [ ] **Actor-isolation, both directions, live**: a `platform_admin` token against every `requirePermission`/`requireTailorActor`-gated route family (spot-check representative routes, not all ~22 files exhaustively) 403s; a `platform_admin` token against a representative `authenticate`-only "open read" route 403s via A1's `withTenant` fix (not 500s); a `user`/`tailor` token against every `/api/platform/*` route (except the public submit) 403s.
- [ ] **Tenant deactivation lockout**: proven live (C Group 2's acceptance criterion, re-confirmed here as part of the full sweep rather than only in isolation).

*Acceptance (whole workstream): every bullet above passes as a real, live test against the real running app/DB (this codebase's established testing philosophy throughout every prior phase) — not mocked, not asserted from code review. Full server + client test suites run at the end, sequential per this codebase's established flake-avoidance convention, with any pre-existing unrelated flake (e.g. the long-documented `production-etl.test.ts` idempotency flake) disclosed rather than silently re-run away.*

---

## Sequencing summary

```
Workstream A — Group 0 ──> Group 1 (the big tsc-fallout task) ──> Group 2 (login route, /me, seed script)

Workstream B — Group 0 (parallel with A Group 0 — same combined migration) ──> Group 1
  (Group 1's gated list/detail routes depend on A Group 1's requirePlatformAdmin;
   the public submit route itself has no dependency on Workstream A at all)

Workstream C — Group 0 (provisionTenant extraction, depends on nothing but is
                         most useful once B Group 0's schema exists)
                    ──> Group 1 (approve/reject, needs A Group 1 + B Group 1 + D Group 0)
              Group 2 (tenant listing/deactivation, needs only A Group 1) — parallel-safe
                        with Group 1

Workstream D — Group 0 (parallel with A/B Group 0 — same combined migration)
                    ──> Group 1 (change-password, /me fields)
                    ──> Group 2 (broaden tenantSettings)

Workstream E — Group 0 — depends only on B Group 1's public submit route

Workstream F — Group 0 (auth shell, depends on A Group 2)
                    ──> Group 1 (Tenant Requests page, depends on B/C Group 1)
                    ──> Group 2 (Tenants page, depends on C Group 2) — parallel-safe with F Group 1

Workstream G — Group 0 — depends on D Groups 0-2 in full

Workstream H — depends on everything above; last.

Cross-workstream:
  A's platform_admins table, B's tenant_requests table, and D's two new columns all ship in
    ONE combined migration (Convention 3) — not three separate ones, even though they're
    described as three workstreams' schema groups above.
  D1's tenants.profile_completed backfill (DEFAULT true retroactively, DEFAULT false going
    forward) is the one piece of this migration that is NOT a straightforward drizzle-kit
    generate output — write it by hand, and treat getting it wrong as a real regression risk
    against the existing test suite, not a style nit (see D1's full reasoning).
  C Group 1 (approve route) cannot be verified end-to-end until D Group 0's columns exist —
    provisionTenant() writes to both from its very first real call.
  G's guard reuses D Group 1's /me fields and D Group 2's broadened endpoint directly — no
    new backend surface of its own.
```

---

## Coordination status (project-manager, 2026-09-03)

**Current state verified against real code, not assumed:** zero Phase 11 surface exists yet. Confirmed by grep (`platform_admin|platformAdmin|tenant_requests|tenantRequests` → no matches anywhere in `server/src`) and by listing `server/src/db/schema/` (no `platform.ts`), `server/src/routes/` (no `platformAuth.routes.ts`/`platformTenants.routes.ts`/`tenantRequests.routes.ts`), `server/src/services/` (no `provisioning.service.ts`/`platformTenants.service.ts`/`tenantRequests.service.ts`). `git status` shows only this task doc and an `REWRITE_ARCHITECTURE.md` edit (the §2 Tenancy note already covering this phase) — no in-flight implementation work. `server/package.json` has no `db:seed:platform` script yet. Nothing to verify-as-done yet; this section is the dispatch plan for what comes next.

No architectural ambiguity found requiring escalation back to software-architect — this doc resolves its own open questions in-line (flat vs. nested `/me` fields, guard permission-gating, deactivation error-code posture, etc.), unlike some prior phases' docs.

### Assignment plan — waves (backend-developer / frontend-developer), in dependency order

Everything below is **backend-developer** unless marked FE. Waves are sequential; items within a wave are dependency-parallel-safe *except* where flagged as sharing a file (noted inline) — treat those as "do in either order, but not truly concurrently by two agents without coordinating the diff."

- **Wave 1 — combined schema + migration (single dispatch, not three).** Workstream A Group 0 + B Group 0 + D Group 0 together, because Convention 3 mandates *one* migration for this phase's whole footprint, and D1's hand-written asymmetric-default (`profile_completed`: `DEFAULT true` retroactively, then `ALTER ... SET DEFAULT false`) has to be written by hand in that same migration, not `drizzle-kit generate`d. Splitting this into 3 separate dispatches risks exactly the naive-symmetric-default failure mode the architect flagged. Deliverable: new `server/src/db/schema/platform.ts` (`platform_admins`, `tenant_requests`, `tenantRequestStatusEnum`), amendments to `tenancy.ts` (`users.must_change_password`, `tenants.profile_completed`), one hand-written migration file, `index.ts` export.
  - Verify: `npm run db:migrate` clean; `information_schema.columns` shape check for all 4 new columns/2 new tables; `pg_class.relrowsecurity = false` for both new tables; **the asymmetric default specifically** — query the real seeded `siam-suits` tenant and confirm `profile_completed = true` post-migration, then insert a throwaway test row with no explicit value and confirm it comes back `false`.

- **Wave 2 — A Group 1 alone (the big one).** Auth plumbing: `auth.service.ts` (`ActorType`/`tokenPayloadSchema`), `authenticate.ts` third branch, `express.d.ts` (`tenantId: string | null`), `withTenant.ts` 403-not-500 fix, `requirePlatformAdmin.ts`, and the full `tsc --noEmit` fallout across the ~140+ call sites/~22 files. This gates nearly everything downstream (A2, B's gated routes, C0 practically via shared `auth.service.ts`, C1, C2, D1, F0) — don't dilute it with parallel work; it's sized as its own wave deliberately, per the doc's own "don't treat as a one-line follow-up" instruction.
  - Verify (not on developer's word): `tsc --noEmit` clean in `server/`; full existing server test suite green (regression on every `requirePermission`/`requireTailorActor` route); a hand-crafted `platform_admin` JWT against `GET /products` (or similar open-read route) returns a real 403, not 500 — actual HTTP request, not code-read; spot-check a handful of the ~140 asserted call sites myself to confirm each is genuinely unreachable by anything but `user`/`tailor` actors, per A1's explicit "don't blindly `!`-assert" instruction — this is exactly the kind of claim that needs checking, not trusting.

- **Wave 3 — parallel now that A1 has landed:**
  - A Group 2 (login route, `/me` third branch, `db:seed:platform` script).
  - B Group 1 (public submit route + gated list/detail, single file `tenantRequests.routes.ts`/`.service.ts` — build as one unit even though the public half technically didn't need to wait for A1).
  - C Group 0 (`provisionTenant()` extraction + `db/seed/index.ts` refactor) — sequenced after A1 specifically because it also touches `auth.service.ts` (adds `generateTemporaryPassword()`); no functional dependency on A1, just a shared-file ordering call.
  - C Group 2 (platform tenant listing/deactivation) — parallel-safe with the above three, dep only on A1.
  - *Shared-file note:* all four of these add a mount line to `app.ts`. Minor, additive, easy to reconcile even if done out of order — flagging so whoever executes doesn't stomp on another's mount line.
  - Verify: each group's own acceptance criteria from the doc (login/me round-trip, wrong-creds 401, inactive-account 401; public submit creates a real row + validation 400s; gated list/detail 401/403/paginate correctly; tenant listing paginates + deactivation actually 401s subsequent logins live, not just DB-flag-checked).

- **Wave 4 — parallel, after Wave 3's A2 and B1 land:**
  - D Group 1 (`PATCH /me/password`, `/me`'s two new flat fields) — dep: D0 (Wave 1) + A2 (Wave 3, same `me.routes.ts`).
  - D Group 2 (broaden `updateTenantSettings`) — dep: D0 only; doc's sequencing diagram draws it after D1 but the two touch disjoint files (`me.routes.ts` vs. `tenantSettings.service.ts`/`.routes.ts`) with no functional coupling, so running them in parallel is a safe PM-level call, not a deviation from the architect's design.
  - FE Wave A — **E Group 0** (public `RequestAccessPage.tsx`), dep: B1's public route (Wave 3) only — can start as soon as Wave 3 lands, doesn't need to wait for Wave 4.
  - FE Wave A — **F Group 0** (platform admin auth shell: login/guard/shell), dep: A2 (Wave 3) only — same timing as E0.
  - Verify: password change round-trip (wrong current-password 401, correct one clears `mustChangePassword` unconditionally); `/me`'s new fields correct for both a fresh owner and an existing user; `tenantSettings` PATCH flips `profile_completed` only when a real field is present, no-op-safe; E0/F0 live login/redirect/guard behavior (mirroring tailor portal's own precedent), not component-mock-only.

- **Wave 5 — C Group 1 (approve/reject routes).** Dep: C0, A1 (both done), B1 (Wave 3, same files — sequential on `tenantRequests.service.ts`/`.routes.ts`), D0 (Wave 1, the columns it writes). This is the highest-scrutiny backend item per the user's explicit flag #3 — confirm `provisionTenant()` actually runs its post-tenant-insert half through `withTenant(tenant.id, ...)`, not the raw RLS-bypassing `db` object copy-pasted from `db/seed/index.ts`.
  - Verify: approving a real request creates a real tenant + Owner role (all permissions except `orders.create`) + owner user (`mustChangePassword: true`) + `userRoles` link; **read the actual `provisionTenant()` diff line-by-line for `db` vs `withTenant` usage on the post-insert half** — this is exactly the kind of thing a subagent could silently get wrong while still passing a shallow test; slug collision 409s cleanly; email attempted both with/without SMTP configured (`emailSent` reflects reality, approval never rolls back on email failure); reject sets fields correctly, creates no tenant; re-approve/re-reject of a terminal request 409s.

- **Wave 6 — FE, parallel:**
  - F Group 1 (`TenantRequestsPage.tsx`) — dep: F0 (Wave 4), B1 (Wave 3), C1 (Wave 5).
  - F Group 2 (`TenantsPage.tsx`) — dep: F0 (Wave 4), C2 (Wave 3) — could technically have started right after Wave 3/4, batched here for simplicity.
  - G Group 0 (forced change-password + complete-profile flow) — dep: D0/D1/D2 (Wave 1 + Wave 4) only, not on F at all. *Shared-file note:* both F0 (Wave 4) and G0 edit `AppRoutes.tsx` — sequence them (either order, not simultaneous edits) rather than parallel-dispatch onto the same file without coordination.
  - Verify: full list/filter/approve/reject cycle live against the real backend; deactivate toggle live + cache invalidation; the forced-flow guard's actual redirect order (`mustChangePassword` before `profileCompleted`, and the `invoices.manage`-gating on the profile-completion redirect specifically, per G1's lockout-avoidance reasoning) — verified with a real login, not just reading the guard component.

- **Wave 7 — Workstream H, last.** Full E2E (request → approve, with and without pre-fill → email → login → forced password → forced/optional profile completion → normal tenant usage including the `orders.create` exclusion still holding), reject path, D1-regression proof (a pre-existing-style tenant's Owner logs in with zero onboarding redirect), actor-isolation both directions (platform_admin 403 on tenant routes including an open-read route via the `withTenant` fix; user/tailor 403 on `/api/platform/*`), tenant-deactivation lockout re-confirmed live. Then full server + client test suites, sequential, with any pre-existing flake (e.g. `production-etl.test.ts`) disclosed rather than silently re-run away.
  - This is the phase's actual completion gate — per the user's explicit instruction, the phase is not done until H's live verification passes, not merely unit tests.

### Execution note — tooling gap, flagged rather than worked around

This session's tool set (`Read`/`Grep`/`Glob`/`Write`/`Edit`/`Bash`/`TodoWrite`) does **not** include a subagent-dispatch mechanism for invoking `backend-developer`/`frontend-developer` directly. I've verified the real starting state (nothing built) and produced the wave-by-wave assignment/sequencing/verification plan above, but I cannot myself execute the dispatch-and-verify loop across 7 waves in this session, and per my own boundaries I should not write the application code myself to route around that gap. Flagging this back rather than either faking completion or quietly overstepping into implementation: whoever/whatever holds the actual `backend-developer`/`frontend-developer` dispatch capability (the orchestrating session) should drive Waves 1–7 above in order, and I'm ready to resume the verify-and-track role (running `tsc --noEmit`, the test suites, migration checks, and live HTTP spot-checks against real endpoints, and updating this status section) against whatever lands, wave by wave, as soon as dispatch happens.
