# Phase 5 — Core Flow Rebuild: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_4_TASKS.md`. Scope: the generic, data-driven measurement/styling components, the order-builder wizard, and catalog/RBAC admin screens — the first real UI pages in the rewrite, replacing Phase 4's placeholders. Living document.*

---

## Scope boundary

**In Phase 5:** a generic `<MeasurementForm>` and `<FeatureSelector>` (replacing the legacy's hardcoded per-super-product components), an order-builder wizard working against any 1-3-component super product, catalog admin screens (products, super-products, processes, measurements, features/styles), and RBAC admin screens (users, roles). One backend prerequisite (Group 0): the users/roles management API doesn't exist yet.

**Not in Phase 5:** factory/manufacturing screens, invoicing, shipping, PDF generation — all Phase 6.

**Known gaps, deliberately deferred, not blocking Phase 5:**
- `retailer_users` (which users can act on behalf of which retailers) has a table since Phase 1 but no API. The order-builder wizard (Group 7) will let a user pick *any* retailer from the full list rather than a restricted "retailers I can act for" list — a real simplification, not a bug, tracked here for whenever fine-grained retailer access control matters.
- No dedicated customer-management admin screen — the order-builder wizard gets an inline customer search/quick-create instead (see Group 7). A full customer CRM-style page can be added later if needed.
- `customFittings` and `style_options.thai_name` gaps from Phase 2/3 remain open, still not needed for Phase 5.

**Phase 5 complete (2026-08-09).** All 8 groups done and verified, including a real live-browser walkthrough of every user-facing screen. The capstone (Group 7) placed real orders — both a 3-component (jacket/pant/vest) and a 1-component (shirt) super product — entirely through the UI with zero hardcoding anywhere in the chain from `<MeasurementForm>`/`<FeatureSelector>` through the wizard, producing real order numbers. This is the literal, working proof of the original rewrite's core ask.

**One real backend bug found and fixed mid-phase** (Group 3): `softDeleteFeature` never cascaded to its `styles`/`style_options`, permanently orphaning any style still active when its parent feature was deleted (confirmed via 22-25 real orphaned rows in the dev DB). Fixed, orphans cleaned up. A second issue — `features` having no unique-name constraint — was investigated and **deliberately left unfixed**: querying real data first (per the standing lesson from an earlier incident) showed 8 legitimately duplicate feature names already exist (e.g. "front button" ×4, one per product, exactly matching Phase 2's ETL decision not to collapse same-named features). The dead `FEATURE_NAME_TAKEN` check was removed instead of backed by a constraint that would have broken real data. See project memory for the full writeup.

**Follow-up bug found during Phase 6 (2026-08-10), not fixed here:** `ProcessesPage.live.test.tsx`'s first test reproducibly fails even run fully in isolation (not contention) — the newly-created row's `Edit ${name}` button is genuinely missing from the DOM at the point `screen.getByRole("button", { name: `Edit ${createdName}` })` runs, immediately after `findByText(createdName)` resolves. Needs its own investigation into `ProcessesPage.tsx`'s row-rendering (name and action buttons possibly not committing in the same render).

**Operational notes**: 18 orphaned Node processes (stray dev servers/test runners going back to Phase 2, none properly stopped) were found and cleared mid-phase — a contributing cause of test flakiness Groups 2/3 encountered under concurrent load; `--no-file-parallelism` reliably distinguishes real regressions from this kind of contention going forward. Groups 3 and 7 each hit multiple (2-3) transient API connection drops near their finish line — all recovered cleanly via resume with no lost work, but this is now three groups across the whole project (plus one in Phase 2, one in Phase 3) that have hit this class of interruption; still treated as infrastructure noise rather than a pattern to design around, but worth continued light attention.

---

## Group 0 — Backend: Users & Roles management API

Depends on: nothing (Phase 3/4 are complete). Parallel-safe with Groups 5 and 6.

Mirrors Phase 3 Group 7's pattern (retailers/tailors CRUD) — same conventions, same file layout style.

- [x] `users` CRUD: create/list/get/update/soft-delete, tenant-scoped. Creation hashes a password via `auth.service.ts`'s `hashPassword` (never accept a pre-hashed value). Permission: existing seeded key `tenant.users.manage`.
- [x] `roles` CRUD: create/list/get/update/soft-delete, tenant-scoped. Permission: existing seeded key `rbac.roles.manage`.
- [x] Role-permission assignment: `POST /api/roles/:roleId/permissions` (body `{ permissionId }`), `DELETE /api/roles/:roleId/permissions/:permissionId`. Same "duplicate add is an explicit 409, not a silent no-op" posture as Phase 3 Group 7's tailor certification. `GET /api/roles/:id` should return the role's currently-assigned permissions nested (same "don't force a follow-up request" principle used everywhere else in this codebase).
- [x] User-role assignment: `POST /api/users/:userId/roles` (body `{ roleId }`), `DELETE /api/users/:userId/roles/:roleId`. `GET /api/users/:id` returns the user's assigned roles nested.
- [x] `GET /api/permissions` — read-only list of the full global permission catalog (28 keys), for the roles UI to render as checkboxes grouped by module. No specific permission required beyond `authenticate` (existing seeded key `rbac.permissions.view` — decide whether to gate this list at all, given a user needs to see it to understand what a role even grants; document the choice either way).
- [x] Tests: tenant isolation, permission gates, password hashing verified the same way Phase 3 Group 7 verified tailors' (a real login proving the hash works, not just a stored-value check), duplicate role-permission/user-role assignment behavior.

*Acceptance: a role can be created, given a subset of permissions, and assigned to a new user — entirely through the API, matching the same standard Phase 3 Group 7 set for retailers/tailors.*

---

## Group 1 — Frontend: Catalog admin — Products, Processes, Measurements

Depends on: Phase 4 (shell/routing/theme). Parallel-safe with Groups 0, 5, 6 — **run sequentially relative to Groups 2, 3, 4, 7** (all of which also add entries to `navConfig.ts`/`AppRoutes.tsx`; concurrent edits to those two shared files is a real collision risk demonstrated in prior phases, so route-adding groups don't run in parallel with each other even though their actual page logic is independent).

- [x] Products: list (table), create/edit (form: name, thai name, description, image), soft-delete. Uses the existing `GET/POST/PATCH/DELETE /api/products` from Phase 2.
- [x] Processes: list/create/edit/delete. Uses existing `/api/processes`.
- [x] Measurement definitions: list/create/edit/delete. Uses existing `/api/measurement-definitions` (confirm exact path in `server/src/routes/measurements.routes.ts`).
- [x] Add nav entries (`navConfig.ts`) and routes (`AppRoutes.tsx`) for these three, gated on their respective existing permissions (`catalog.products.manage`, `catalog.processes.manage`, `catalog.measurements.manage` — reads visible to any authenticated user per the established backend convention, writes gated).
- [x] RTK Query endpoints injected into `baseApi` for all three resources (list/create/update/delete each).

*Acceptance: an admin can create a new Product, Process, and Measurement Definition entirely through the UI and see them reflected immediately (RTK Query cache invalidation working correctly on mutation).*

---

## Group 2 — Frontend: Catalog admin — Super Products

Depends on: Phase 4. Sequential relative to Groups 1, 3, 4, 7 (shared-file reason above).

- [x] List/create/edit/soft-delete super products (name, thai name, image).
- [x] **The component builder UI** — this is the concrete proof that point #6 of the original rewrite ask works end-to-end from the UI, not just the API: a super product's edit screen lets the admin add up to 3 components, each picking a real `Product` and giving it a slot label, with the existing backend's max-3 enforcement (`422 TOO_MANY_COMPONENTS`) surfaced as a real, clear UI error rather than a raw failed request.
- [x] Nav entry + route, gated on `catalog.super_products.manage`.
- [x] RTK Query endpoints for super products + component add/remove.

*Acceptance: create a brand-new super product combining 3 arbitrary existing products through the UI alone — this is the actual, literal proof of the "any combination up to 3" requirement.*

---

## Group 3 — Frontend: Catalog admin — Features & Styles

Depends on: Phase 4. Sequential relative to Groups 1, 2, 4, 7.

This is the most structurally important admin screen — it's the UI for the unified feature model that replaced the legacy's four different fabric/lining/monogram/piping mechanisms.

- [x] Feature list/create/edit: name, thai name, `type` (`choice`/`text`/`structured`), which processes it's linked to, and **which products it applies to** (the `feature_products` many-to-many — a multi-select of products, not a single dropdown, since this is exactly the "applies to various, not all, products" capability the legacy system never had).
- [x] For `type: choice` features: manage its styles (name, thai name, image, price, worker price) and each style's style_options.
- [x] Nav entry + route, gated on `catalog.features.manage`.
- [x] RTK Query endpoints for features/feature_products/styles/style_options CRUD.

*Acceptance: create a new feature, mark it `choice` type, link it to 2 of the 6 real products (not all 6), give it 2 styles — this is the literal proof that a feature like Piping/Lining/Monogram can apply to a genuine subset of products through the UI.*

---

## Group 4 — Frontend: RBAC admin — Users & Roles

Depends on: Group 0. Sequential relative to Groups 1, 2, 3, 7.

- [x] Users: list/create/edit/deactivate. Create form includes a password field (plaintext in the form, sent once, hashed server-side — never display or re-fetch a password).
- [x] Roles: list/create/edit/delete. Edit screen shows the full 28-permission catalog (from `GET /api/permissions`) grouped by module as checkboxes, reflecting the role's current assignments, with add/remove wired to Group 0's assignment endpoints.
- [x] User detail/edit screen includes assigning/removing roles for that user.
- [x] Nav entries + routes, gated on `tenant.users.manage` / `rbac.roles.manage` respectively.

*Acceptance: create a new role with a deliberately limited permission subset, create a new user, assign them that role, log in as that user (a second browser session or logout/login cycle) and confirm the shell's sidebar shows only what that role grants — this is the real end-to-end proof that Phase 4's permission-gated shell and this phase's RBAC admin actually work together.*

---

## Group 5 — Frontend: Generic `<MeasurementForm>`

Depends on: Phase 2 (product_measurements API), Phase 4 (theme). Parallel-safe with Groups 0 and 6.

- [x] `<MeasurementForm productId={...} value={...} onChange={...} />` — a controlled component. Fetches the given product's linked measurement definitions (`GET /api/products/:id/measurements` — confirm exact route from Phase 2), renders one input per definition (value + adjustment value, both English and Thai labels shown), and calls `onChange` with the current array in exactly the shape `POST /api/orders` expects for a component's `measurements[]` (`{ measurementDefinitionId, value, adjustmentValue }[]`).
- [x] No hardcoding to any specific product or super-product — this must work identically for a product with 5 measurement points and one with 40, and for any product at all, proving the legacy's `SuitMeasurements.jsx`/`TuxedoMeasurements.jsx`/`Measurements.jsx` split is genuinely eliminated.
- [x] Reasonable visual layout matching the legacy measurement screen's general feel (per "reuse, don't redesign" — check `siamClient/src/components/Measurements/` for reference), but the component structure itself is new.

*Acceptance: rendering this component against two different real products (different measurement-definition sets) produces correctly different forms with zero code branching on which product it is.*

---

## Group 6 — Frontend: Generic `<FeatureSelector>`

Depends on: Phase 2 (features API), Phase 4 (theme). Parallel-safe with Groups 0 and 5.

- [x] `<FeatureSelector productId={...} value={...} onChange={...} />` — a controlled component. Fetches the given product's features (`GET /api/features?productId=...`, already returns the full choice→style→style_option tree nested in one call per Phase 2's design) and renders per feature `type`:
  - `choice`: a selectable list of styles (images if present), and if a style has style_options, a nested selector for the specific option.
  - `text`: a text input (fabric/lining codes).
  - `structured`: **deliberately hardcoded to monogram's known sub-fields for now** (font, side, color, line 2) — document this explicitly as a conscious simplification, not a generic structured-schema renderer, since monogram is the only `structured`-type feature that exists and there's no backend schema-description mechanism for arbitrary structured shapes. If a second structured feature type is ever added, this component (and possibly the backend's `features` table) needs revisiting then, not now.
  - Calls `onChange` with the current array shaped as `POST /api/orders` expects (`{ featureId, styleId?, styleOptionId?, textValue?, structuredValue? }[]`).
- [x] No hardcoding to any specific product — same proof requirement as Group 5, using `siamClient/src/components/FabricsAndStyling/` (specifically avoiding replicating `MissingFabric.jsx`'s per-garment-copy-pasted structure) as the visual/UX reference, not the structural one.

*Acceptance: rendering this against a product with only `choice` features and a product that also has `text`/`structured` features both work correctly, with the same component code.*

---

## Group 7 — Frontend: Order-builder wizard

Depends on: Group 5, Group 6 (and existing Phase 3 order-creation API). Sequential relative to Groups 1, 2, 3, 4 (shared-file reason above) — do this last.

- [x] A multi-step flow: (1) pick or quick-create a customer (search existing via `GET /api/customers`, inline create via `POST /api/customers` if no match — this is the "no dedicated customer admin screen" simplification from the scope boundary above), (2) pick a retailer (full list via `GET /api/retailers` — the `retailer_users` restriction gap noted above means this is currently unrestricted, not scoped to "retailers this user can act for"), (3) pick a super product (`GET /api/super-products`), (4) for each of that super product's components, render `<MeasurementForm>` + `<FeatureSelector>` (Groups 5/6) for that component's actual product, (5) review screen showing everything entered, (6) submit via `POST /api/orders`.
- [x] Rush flag and repeat-order support (`repeatOfOrderId`) surfaced somewhere reasonable in the flow (a "repeat this order" entry point from an order list/detail view is fine — a full order list/detail page isn't required by this group if it doesn't exist yet elsewhere in Phase 5; note if you end up needing one and didn't build it, that's fine to flag as a small gap for later rather than scope-creep this group).
- [x] Client-side validation matching the backend's real constraints where practical (e.g. don't let submission proceed with a missing required measurement) but the backend remains the source of truth — surface real backend validation errors (e.g. `COMPONENT_SET_MISMATCH`) clearly if they occur rather than only relying on client-side checks.
- [x] Nav entry + route, gated on `orders.create`.

*Acceptance: place a real order against a 3-component super product entirely through the UI, using components built in Groups 5/6 with zero super-product-specific code in the wizard itself — this is the actual capstone proof that this rewrite's core promise (arbitrary custom super products, generic measurement/styling UI) works end to end, UI included.*

---

## Sequencing summary

```
Group 0 (backend users/roles API) ─────────────────────────────────────────> Group 4 (RBAC admin UI)
Group 5 (MeasurementForm) ─┬───────────────────────────────────────────────> Group 7 (order-builder wizard)
Group 6 (FeatureSelector) ─┘

Groups 0, 5, 6 are mutually parallel-safe (different files entirely).
Groups 1, 2, 3, 4, 7 all touch the shared navConfig.ts/AppRoutes.tsx — run them
SEQUENTIALLY relative to each other regardless of their own logical independence,
to avoid the concurrent-shared-file-edit risk seen in earlier phases. Suggested order:
1 → 2 → 3 → 4 (after Group 0 lands) → 7 (after Groups 5/6 land).
```

---

*Add notes below or inline above.*
