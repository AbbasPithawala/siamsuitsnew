# Phase 3 — Order & Manufacturing Core: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_2_TASKS.md`. Scope: the order-creation and manufacturing service/API layer on top of the schema Phase 1 already built, replacing the legacy system's four duplicate assignment implementations, the untyped `manufacturing{}` blob, the broken group-order tracking, and the fragile substring-matched cost formulas. Living document.*

---

## Scope boundary

**In Phase 3:** customers API, order creation (individual + group), the manufacturing assign/complete service (one implementation, not four), job cost computation, extra payments (properly validated this time), tailor advances, and server-computed payroll settlement.

**Not in Phase 3:** invoicing, shipping, PDF/QR generation/rendering (the QR *scheme* — what a code encodes — is decided here; actually generating and printing a PDF is Phase 6's job, once there's a rendering pipeline to attach it to). Order-status transitions triggered by shipping stay out of scope too — Phase 3 should *expose* whether an order's manufacturing is complete (so Phase 6 can gate shipping on it, fixing the legacy "shipped with incomplete jobs" bug), not implement the shipping gate itself.

**Phase 3 complete (2026-08-08), including Group 7 (retailers/tailors CRUD — a planning gap, see below).** All 7 groups done and verified against the real local Postgres — 122 tests passing (up from 89 at end of Phase 2). Two connection-drop infrastructure hiccups occurred (Group 3, and a ~4-hour scheduling-latency anomaly on Group 2 with no evidence of a codebase-level cause) — both recovered by resuming the same agent with instructions to re-verify from scratch rather than trust pre-cutoff claims; no work was lost.

