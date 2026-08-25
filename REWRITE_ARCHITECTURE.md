# Siam Suits — Rewrite Architecture & Roadmap

*Companion to `FUNCTIONALITY_OVERVIEW.md` (which describes how the current system works). This one describes what we're changing it to, and in what order. Living document — add notes/corrections inline.*

---

## 0. Locked decisions

- **Not live / low-stakes right now, solo developer** → rebuild-then-cutover, not a strangler-fig migration. Phases run serially, one at a time.
- **Database**: PostgreSQL, replacing MongoDB.
- **ORM/migrations**: Drizzle.
- **Language**: TypeScript on both `siamClient` and `siamServer`.
- **Frontend state**: Redux Toolkit + RTK Query (see §3).
- **Super products**: fully admin-defined, a super product = 1 to 3 base products in any combination (see §2).

---

## 1. The core insight driving this design

Nearly every structural problem found in the current codebase traces back to the same root cause: **the schema has no real relationships where the domain actually needs them.**

- Suit/Tuxedo bundling → `if/else` string matching in `routes.order.js`, no table.
- Process↔Product → matched by name string, not a foreign key.
- Manufacturing state (`Order.manufacturing`) → an untyped JS blob keyed by string concatenation (`"suit_jacket_0"`), sequence determined by object-key insertion order.
- Fabric/Lining/Monogram → not catalog data at all; free-text fields and hardcoded UI, duplicated per garment type.
- Piping → a catalog table, but with zero link to which products it applies to.

Postgres isn't just "a different database" here — it's the thing that makes all five of these disappear at once, because relational FKs and join tables are exactly what's missing. The schema below is designed to eliminate every one of these string-matching/blob-shaped hacks.

---

## 2. New schema, by subsystem

### Tenancy & identity
- `tenants` — one row per SaaS account.
- `users` — real identity table (tenant_id, name, username, **password_hash**, is_active) for anyone logging into the admin/staff or retailer side.
  - **Improvement over today**: `retailers` becomes a business-entity table separate from `users`. Today a Retailer *is* a login (one username per retailer store). Splitting them means a retailer can have multiple staff logins later — impossible in the current model.
- `tailors` — kept separate (factory floor has no self-serve app today), but gets `tenant_id` + hashed password like everyone else.
- `roles`, `permissions`, `role_permissions`, `user_roles` — `permissions` is a fixed global catalog (`order.create`, `retailer.manage`, ...), `roles` are tenant-scoped bundles of permissions. Enforced by **middleware on every route** — not just sidebar-hiding like today.
  - **Refined in `PHASE_10_TASKS.md` (2026-08-15), Workstream E:** `retailer_users` (the user↔retailer join table, present since Phase 1) had never actually been wired to anything — no service/route/seed data referenced it, so no login was ever really "a retailer." Phase 10 gives it a real write path, adds a unique index on `retailer_users.user_id` (a user belongs to at most one retailer; a retailer can still have many users, per the original design intent), and resolves the result onto `req.actor.retailerId` in `authenticate` — the same request-scoped identity fact `tenantId` already is, not a grantable permission. Retailer-scoped row-level isolation (customers/orders/invoices/shipping) and the catalog-admin lockdown are both enforced off this actor field, not off a new permission key — see that phase doc's "Key architectural decisions" for the full reasoning, including why catalog *reads* deliberately stay open to any authenticated actor (the order-builder and the admin catalog pages hit the literal same routes; only catalog *writes* are gated, which was already true).
- Every tenant-scoped table carries `tenant_id`; add **Postgres Row-Level Security** policies on top as defense-in-depth beyond application-level `WHERE tenant_id = ...` scoping.
  - **Implemented in Phase 2** (`server/drizzle/0001_enable_row_level_security.sql`, `server/src/db/withTenant.ts`). One critical detail: Postgres superusers (and table owners, without `FORCE ROW LEVEL SECURITY`) unconditionally bypass RLS — a hard Postgres rule, not a config toggle — and the dev `DATABASE_URL` connects as the `postgres` superuser, which would make RLS silently inert. The fix: a dedicated `NOLOGIN`/`NOBYPASSRLS` role (`siam_tenant_scoped`) that every tenant-scoped transaction switches into via `SET LOCAL ROLE` before setting `app.tenant_id` (via parameterized `set_config`, not string-interpolated `SET LOCAL`). This pattern is robust regardless of what role the pooled connection authenticates as in any environment (dev or prod), so it doesn't need revisiting when production eventually uses a non-superuser app role.

