# Phase 1 — Schema & Contracts: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md`. Scope: schema, migrations, conventions, and the permission catalog only — no route handlers, no auth logic, no business logic. That starts in Phase 2. Living document — this is what gets handed to whoever (or whatever agent) actually builds it.*

---

## Scope boundary

**In Phase 1:** project scaffolding, TypeScript/Drizzle setup, every table definition from the architecture doc, relations/constraints, the permission catalog content, migrations, seed data, a type-sharing strategy for client/server, and a test-database foundation.

**Not in Phase 1:** anything that reads/writes data through application code (auth hashing, JWT issuing, RLS-aware query helpers, API routes, the ETL script itself — though the schema must be *shaped* to support the ETL, see Group 5).

---

## Group 0 — Conventions (decide before writing any table)

These apply to every table in every later group, so they're gated first.

- [ ] **ID strategy**: UUID primary keys (`gen_random_uuid()` / UUID v7 if available) on all tables — not serial integers.
- [ ] **Timestamps**: `created_at`, `updated_at` on every table (trigger or app-managed `updated_at`, pick one and apply consistently).
- [ ] **Soft delete**: `deleted_at timestamp null` on tenant-facing business entities (tenants, users, retailers, customers, products, super_products, features, orders). Pure join/lookup tables (role_permissions, feature_products, super_product_components) hard-delete.
- [ ] **Tenant scoping**: `tenant_id uuid not null references tenants(id)` on every tenant-owned table; write the RLS policy template once, apply per-table.
- [x] **Legacy traceability**: `legacy_mongo_id text null` on every table with a current Mongo equivalent, to be dropped after Phase 2's ETL is verified. *(Done and since removed — see PHASE_2_TASKS.md Group 6's note and `drizzle/0002_drop_legacy_mongo_id.sql`. Per explicit user decision, this rewrite doesn't carry forward legacy Mongo IDs as a permanent concept — it was scaffolding for the ETL only.)*
- [ ] **Naming convention**: snake_case, plural table names (Drizzle default) — lock this so later groups don't drift.
- [ ] **Enums**: decide Postgres native `enum` vs a `varchar` + check constraint for status fields (order status, manufacturing step status, feature type). Recommend native enums for fixed small sets (manufacturing step status: pending/assigned/complete), varchar+lookup-table for things an admin might extend later (order status, if you ever want custom statuses).

*Acceptance: a one-page "conventions" doc/comment block in the Drizzle schema root that every subsequent table visibly follows.*

---

## Group 1 — Project scaffolding

- [ ] Create `siam/server` — new TS project, independent of legacy `siamServer`.
- [ ] `package.json`, `tsconfig.json`, ESLint + Prettier config.
- [ ] Install `drizzle-orm`, `drizzle-kit`, Postgres driver (`postgres` or `pg`).
- [ ] `docker-compose.yml` for a local Postgres instance (solo dev needs a reproducible local DB, not a shared Atlas-style always-on dependency).
- [ ] `.env.example` + config loader (tenant DB URL, JWT secret placeholder, AWS keys placeholder) — nothing committed for real.
- [ ] Folder skeleton: `src/db/schema/*`, `src/db/migrations/*`, `src/db/seed/*` (services/routes folders created but empty — Phase 2).
- [ ] Test runner setup (Vitest) + a throwaway "does the DB connect" smoke test, so the harness exists before Phase 2 needs it.

