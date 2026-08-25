# Phase 2 — Backend Foundation: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_1_TASKS.md`. Scope: auth, RBAC enforcement, tenant isolation (RLS), catalog CRUD APIs, and the Mongo→Postgres ETL — the pieces needed for `siam/server` to become an actually-running application. Living document.*

---

## Scope boundary

**In Phase 2:** the HTTP app itself (`src/index.ts` — currently missing, which is why `npm run dev` errors), auth (hashing + JWT + login), RBAC middleware enforcing the Group 6 permission catalog from Phase 1, Postgres RLS + tenant-scoping middleware, a routes→services→Drizzle layering convention, catalog CRUD (products/super-products/features/measurements/processes), and the one-shot ETL migrating the live Mongo data into tenant #1.

**Not in Phase 2** (Phase 3's job per `REWRITE_ARCHITECTURE.md`'s roadmap): order creation, manufacturing/job-assignment services, payroll settlement logic. Those tables already exist from Phase 1, but no service/route code touches them yet — don't let catalog work quietly grow into order work.

---

## Group 0 — Decisions

- [ ] **Web framework: Express.** Not re-litigating this from scratch — Express is what the legacy server already uses, has zero learning-curve cost, and is entirely adequate at this app's actual scale. The problems in the legacy codebase were never "Express is the wrong framework," they were fat handlers with no service layer and no validation, which this phase fixes directly (Group 3).
- [ ] **Password hashing: `bcryptjs`, not native `bcrypt`/`argon2`.** Pure-JS, no native compilation step — this dev machine already hit enough native-tooling friction (Docker/WSL) that avoiding another one (`node-gyp` build tools for a native addon) is worth the negligible performance difference at this user count.
- [ ] **JWT: `Authorization: Bearer <token>` header**, not the legacy body-token pattern. Payload: `{ sub: userId, tenantId, actorType: "user" | "tailor" }`. Single access token, 12-hour expiry, no refresh-token flow for now — this is an internal business tool (admin/retailer/tailor logins), not a consumer app; daily re-login is an acceptable tradeoff against the complexity of a refresh flow. Revisit if that assumption stops holding.
- [ ] **RBAC applies to `users` only, not `tailors`.** Matches the schema as built in Phase 1 — `tailors` has no role/permission link tables. Tailor-facing routes (Phase 3+) just check "is this a valid, active tailor JWT," no granular permission checks. If tailor-side permissions are ever needed, that's a schema change (a role/permission link for tailors) to make deliberately later, not something to bolt on now.
- [ ] **RLS transaction scoping**: `postgres.js` pools connections, and `SET LOCAL` only holds for the duration of a transaction — so every authenticated request must run its DB work inside `db.transaction(async (tx) => { await tx.execute(sql\`SET LOCAL app.tenant_id = ${tenantId}\`); ... })`, not on the bare pooled connection. This is the mechanism, not just a policy — write it once as request-scoping middleware/helper (Group 3) and make every service use it, rather than each service remembering to do it.
- [ ] **Service layer convention**: `routes/*.ts` (thin: parse/validate request, call a service, shape the response) → `services/*.ts` (business logic, calls Drizzle) → schema. Zod schemas for request validation live next to the route. Response envelope: real HTTP status codes, `{ data }` on success, `{ error: { message, code } }` on failure — no more "200 OK with `status:false` buried in the body."

*Acceptance: written down here and followed consistently — check this list before merging any Phase 2 code that seems to deviate.*

---

## Group 1 — App entry point

Depends on: nothing (unblocks `npm run dev`, currently broken).

- [ ] `src/app.ts` — builds the Express app: JSON body parsing, `helmet`, `cors` (locked down, not wide-open like the legacy `cors()`), the tenant/auth middleware chain (added incrementally as later groups land), a catch-all error handler matching the Group 0 response envelope.
- [ ] `src/index.ts` — thin entry point: import `app`, `app.listen(env.PORT)`.
- [ ] Add `express`, `helmet`, `cors`, `bcryptjs`, `jsonwebtoken` (+ `@types/*`) to `package.json`.

*Acceptance: `npm run dev` starts a server that responds to a trivial `GET /health` with 200.*

---

## Group 2 — Auth

Depends on: Group 1.