**Correction, not a cleanup**: after Group 6, two processes named "test process"/"testing" were deleted, incorrectly believed to be agent-created test-fixture debris based on their names and a shared timestamp. They were not — they're genuine documents from the live legacy MongoDB (confirmed directly against the source), faithfully migrated by Phase 2's ETL along with 19 other real processes, some just as oddly named ("sdfsdf", "just checking" — real junk data a person entered into the actual legacy system at some point, still present in Postgres, correctly left alone once Group 7's agent found them and flagged rather than assumed). The two wrongly-deleted rows were restored with matching IDs/values once the error was caught. **Lesson applied going forward**: an odd name plus a shared timestamp is not sufficient evidence something is disposable test data — verify against the real source (or ask) before deleting anything that came out of the migration, no matter how it reads.

**Known gap, now fixed by Group 7**: there was no retailers or tailors CRUD API anywhere — every group in Phases 2-3 that needed one worked around it with direct DB fixture inserts in tests. This is now closed.

---

## Group 0 — Decisions and one schema gap

- [x] **Schema gap**: add `tailor_processes` (tailorId, processId — join table, no `tenant_id` of its own, ownership proven by resolving the tailor, same pattern as Phase 2's `catalog-helpers.ts`). This is what the legacy `Tailor.process_id[]` did; Phase 1 didn't carry it forward and Phase 3's assignment logic can't work without it.
- [x] **Job cost formula** (replaces the legacy substring-match-on-process-name hack — see `FUNCTIONALITY_OVERVIEW.md`'s manufacturing section): `job.cost = process.price + sum(workerPrice of every order_item_component_feature on this component whose feature.processId matches this step's processId)`. This works because `features.processId` already exists in the schema — a feature declares which process it's paid during, and its selected style carries the `workerPrice`. No name-matching, no "contains 'stitching'" checks.
- [x] **Extra payment validation, properly enforced this time**: when an `extra_payment_categories` row specifies a `featureId`/`styleId`, creating an extra payment against it must check that style was *actually selected* in that component's `order_item_component_features` — not just that the product/process match (the legacy behavior, documented as "half-enforced" in `FUNCTIONALITY_OVERVIEW.md`).
- [x] **Advance-payment clearing**: add `payment_settlement_id uuid null references payment_settlements(id)` to `worker_advance_payments`. A settlement that deducts an advance links it directly — auditable, no FIFO-matching logic needed to figure out later which advance a settlement cleared.
- [x] **What Phase 3 does and doesn't touch on `orders.status`**: Phase 3 sets it on creation (`"New Order"`) and leaves rush/repeat/modified as the existing boolean/timestamp fields already in the schema. It does *not* implement shipping-triggered transitions. It *does* expose a way to check "are all this order's manufacturing_steps complete" (a service function, and/or a computed field on the order-detail response) — Phase 6 needs this to fix the legacy bug where orders could ship with incomplete jobs; Phase 3 just needs to make the fact checkable.

*Acceptance: `tailor_processes` migrated and verified; the cost formula, extra-payment validation, and advance-clearing decisions are written down here before Group 4/5/6 build against them.*

---

## Group 1 — Customers API

Depends on: nothing new (uses Phase 2's `withTenant`/RBAC/service patterns directly).

- [x] CRUD for `customers`, scoped to a `retailerId` under the tenant. Permission: reuse or extend the existing catalog permission conventions (e.g. `customers.manage` — check whether this already exists in the Phase 2 seeded catalog; if not, that's a seed-data addition, not a schema change).
- [x] Tests: tenant isolation (same pattern as Phase 2), a customer can't be created against a retailer belonging to another tenant.

---

## Group 2 — Order creation

Depends on: Group 1.

- [x] Given `{ retailerId, customerId, superProductId, components: [{ productId (must match a super_product_component slot), measurements: [...], features: [...] }] }`: create `orders` → `order_items` → `order_item_components` → `order_item_component_measurements` + `order_item_component_features`, **and** auto-generate `manufacturing_steps` for every component by walking that component's product's `product_processes` in `sequenceOrder`, all starting `status: "pending"`. This replaces the legacy's hand-built-per-order-item `manufacturing{}` object entirely.
- [x] Repeat-order support: `repeatOfOrderId`, copies the prior order's components/measurements/features as a starting point.
- [x] Rush flag support (already a schema column — just expose it on create/update).
- [x] Tests: an order against a 3-component super product produces manufacturing_steps for all 3 components in correct per-component sequence; an order against a 1-component super product works identically (proving the schema was never hardcoded to "2").

---

## Group 3 — Group orders

Depends on: Group 2.

- [x] `order_groups` + creating multiple `orders` under one `groupId`, each a completely normal order (own `order_items`/`order_item_components`/`manufacturing_steps`) — no customer-nested manufacturing structure, which is the actual mechanism of the legacy bug.
- [x] Test that directly proves the legacy bug is fixed: create a group order with 2+ customers, run each customer's components through Group 4's assign/complete flow exactly like a normal order, confirm it works — this is the test the legacy system could never pass.

---

## Group 4 — Manufacturing: one assign/complete service

Depends on: Group 0 (tailor_processes, cost formula), Group 2.

- [x] `manufacturing.service.ts` — **one** implementation, not the legacy's four:
  - `assignNextStep(componentId, tailorId)`: finds the first `manufacturing_steps` row for that component with `status: "pending"` where the prior step (by `sequenceOrder`) is `"complete"` (or it's the first step); verifies the tailor has a `tailor_processes` row for that step's `processId`; sets `status: "assigned"`, `tailorId`, `startedAt`; creates the `jobs` row using Group 0's cost formula.
  - `completeStep(jobId)`: verifies the job's step is `"assigned"` (not still pending, not already complete); sets the step `status: "complete"`, `completedAt`.
- [x] QR/scan identifier: the input to `assignNextStep` is the `order_item_component`'s own UUID (per `REWRITE_ARCHITECTURE.md`'s QR redesign) — no string parsing, no segment counting.
- [x] Route(s) calling this service — however many entry points make sense (an admin-driven one now, a future tailor-self-service one later), but they must call the same service functions, not reimplement the logic.
- [x] Tests: sequential dependency enforced (step 2 can't be assigned before step 1 completes), uncertified tailor rejected, cost computed via the new formula (not string-matching), and — the one that matters most — **a group-order component and a normal-order component both work through this exact same code path with no branching on order type.**

---

## Group 5 — Extra payments

Depends on: Group 4.

- [x] Create an extra payment against a job, validating (per Group 0's decision) that the category's product/process match **and**, where the category specifies a feature/style, that it was actually selected on the component.
- [x] Approval flow (categories/records created via the admin-facing "manage categories" path vs. created during job completion may still have different default-approval postures — decide and document, don't silently inherit the legacy's inconsistency between the two creation paths without at least making it a deliberate, written choice).
- [x] Tests: rejection when the referenced style wasn't actually selected on the order.

---

## Group 6 — Tailor advances & payroll settlement

Depends on: Group 4, Group 5.

- [x] Create an advance payment: inserts `worker_advance_payments`, increments `tailors.advanceBalance`.
- [x] Settlement service (server-computed, immutable — no client-trusted totals): given a tailor and a set of unpaid job IDs, compute `subTotal` (job costs + approved unpaid extra payments), accept `rent`/`manualBill` inputs, accept a `deductedAdvance` amount, create `payment_settlements` + `payment_settlement_jobs`, mark those jobs `paid: true`, mark the included extra payments `paid: true` (this flag is dead in the legacy system — make it live here), and link/mark the consumed `worker_advance_payments` rows `cleared: true` via the `payment_settlement_id` FK from Group 0 (also dead in legacy — make it live).
- [x] Tests: settlement math is entirely server-side; attempting to re-settle an already-paid job is rejected; confirm `extra_payments.paid` and `worker_advance_payments.cleared` are actually set (proving both previously-dead flags are now real).

---

## Sequencing summary

```
Group 0 (tailor_processes + decisions) ─┬─────────────────────────────┐
Group 1 (customers) ────────────────────┴─> Group 2 (order creation) ─┼─> Group 3 (group orders)
                                                                        └─> Group 4 (assign/complete) ─> Group 5 (extra payments) ─> Group 6 (payroll)
Group 3 and Group 4 are parallel-safe once Group 2 lands — neither depends on the other.
```

---

## Group 7 — Retailers & Tailors CRUD (planning gap, fixed 2026-08-08)

Not part of the original phase design — a genuine planning miss, not a deliberate exclusion (unlike invoicing/shipping/PDF, which were explicitly scoped out). `retailers` and `tailors` tables have existed since Phase 1, but no phase ever assigned an HTTP API for them, so every group since Phase 2 that needed one worked around it with direct DB fixture inserts in tests. See project memory / chat history for the full explanation of how this happened.

- [x] `retailers` CRUD: create/list/get/update/soft-delete, tenant-scoped. Permission: existing seeded key `retailers.manage` for writes, `authenticate` only for reads.
- [x] `tailors` CRUD: create/list/get/update/soft-delete, tenant-scoped. Creation hashes a password the same way `auth.service.ts` does for `users` (tailors log in too, per Phase 2's auth design). Permission: existing seeded key `factory.tailors.manage`.
- [x] Tailor process certification management: add/remove a `tailor_processes` row (which processes a tailor is certified for) — this has been worked around via direct DB insert in every manufacturing-related test since Group 4. Same `factory.tailors.manage` permission (certifying a tailor is part of managing them).
- [x] Tests: tenant isolation for both resources, permission gates, tailor creation actually hashes the password (not stored plaintext), certification add/remove works and is idempotent-safe (adding the same certification twice doesn't error ambiguously).

*Acceptance: a retailer and a tailor (with at least one process certification) can be created, fetched, and updated entirely through the HTTP API — no direct DB access needed for a change of this kind ever again.*

---

*Add notes below or inline above.*