*Acceptance: `npm run db:migrate` against the docker-compose Postgres succeeds on an empty schema; `npm test` runs (even if there's only the smoke test).*

---

## Group 2 — Tenancy & Identity schema

Depends on: Group 0.

- [ ] `tenants`
- [ ] `users` (tenant_id, name, username/email, password_hash, is_active)
- [ ] `retailers` (tenant_id, name, code, contact info, logo, is_active) — decoupled from `users` per the architecture doc (a retailer is a business entity; who logs in on its behalf is a separate concern)
- [ ] `retailer_users` (join: which `users` can act on behalf of which `retailers`) — this is the concrete mechanism enabling "multiple staff per retailer," the improvement flagged in the architecture doc
- [ ] `tailors` (tenant_id, name, username, password_hash, is_active, advance_balance)
- [ ] `permissions` (global catalog, NOT tenant-scoped — see Group 6)
- [ ] `roles` (tenant_id, name)
- [ ] `role_permissions` (role_id, permission_id)
- [ ] `user_roles` (user_id, role_id) — support multiple roles per user
- [ ] Write the RLS policy for tenant-scoped tables using this group as the template (`tenant_id = current_setting('app.tenant_id')::uuid`), applied here first since these are the tables everything else's RLS policy will mirror.

*Acceptance: schema compiles, migration runs, RLS policies exist (even though nothing sets `app.tenant_id` yet — that's Phase 2 middleware).*

---

## Group 3 — Catalog schema

Depends on: Group 2 (tenant_id FK).

- [ ] `products` (tenant_id, name, thai_name, description, image)
- [ ] `super_products` (tenant_id, name, thai_name, image)
- [ ] `super_product_components` (super_product_id, product_id, slot_label, sequence) — app-layer will enforce max 3 rows per `super_product_id`; note the constraint in a code comment here even though it's not enforced at the DB level yet
- [ ] `processes` (tenant_id, name, thai_name, price)
- [ ] `product_processes` (product_id, process_id, sequence_order) — replaces string-matching
- [ ] `measurement_definitions` (tenant_id, name, thai_name, slug)
- [ ] `product_measurements` (product_id, measurement_definition_id)
- [ ] `features` (tenant_id, name, thai_name, type: choice|text|structured, process_id nullable)
- [ ] `feature_products` (feature_id, product_id) — the many-to-many join that replaces the single `product_id` string field on the old `Feature` model
- [ ] `styles` (feature_id, name, thai_name, image, price, worker_price)
- [ ] `style_options` (style_id, name, image)

*Acceptance: can express "Suit = Jacket + Pant" and "Three-Piece = Jacket + Vest + Pant" as rows with no code change between them; can express "Piping applies to Jacket and Overcoat but not Pant" as `feature_products` rows.*

---

## Group 4 — Orders & Manufacturing schema

Depends on: Groups 2, 3.

- [ ] `customers` (tenant_id, retailer_id, name, contact, image)
- [ ] `order_groups` (tenant_id, retailer_id, order_number)
- [ ] `orders` (tenant_id, retailer_id, customer_id, group_id nullable, order_number, status, type, rush/repeat flags, pdf_path)
- [ ] `order_items` (order_id, super_product_id, sequence)
- [ ] `order_item_components` (order_item_id, product_id, slot_label) — replaces the `"suit_jacket_0"` string key
- [ ] `order_item_component_measurements` (order_item_component_id, measurement_definition_id, value, adjustment_value, total_value)
- [ ] `order_item_component_features` (order_item_component_id, feature_id, style_id nullable, style_option_id nullable, text_value nullable, structured_value jsonb nullable)
- [ ] `manufacturing_steps` (order_item_component_id, process_id, sequence_order, status, tailor_id nullable, started_at, completed_at) — replaces the `manufacturing{}` blob
- [ ] `jobs` (tenant_id, manufacturing_step_id, tailor_id, cost, styling_price, paid, paid_date)
- [ ] `extra_payment_categories` (tenant_id, product_id, feature_id nullable, style_id nullable, process_id, cost, name, thai_name)
- [ ] `extra_payments` (job_id, category_id, tailor_id, cost, approved, paid, paid_date)
- [ ] `worker_advance_payments` (tenant_id, tailor_id, amount, cleared, cleared_at)
- [ ] `payment_settlements` (tenant_id, tailor_id, sub_total, deducted_advance, rent, manual_bill, total_pay) + `payment_settlement_jobs` join table

*Acceptance: can express a full order → manufacturing → payroll chain for a 3-component super product with the exact same table shapes as a 2-component one — no special-casing anywhere in the schema.*

---

## Group 5 — Invoicing & Shipping schema

Depends on: Group 4.

- [ ] `retailer_invoices` (tenant_id, retailer_id, line items, pricing, discount, shipping, status)
- [ ] `shipping_boxes` (tenant_id, retailer_id, tracking_code, status)
- [ ] `shipping_box_items` (shipping_box_id, order_item_component_id)

*Acceptance: ported relationally with no behavior change from today's Mongo shape — this group is the least structurally interesting, don't over-invest here.*

---

## Group 6 — Permission catalog (content, not schema)

This is enumeration work, not table design — can run in parallel with Groups 3–5.

- [ ] Walk every module in `FUNCTIONALITY_OVERVIEW.md` and enumerate granular permission keys, e.g.: `catalog.products.manage`, `catalog.features.manage`, `catalog.super_products.manage`, `orders.create`, `orders.edit`, `orders.view`, `orders.group.create`, `retailers.manage`, `factory.tailors.manage`, `factory.jobs.assign`, `factory.jobs.complete`, `factory.extra_payments.approve`, `payroll.settle`, `invoices.manage`, `shipping.manage`, `roles.manage`, `users.manage`, `tenant.settings.manage`.
- [ ] Group them by module (mirrors today's `Roles.modules` list, but each entry becomes independently enforceable instead of just nav-visibility).
- [ ] Write the seed data: insert the full permission catalog, plus a default "Owner" role template (all permissions) per new tenant.

*Acceptance: a reviewable list you can read top to bottom and say "yes, that's every distinct thing someone should be able to be allowed or denied" — this list is what Phase 2's route-guard middleware will check against, so gaps found later are expensive to retrofit.*

---

## Group 7 — Type-sharing strategy

- [ ] Decide: a shared workspace package (`packages/shared-types`, using npm/yarn workspaces) exporting types inferred from the Drizzle schema + zod request/response schemas, consumed by both `siam/server` and (later) `siam/client`. Lightweight — no Turborepo/Nx needed for a solo project at this scale.
- [ ] Set up the workspace root `package.json` if going this route.

*Acceptance: a type defined once from the Drizzle schema is importable, unmodified, from a throwaway script simulating client usage.*

---

## Group 8 — Migrations & seed

Depends on: Groups 1–6 complete.

- [ ] Generate the initial Drizzle migration from the full schema.
- [ ] Seed script: permission catalog (Group 6), a default tenant record (this becomes the target for Phase 2's ETL of the real Siam Suits business), a default Owner role.
- [ ] Document the migration/seed commands in a short README in `siam/server`.

*Acceptance: a completely fresh clone can run `npm install && npm run db:migrate && npm run db:seed` and end up with an empty-but-fully-shaped, permission-populated database.*

---

## Sequencing summary

```
Group 0 (conventions) ─┬─> Group 1 (scaffolding) ──────────────┐
                        └─> Group 2 (tenancy/identity) ─┬────────┤
                                                          ├─> Group 3 (catalog) ─┬─> Group 4 (orders/mfg) ─> Group 5 (invoicing/shipping) ─┐
                                                          │                       │                                                          │
                                                          └───────────────────────┴─> Group 6 (permissions, parallel-safe) ──────────────────┼─> Group 8 (migrations & seed)
                                                                                                                                              │
                                                          Group 7 (type-sharing) ── parallel-safe, needs Group 1 only ──────────────────────┘
```

---

*Add notes below or inline above — especially if any convention in Group 0 doesn't sit right, since everything else inherits it.*