- [ ] `src/services/auth.service.ts` — `hashPassword`, `verifyPassword` (bcryptjs), `issueToken`, `verifyToken` (jsonwebtoken).
- [ ] `src/middleware/authenticate.ts` — reads `Authorization: Bearer`, verifies, loads the `users` or `tailors` row (by `actorType`), attaches `req.actor` (`{ id, tenantId, actorType }`). 401 on missing/invalid/expired token.
- [ ] `POST /auth/login` — looks up by `tenantId` (or a tenant-resolving slug/subdomain — decide how a login request identifies its tenant; simplest for now: username lookup scoped by a `tenant` field in the request body, since there's only one real tenant during ETL-era anyway) + username, verifies password hash, issues a token. Rejects inactive users.
- [ ] `POST /tailor/login` — same shape, against `tailors`.
- [ ] Unit-ish tests: hash/verify round-trip, token issue/verify round-trip, login rejects wrong password and inactive accounts.

*Acceptance: can log in as the seeded tenant's Owner-role user (once one exists — see Group 6) and get back a working bearer token; a request with no/garbage token is rejected with 401, not a 500.*

---

## Group 3 — Tenant scoping & RLS

Depends on: Group 2 (needs `req.actor.tenantId`).

- [ ] Write RLS policies for every tenant-scoped table (every table with a `tenant_id` column — see Phase 1's schema files) as a Drizzle migration: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` + a policy checking `tenant_id = current_setting('app.tenant_id')::uuid`.
- [ ] `src/db/withTenant.ts` — the transaction-scoping helper described in Group 0: takes `tenantId` and a callback, runs the callback inside a transaction with `SET LOCAL app.tenant_id` set first, returns the callback's result.
- [ ] Wire it into the request pipeline: an authenticated request's service calls go through `withTenant(req.actor.tenantId, tx => ...)`, not the bare `db` export.
- [ ] A deliberate test: two tenants, same-shaped data, confirm a request scoped to tenant A cannot read/write tenant B's rows even if a service forgets an application-level `WHERE tenant_id = ...` — this is what RLS is *for*, so prove it actually catches that mistake.

*Acceptance: the cross-tenant-leak test in the last bullet actually fails before RLS is added and passes after — write it first if that's easier to confirm the policy is doing something.*

---

## Group 4 — RBAC middleware

Depends on: Group 2.

- [ ] `src/services/permissions.service.ts` — given a `userId`, resolve the full set of permission keys via `user_roles → roles → role_permissions → permissions` (one query, cached per-request — not per-check).
- [ ] `src/middleware/requirePermission.ts` — a middleware factory: `requirePermission("orders.create")` — 403s if the resolved permission set doesn't include the key.
- [ ] Apply it to at least one real route in Group 5 as a working example other routes copy.

*Acceptance: a user whose role lacks a permission gets a 403 on that route; a user with it succeeds. Confirmed against the real seeded Owner role (all 28 permissions) plus a second, deliberately-limited role created for the test.*

---

## Group 5 — Catalog CRUD APIs

Depends on: Groups 3, 4.

- [ ] `products` — create/list/update/soft-delete, tenant-scoped.
- [ ] `super_products` + `super_product_components` — create/list/update, with the max-3-components rule enforced in the service (reject a 4th component with a clear error, not a silent truncation).
- [ ] `processes`, `product_processes` (sequence-ordered).
- [ ] `measurement_definitions`, `product_measurements`.
- [ ] `features`, `feature_products`, `styles`, `style_options` — this is the one that most directly enables the frontend's future `<FeatureSelector>`, so get the response shape right: a feature response should include its `type`, its linked products, and (for `choice` type) its styles/options nested, in one call — not force the frontend to make N follow-up requests.
- [ ] Zod request schemas for every endpoint (Group 0's convention).

*Acceptance: can, through the API alone, define a brand-new super product combining three existing products with a slot label each — proving point #6 of the original rewrite ask actually works end-to-end, not just at the schema level.*

---

## Group 6 — Mongo → Postgres ETL (catalog only)

Depends on: Group 5 (schema/services stable enough that the ETL's target shape won't shift under it).

**Scope narrowed by explicit decision (2026-08-08): catalog data only — products, features/styles, processes, measurements, piping.** Orders, customers, retailers, admins/users, roles/permissions, tailors, jobs, payments, and invoices are explicitly **not** migrated — the legacy `orders`/`customers`/etc. collections (221 orders, 624 customers, 507 jobs, etc. — confirmed non-trivial, real-looking data on the live legacy Atlas cluster) are left alone. This removes the highest-risk part of the original ETL scope (translating the `manufacturing{}` blob, the group-order child-order collapsing) entirely from Phase 2.

- [x] Connect (read-only) to the legacy MongoDB (`siamServer/.env`'s `MONGOURL` — confirmed reachable, live Atlas cluster).
- [x] `Product` (6 docs) → `products`, under tenant #1 (already seeded).
- [x] `Process` (21 docs) → `processes`. `Product.process` (legacy: array of raw process-name strings) → resolve to the migrated `processes.id` by name match, populate `product_processes` with a sequence order (legacy has no explicit order — use array index).
- [x] `Measurement` (43 docs) → `measurement_definitions`. Legacy `Product.measurements` (array of ObjectId refs) → `product_measurements`.
- [x] `Feature` (51 docs) → `features` + `feature_products`. **Findings**: same-named features across products (e.g. "front button" on jacket/overcoat/vest/tuxedojacket) each have independently-sized style sets — collapsing would have merged unrelated per-product catalogs, so kept faithful 1:1 as the safe default. Also found 11 features orphaned on a deleted "jeans" product (migrated with no `feature_products` link, since there's no product to link to) and 34 styles with dangling `feature_id` refs to already-deleted features (pre-existing Mongo data rot, skipped since `styles.featureId` is `NOT NULL`).
- [x] `Style` (270 docs, nested `style_options`) → `styles` + `style_options` under their migrated feature. 236 of 270 migrated (34 skipped as dangling, see above); 169 `style_options` migrated. **Gap found**: legacy `style_options[].thai_name` has no home in the new `style_options` table (only the parent `style` has one) — dropped, not yet decided whether to add the column.
- [x] `Piping` (34 docs) → synthesized as **one shared** `features` row (type `choice`, name "Piping"), linked via `feature_products` to all 6 migrated products (no per-product signal found in the legacy data), each piping doc becoming a `styles` row under it — not duplicated per product.
- [x] `customFittings` (18 docs) — confirmed count, **not migrated, no table invented**. Still an open gap for an explicit decision (see below).
- [x] A validation pass: counts reconciled exactly (see completion note below); spot-checked live through the real API (login + `GET /api/products` + `GET /api/features?productId=...`), not just DB inspection.
- [x] Scope boundary respected: orders/customers/retailers/etc. were never queried.

**Completed 2026-08-08.** Final counts: 6 products, 21 processes, 43 measurement_definitions, 52 features (51 migrated + 1 synthesized Piping), 270 styles (236 migrated + 34 synthesized from Piping), 169 style_options, 18 product_processes links, 60 product_measurements links, 46 feature_products links. All of `tsc`/`lint`/`test` (38 tests) passed.

**Post-completion cleanup (2026-08-08, explicit user decision):** `legacy_mongo_id` was removed entirely — dropped from every schema file, dropped from the live database (`drizzle/0002_drop_legacy_mongo_id.sql`), and the ETL script itself (`src/db/etl/catalog.ts`, `npm run etl:catalog`) was deleted since it depended on that column for idempotency and its one-shot job was already done. This rewrite does not carry forward legacy Mongo IDs as an ongoing concept — the migrated data stands on its own from here.

**Two open decisions surfaced by this ETL, still unresolved** — do not block Phase 3 on these, but track them:
1. `customFittings` (18 legacy docs, per-product custom fitting presets) — no equivalent table exists; needs an explicit decision on whether/how to model it.
2. `style_options.thai_name` — dropped during migration since no column exists for it; needs a decision on whether to add it, given this is a bilingual (EN/Thai) business.

*Acceptance: every legacy `Product`/`Process`/`Measurement`/`Feature`/`Style`/`Piping` document has a corresponding, spot-checked-correct row in Postgres under tenant #1, row counts reconcile, and the `customFittings` gap is reported rather than silently skipped or invented.*

---

## Sequencing summary

```
Group 0 (decisions) ─> Group 1 (app entry) ─> Group 2 (auth) ─┬─> Group 3 (tenant scoping/RLS) ─┐
                                                                 ├─> Group 4 (RBAC middleware) ────┼─> Group 5 (catalog APIs) ─> Group 6 (ETL, final run)
                                                                 └──────────────────────────────────┘
                                                                 Group 6 can be *written* in parallel from Group 2 onward — only the final run waits on Group 5.
```

---

*Add notes below or inline above.*