### Catalog: products, super products, and the unified feature model
- `products` — atomic garment (Jacket, Pant, Tuxedo Jacket, Shirt, Overcoat, ...), tenant-scoped.
- `super_products` + `super_product_components` (super_product_id, product_id, slot_label, sequence) — an admin names a super product and attaches **1 to 3** products to it. "Suit," "Tuxedo," and anything invented later are just rows — nothing in code references them by name.
- `processes` + `product_processes` (with explicit `sequence_order`) — replaces string-matching *and* the object-key-order hack that currently determines manufacturing sequence.
- **Unified feature model** (the fix for the fabric/lining/monogram/piping problem): one `features` table (tenant-scoped, with a `type`: `choice` | `text` | `structured`), joined to products via `feature_products` (many-to-many — fixes "a Feature belongs to exactly one product" today).
  - Lapel/pocket/vent-style choices stay `type: choice`, with `styles`/`style_options` underneath — same as today.
  - Fabric and Lining become `type: text` features with a real per-product join, replacing copy-pasted free-text inputs.
  - Monogram becomes `type: structured` (font/side/color/line-two as a JSON payload), replacing bespoke duplicated UI.
  - Piping becomes a normal `choice` feature joined explicitly to whichever products it applies to, replacing the unscoped global table.
  - One mechanism, one admin screen, one frontend component — instead of five different ones.
  - **Refined in `PHASE_9_TASKS.md` (2026-08-13, revised same day per user direction):** three new columns on `features` — `is_additional` (which legacy screen/section a `choice` feature shows under; the real column is on `features`, not `styles`, correcting an earlier phase note), `is_required` (whether the order-builder's completion gate demands a value before an order can be placed — needed once fabric/lining/piping/monogram became ordinary `features` rows too, since `type` alone can no longer distinguish "always-optional bespoke field" from "required style choice": piping is `type: choice` same as a required lapel/pocket feature, but must stay optional), and `render_slot` (nullable enum `'shoulder_type' | 'monogram_position'` — a small, closed, system-defined set of "well-known roles," same reasoning as `manufacturingStepStatusEnum`'s existing hard-enum choice below). "Shoulder Type" and "Monogram Position" are ordinary `choice` features/real `feature_products` data (no new modeling), but keep legacy's actual fixed placement (Shoulder Type on the Measurements screen, Monogram Position nested inside the Monogram block) via `render_slot` rather than rendering as ordinary styling tabs — still catalog-driven, never hardcoded by product/feature name. Also: measurements are entered once per line item and shared across however many identical physical units its quantity implies (matches legacy exactly), denormalized (copied verbatim) into each unit's own `order_item_component_measurements` at order-creation time rather than truly normalized into a new grouping table — see `PHASE_9_TASKS.md` Decisions 3–5 for the full reasoning on all of this.

### Orders & manufacturing
- `customers`, `orders` (tenant/retailer/customer FKs, status, type, rush/repeat flags), `order_groups` (lightweight parent for bulk orders — each customer's order is a normal `orders` row with `group_id` set). This is what fixes the broken customer-nested-manufacturing design found in the current `GroupOrder` — group and normal orders share one manufacturing model, always, because the nesting that broke things is never introduced.
- `order_items` (one row per super-product instance ordered) → `order_item_components` (one row per base-product piece — replaces the `"suit_jacket_0"` string-key hack with a real row/ID) → `order_item_component_measurements` and `order_item_component_features` (replacing the freeform `measurementsObject`/`stylesArray` blobs).
- `manufacturing_steps` (order_item_component_id, process_id, sequence_order, status, tailor_id, timestamps) — replaces the untyped `manufacturing{}` blob. Real rows instead of read-modify-write on a JS object; explicit sequence instead of key order; works identically for 2-component or 3-component super products.
- **QR/tag redesign**: QR encodes the `order_item_component`'s own ID directly, instead of `orderId/itemKey` parsed by counting `/` and `_` segments — the actual mechanism behind the group-order assignment bug found in the current code. No string parsing, no segment-counting, no breakage as bundles grow to 3 components.
- `jobs`, `extra_payment_categories`, `extra_payments`, `worker_advance_payments` (with `cleared` actually enforced), `payment_settlements` (server-computed, immutable — payroll math moves out of the frontend entirely). One unified assign/complete implementation replaces the four inconsistent copies found in the current server.
- `invoices`, `shipping_boxes` — same shape as today, ported relationally.
- `customer_measurement_profiles` + `customer_measurement_profile_values` — **added in `PHASE_10_TASKS.md` (2026-08-15), Workstream D.** A per-`(tenant, customer, product)` "current default" measurement set, row-shaped identically to `order_item_component_measurements` (one row per measurement definition, not a JSON blob). Populated as a side effect of order creation (same transaction as `buildOrder`'s own component insert loop, per-row upsert so an order that only touches some of a product's measurements doesn't erase the rest of the profile), consumed as an editable pre-fill when a retailer starts a new order for that customer+product — deliberately a *separate, additional* table, never a substitute for `order_item_component_measurements`'s own frozen per-order snapshot, which continues to be written exactly as Phase 9 already built it and is never retroactively touched by a later profile update.

**Max-3-components rule**: enforced in the service layer on write; a DB check constraint can be added later as extra insurance.

---

## 3. Frontend architecture

- **State: Redux Toolkit + RTK Query as the one state system**, not Redux plus a separate data library. RTK Query replaces the "axios call in every component's `useEffect`" pattern with caching/invalidation built in. Hand-written **slices** are reserved for state that's genuinely complex and client-only: an auth/session slice (replacing Context+useReducer) and an `orderBuilder` slice for the multi-step measurement/styling wizard (now walking 1-3 dynamic components per super product). Plain CRUD admin screens don't get their own slice — RTK Query alone is enough; giving every screen a slice "because we have Redux now" would just be over-engineering in a new coat of paint.
- **Component rebuild**: `MissingFabric.jsx` (4,752 lines) → one generic `<FeatureSelector>` rendering per feature `type`, fully API-driven. `SuitMeasurements.jsx`/`TuxedoMeasurements.jsx`/`Measurements.jsx` → one generic `<MeasurementForm product={...}>`. Both become correct for a 3-component super product automatically, since nothing is hardcoded to "2" anymore.
- **RBAC-driven route guards** replace sidebar-only hiding.
- **UI library consolidation**: MUI v5 only; drop legacy Material-UI v4 and react-bootstrap.
- Router (HashRouter → BrowserRouter) is a minor nice-to-have, not a priority — the server already does SPA fallback.
- **Visual design is carried over from `siamClient`, not redesigned.** This rewrite targets the data model and code structure, not the look and feel. New components reuse the existing CSS/markup from their legacy counterpart, adapted only where the new architecture genuinely requires different structure (e.g. a generic data-driven `<FeatureSelector>` replacing five copy-pasted blocks still needs to visually match the current fabric/styling screen).

---

## 4. Additional structural changes (architect's additions, beyond the original ask)

- **TypeScript, both sides** — directly targets "code written to bad standards." Several real bugs found in the audit (a `tailer_id`/`tailor_id` typo, an unimported `Jobs` model referenced at runtime, wrong field access across duplicate implementations) are exactly what a type checker catches before shipping.
- **Backend layering**: routes → services → repository/ORM (Drizzle), replacing today's pattern of DB access + business logic + HTML-building + email-sending all inline in one file (3,000+ lines in `routes.order.js`).
- **Consistent API contract**: real HTTP status codes, one error envelope — replacing `res.json({status:false,...})` returned with an HTTP 200 for every failure.
- **Validation at the boundary** (e.g. zod) instead of trusting request bodies directly.
- **Storage service abstraction** for S3 (images and PDFs currently go through ad hoc code per route). Still unbuilt as of Phase 8 (confirmed: zero storage/upload code anywhere in `server/src`, `AWS_*` env vars plumbed since Phase 1/2 but never consumed) — scoped as `PHASE_9_TASKS.md` Group 1, built generically (a local-disk dev/test backend plus an S3 backend behind the same interface) so the order-builder's reference-image upload and Phase 8 Group 4's still-open feature/style-image-upload gap share one implementation instead of two.
- **Minimal automated tests around the money-critical path** — order creation → manufacturing → payroll settlement. Zero test coverage exists today; this is the logic most worth protecting during a rewrite.
- **Secrets out of source** — Gmail SMTP password and Cloudinary key are currently committed in plaintext inside route files.

---

## 5. Phase sequence

1. **Schema & contracts finalized** — turn the ERD above into actual Drizzle schema/migrations, enumerate the permission catalog.
2. **Backend foundation** — Postgres + tenants/users/RBAC/auth (hashed passwords, header JWT, tenant scoping + RLS), catalog APIs (products/super-products/features/measurements/processes), one-shot Mongo→Postgres ETL for existing data as tenant #1.
3. **Order & manufacturing core** — order/item/component schema + APIs, unified `manufacturing_steps` + single assign/complete implementation, new opaque-ID QR scheme, server-side payroll ledger.
4. **Frontend foundation** — Redux Toolkit + RTK Query wired up, auth slice + permission-gated routing, single UI library, shell rebuild.
5. **Core flow rebuild** — generic `MeasurementForm` + `FeatureSelector`, the order-builder wizard supporting arbitrary 1-3-component super products, catalog/RBAC admin screens.
6. **Port the rest** — factory/tailor screens onto the new manufacturing API, invoicing, shipping, PDF generation rewritten to walk components generically instead of suit/tuxedo special-casing.
7. **Harden & cut over** — final data migration + verification, secrets cleanup, tests on the critical path, deploy pipeline update, retire the old stack.

---

## 6. Deferred (not now, but noted)

- Standing up specialized agent roles (software architect / manager / developer subagents) to actually execute these phases — planned for once implementation starts, not part of this design pass.

---

*Add notes below or inline above.*
