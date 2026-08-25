# Phase 8 — Admin UI Parity & Gap Closure: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_7_TASKS.md`. Triggered by a direct user report: `ManageProduct.jsx`'s per-product measurement/styling reorder capability has no equivalent in the new client at all. Investigating that one gap surfaced a much wider pattern — every legacy admin page (`siamClient/src/components/superAdmin/pages/admin/`) was compared against its new-rewrite equivalent. Living document.*

---

## Scope boundary

**In Phase 8:** closing real functional regressions and visual-parity gaps across the 11 admin-side legacy pages that have new-rewrite equivalents, deciding what to do about 2 legacy pages that never had a working backend even in production, and fixing one real safety regression (no protection against editing/deleting the tenant's built-in admin role/user).

**Not in Phase 8 (unless the user asks otherwise below):** retailer-facing and factory-floor pages — this pass was scoped to the *admin* side only, per the user's specific complaint. Order/manufacturing/payroll/invoicing/shipping screens (Phase 6) aren't re-audited here.

**Full comparison research is complete** — see the per-page findings below, gathered by directly reading every legacy `.jsx` file + `admin.css`/`App.css` against its new `client/src/features/**` equivalent (or confirming none exists), including schema/permission-seed cross-checks.

---

## Cross-cutting finding: visual parity, one root cause

`client/src/theme/theme.ts` (Phase 4) pulled the legacy's brand color, font, and **button** radius/hover into a global MUI theme — that part transferred correctly, and `variant="contained"` buttons across the new app are already reasonably close to legacy's `.custom-btn`/`.b-btn` look. Everything past that — table zebra-striping, uppercase bold headers, the search-bar pattern, inline enable/disable pill toggles, circular icon-button treatments — was never captured in the shared theme and was never replicated per-page either. Every admin table in the new client (`FeaturesPage`, `ProcessesPage`, `MeasurementDefinitionsPage`, `RolesPage`, `UsersPage`, `RetailersPage`) uses bare default MUI `Table`/`Paper variant="outlined"`.

**Strategy revised (2026-08-12), superseding the recommendation below.** The MUI-theme-override approach was attempted (a Group 0 dispatch got partway through it) but the user made a well-reasoned call to change direction: they don't read HTML/CSS, so "I approximated legacy's look in MUI" is a claim they have no independent way to verify — whereas literal, verbatim reuse of legacy's actual markup and CSS classes (byte-for-byte copied files, `diff`-able against the source) is something they can trust by construction, not by taking my word for it. **New approach, used for Group 1 below and the template for the rest of this phase**: for each page, copy the real legacy `.jsx` markup structure and its actual CSS files (`admin.css`, `App.css`) verbatim into `client/src/styles/legacyAdmin/`, rebuild the component with that exact markup/className structure, and rewire its data-fetching to the new server's RTK Query hooks. `theme.ts`'s existing global overrides (brand color, button radius) stay as-is and still help, but per-page visual parity now comes from literally reusing legacy's CSS, not approximating it. The abandoned MUI-theme-override attempt's shared `<StatusToggle>`/`<AdminSearchBar>`-as-new-components idea is dropped in favor of just porting legacy's real `.enablebutton`/`.searchstyle` classes when a page that needs them gets rebuilt.

---

## Group 0 — Superseded (2026-08-12), see the strategy note above

Abandoned mid-dispatch when the user redirected to verbatim CSS/markup reuse instead of MUI theme approximation (no real work was lost — the killed dispatch had only just started). Not resumed under this shape; its intent is now folded into Group 1 (and future page-by-page groups) via literal CSS reuse instead.

<details>
<summary>Original scope (kept for reference, not being executed as written)</summary>

Depends on: nothing. Do first — every other visual-gap item below builds on this.

- [ ] Theme-level table styling: zebra-striped even rows (`#F3F8FF`), uppercase bold headers (`#021736`, weight 600), borderless cells with a single `2px solid #ddd` under the header row — matching `admin.css`'s `.table`/`.manage-page` rules. Apply via `MuiTableRow`/`MuiTableHead`/`MuiTableCell` `styleOverrides` in `theme.ts` so it applies everywhere automatically, not per-page.
- [ ] A shared `<StatusToggle>` component reproducing `.enablebutton`/`.disablebutton` (green/red translucent pill, single click, immediate effect) for anywhere a boolean active/inactive status is shown — replacing the current pattern of a static `Chip` that requires opening an Edit dialog to change.
- [ ] A shared circular icon-button treatment (`.delete-icon`'s 40x40 light-blue pill) for destructive row actions, applied via `IconButton` theme override or a small wrapper component.
- [ ] Decide and build (or explicitly defer) a shared `<AdminSearchBar>` pattern matching `.searchstyle`/`.searchinput` (uppercase label, rounded-left input merged into a pill search button) — every legacy page below that has a product/entity filter dropdown used this same pattern, and no new page has any search/filter control at all right now.

*Acceptance: the new admin shell's base table/status/icon-button/search visual language matches legacy closely enough that individual page fixes below only need to consume shared components, not reinvent styling.*

</details>

---

## Group 1 — Product ↔ measurement/feature linkage + reordering (the original reported gap) — DONE (2026-08-12)

Depends on: Group 0 (uses shared components where relevant). This is the highest-value functional gap — it affects both catalog administration and the real order-taking measurement/styling form's field order.

- [x] Add a `sequence_order` (or equivalent) integer column to `product_measurements` and `feature_products` — currently neither join table has any ordering concept at all (confirmed directly in `server/src/db/schema/catalog.ts`).
- [x] Extend `setProductMeasurements`/the equivalent feature-linkage service to accept and persist an explicit order (replace-and-reorder in one call, matching legacy's `PUT /product/updateMeasurements/:name`/`updateFeatures/:name` semantics).
- [x] Update `getProductMeasurements` (and the feature equivalent) to `ORDER BY sequence_order` — and update `<MeasurementForm>`/`<FeatureSelector>` (the order-builder's actual field-rendering components, Phase 5 Groups 5/6) to trust that order rather than whatever the query happens to return.
- [x] Build the actual admin UI: from `ProductsPage.tsx` (or a per-product detail view), a way to see, add, remove, and drag-reorder a product's linked measurements and features — reproducing `ManageProduct.jsx`'s draggable-chip dialog. This is currently **entirely absent** — `measurementsApi.ts` only has a read query, no mutation, and no screen anywhere calls one.

*Acceptance: an admin can open a product, see its full measurement and feature list, add/remove either, and drag to reorder — and that order is what a tailor actually sees when filling out a real order's measurement/styling form.* **Met.**

**What was built:**
- Schema: `sequence_order` integer column (default 0) added to both `product_measurements` and `feature_products` (migration `0007_tiny_tenebrous.sql`).
- Backend: `measurements.service.ts`'s existing `setProductMeasurements`/`getProductMeasurements` (the `PUT`/`GET /products/:id/measurements` routes already existed, just had no ordering) now persist array-index-as-`sequence_order` and `ORDER BY` it. New `features.service.ts#setProductFeatures` — the product-side counterpart to the existing feature-side `setFeatureProducts` — full-replaces *this product's* feature links in order, isolated from that same feature's links to other products (real isolation test, not assumed). New route `PUT /products/:productId/features`. `listFeatures` extended to preserve the product's configured order when filtered by `productId` (re-sorts after the necessary `inArray` batch fetch, since SQL `IN` doesn't preserve array order). Refactored `listFeatures` to route through an internal `listFeaturesInTx` helper — needed to avoid a real bug: `setProductFeatures` originally called the public `listFeatures` (which opens its own fresh `withTenant` transaction) from *inside* its own transaction, which would have read stale pre-write data due to transaction isolation. Caught and fixed before it shipped, not found by a test.
- Confirmed **zero frontend changes needed** in `<MeasurementForm>`/`<FeatureSelector>` themselves — neither has any client-side sorting, so they already render whatever order the query returns; fixing the backend's `ORDER BY` alone fixes the real order-taking form.
- Frontend: `ManageLinkedItemsDialog.tsx` (new, shared) — the drag-reorder chip dialog, extended beyond legacy's version to also add/remove links (legacy's dialog only reordered an already-fixed list; there was nowhere in the new *or* old system to actually link/unlink a measurement or feature to a product before this). `ProductsPage.tsx` rebuilt using this and legacy's verbatim markup (see the strategy note above Group 0) — real `App.css`/`admin.css` copied byte-for-byte into `client/src/styles/legacyAdmin/` (confirmed via `diff` against the legacy source), consumed as plain `<table>`/`<button className="custom-btn">` markup rather than MUI `Table`/`Button` wrappers (deliberately — MUI's own injected styles otherwise out-specificity a plain CSS class import, which caused a real bug caught during verification, below). Legacy's own outer `main-panel`/`Main-page-body-wrapper-complussry` chrome is *not* reused — `AppShell` (Phase 4) already provides equivalent layout (same 235px sidebar width), and nesting legacy's `width: calc(100% - 235px)` inside it would have double-offset the content.
- Tests: `test/measurements.routes.test.ts`/`test/features.routes.test.ts` gained real order-persistence + reorder + cross-product-isolation tests (207+ server tests, all passing). `ProductsPage.live.test.tsx` (new) drives the real add → reorder (via real `dragStart`/`dragEnter` events) → remove cycle against the real API and asserts the final persisted state via a direct API call, plus a features/styling add smoke test.

**Two real bugs found and fixed only by an actual live-browser check, not by the automated tests** (the tests happened to only ever exercise a brand-new product with nothing pre-linked, which masked both):
1. The "Manage Processes" button rendered with white text on no background (invisible) — using MUI's `<Button>` wrapper let its own injected styles override the `.custom-btn` CSS class. Fixed by using a plain `<Link>`/`<button>` with just the class, matching how "Add New Product" was already (correctly) built.
2. `ManageLinkedItemsDialog`'s `orderedIds` state is seeded once, on mount, from its `linkedIds` prop (a deliberate choice — an effect-based resync trips this project's `react-hooks/set-state-in-effect` lint rule). But `ProductMeasurementsDialog`/`ProductFeaturesDialog` were rendering it immediately, before their own RTK Query calls resolved — so for any product with real, pre-existing linked measurements (i.e. almost every real migrated product), the dialog permanently locked in an *empty* list on open, silently hiding all 12 real measurements on "jacket," for example. Fixed by gating rendering behind both queries actually resolving (a loading placeholder shows until then). Confirmed fixed via a real screenshot showing "jacket"'s real 12 measurements, correctly ordered, English/Thai labels intact.

**Verification performed:** `npx tsc -b` and `eslint` clean, both sides. Full server suite 223/223. Client catalog suite (5 files, 11 tests) and measurements/featureSelector/orders suites (5 files, 16 tests) all passing — confirmed the `sequence_order` migration didn't regress the order-builder wizard. Real Puppeteer screenshots taken and visually reviewed against the legacy reference screenshot the user provided (list view and the Manage Measurements dialog) — close visual match, not just "should look right." Found and soft-deleted 4 unrelated orphaned test-fixture products (`ShipTestProduct-*`/`ShipNoStepsProduct-*`, matching two retailer UUIDs already known from Phase 7 as Group 10 shipping-test debris) discovered incidentally while screenshotting — verified as synthetic before deleting, not assumed. Orphaned headless Chrome processes from an earlier, unrelated dispatch found and cleaned up during this session's process check.

---

## Group 2 — Real field/data gaps (schema-level, not just UI)

Depends on: nothing, parallel-safe with Groups 0/1/3.

- [ ] `processes.description` — legacy's Process create/edit form has a required Description field; the new `processes` table/`ProcessInput`/`ProcessesPage.tsx` has no description column at all. Add it (schema + service + UI).
- [ ] `retailers.phone` — legacy has a Phone field; new `retailers` table has none. Add it.
- [ ] Decide the `retailers.email` question: legacy has one contact email; new has `emailRecipients: string[]` (a notification distribution list — a different concept, not a 1:1 replacement). Confirm with the user whether a single contact-email field is still needed alongside the notification list, or whether the list fully supersedes it.
- [ ] Decide the "Additional" (Yes/No) flag question: legacy's style/group-style options have a boolean "is this an optional/extra-cost add-on" flag; the new unified `features`/`styles` model has no equivalent column, and it isn't a data-migration gap (Phase 7's ETL didn't need to touch it) — it's a live schema gap. Confirm whether this business concept is still needed; if so, add it to `styles`.

*Acceptance: every real, confirmed-lost data field either gets a home in the schema or is explicitly, deliberately decided against — not silently absent.*

---

## Group 3 — RBAC safety regression — DONE (2026-08-12)

Depends on: nothing. This is a real safety hole, not a UX nicety — fixed directly and first, ahead of the rest of this phase's sequencing.

- [x] Legacy protects the built-in `"administrator"` role and its users from being edited/deleted (`role.role_name === "administrator" ? "NA" : ...`, same pattern in `ManageUserLogin.jsx`). The new `roles.routes.ts`/`users.routes.ts` have no equivalent guard — any user holding `rbac.roles.manage`/`tenant.users.manage` can edit or delete the tenant's own seeded owner role/admin user, with no lockout-safety net. Decide the new-system-appropriate equivalent (e.g. a `isProtected`/`isSystemRole` flag rather than a hardcoded name match, since this rewrite is multi-tenant and each tenant gets its own seeded "Owner" role — matching by literal name across tenants would be fragile) and enforce it server-side (the real fix) plus reflect it in the UI (disable/hide the destructive actions, matching legacy's "NA").

*Acceptance: no tenant can lock itself out by deleting or de-permissioning its own last administrative role/user through the UI or a direct API call.* **Met.** Went with a schema flag (`roles.is_system`, migration `0006_wild_master_mold.sql`) rather than a name match — set on the seeded "Owner" role, with a backfill in `db:seed` for already-existing dev databases (verified directly against Postgres). Reworked the concept for multi-role support rather than porting legacy's single-admin-user check literally: `roles.service.ts`'s `softDeleteRole`/`removePermission` reject with `409 SYSTEM_ROLE_PROTECTED` on a system role; `users.service.ts` gained `assertNotLastActiveSystemRoleHolder`, wired into `softDeleteUser`, `updateUser` (on deactivation), and `unassignRole` — rejecting with `409 LAST_SYSTEM_ROLE_HOLDER` only when the action would leave zero active users holding a system role, not tied to one specific "admin" user. Frontend: `RolesPage.tsx` shows a "System" chip and disables Delete (with a tooltip) on system roles; `RolePermissionsEditor.tsx` disables un-checking an already-granted permission on a system role; `ConfirmDeleteDialog` (shared component, used by 6+ pages) gained an optional `errorMessage` prop so `UsersPage.tsx`/`RolesPage.tsx` now actually surface a rejected delete instead of silently leaving the dialog open (the prior pattern was fine when soft-delete genuinely had no failure mode — it now does). New tests: `test/roles.routes.test.ts` (system-role delete + permission-removal rejection), `test/users.routes.test.ts` (blocks deactivate/delete/unassign on the last active holder; confirms it un-blocks once a second holder exists). Full server suite: 221/221 passing. Client `tsc -b` clean, RBAC live tests (3 files, 5 tests) passing against the real migrated dev DB.

---

## Group 4 — Per-page functional gaps (search/filter, missing columns, image upload)

Depends on: Group 0 (search bar, table styling). Can run per-page in parallel once Group 0 lands.

- [ ] **Measurement Definitions** (`MeasurementDefinitionsPage.tsx`): add a product-filter dropdown + search (legacy: filter the whole list down to one product's linked measurements), and a "linked products" column/count so an admin can see at a glance what a measurement is used by.
- [ ] **Features & Styles** (`FeaturesPage.tsx`/`FeatureStylesEditor.tsx`): add search/filter (legacy had this separately for Pipings/GroupStyle/StyleOption, now unified — still needs a filter since the combined list is larger); add real image upload (currently a raw URL-paste text field with no file picker or preview, for both style and style-option images) reusing whatever upload pattern the rest of this codebase already established (check how order/product images are handled elsewhere before inventing a new pattern).
- [ ] **Retailers** (`RetailersPage.tsx`): add a logo thumbnail column to the table (currently no visual at all, even though a logo URL field exists); apply Group 0's `<StatusToggle>` for one-click enable/disable instead of requiring the Edit dialog.
- [ ] **Roles** (`RolesPage.tsx`): fix the N+1 per-row `useGetRoleQuery` fetch for permission counts — have the list endpoint return counts inline instead.
- [ ] **Users** (`UsersPage.tsx`): add a visible roles column to the table itself (currently requires opening Edit to see assigned roles).

*Acceptance: each page's real, confirmed functional gap from the comparison research is closed — not a redesign, a parity fix.*

---

## Group 5 — Two legacy pages that were never actually functional — DECIDED (2026-08-12)

- [x] **`ManageRetailStyle.jsx`** (per-retailer style overrides on a product): confirmed 100% static mock in legacy itself, no permission reserved, no schema table. **Decision: don't build.** No implementation work needed — nothing to do here beyond this record.
- [x] **`ManageRetailerPrice.jsx`** (per-retailer, per-fabric/category price overrides): confirmed static mock, never wired to a backend, but a permission key (`catalog.retailer_pricing.manage`) was already reserved in `server/src/db/seed/permissions.ts`. **Decision: don't build — remove the dead permission.** Delete the reserved-but-unbacked permission key from the seed catalog (and any tenant's already-seeded `permissions` table row + any role grants referencing it) as dead planning, not a real capability being cut.

*Acceptance met.*

---

## Group 6 — Custom Fittings / size-chart system — DECIDED (2026-08-12): build it — DONE (2026-08-14)

**Fleshed out (2026-08-13) from a 2-bullet sketch into a full task breakdown, at the user's direction — this group is also a hard prerequisite for `PHASE_9_TASKS.md` Group 3 (the order-builder's Manual Fit consumption). Land this group before starting that one.**

Depends on: nothing beyond catalog data already in place since Phase 2 (real products/measurement definitions). Internally sequenced 6.1 → 6.2 → (6.3 and 6.4 in parallel, both consume 6.2's API).

### 6.1 — Schema & migration
- [x] `product_fittings` (id, tenant_id, product_id, name, thai_name, timestamps, soft-delete) — one row per named fit (e.g. "Slim," "Regular"), mirrors `ManageMeasurementFits.jsx`'s per-product named-fit list.
- [x] `fitting_values` (id, product_fitting_id, measurement_definition_id, value numeric) — one row per (fitting, measurement) pair, unique constraint on that pair. `value` is the fitting's adjustment/delta for that measurement (matches legacy's `fitting_value`; consumed downstream as a pre-filled `adjustmentValue`, never `value` itself — a fit is an adjustment preset, not a replacement for the customer's real body measurement).
- [x] New permission key `catalog.fittings.manage` (module Catalog) added to `server/src/db/seed/permissions.ts`.

### 6.2 — Backend service/routes
- [x] `fittings.service.ts`: `listFittingsForProduct`, `createFitting`, `updateFitting` (name/thaiName), `softDeleteFitting`, `getFitting` (values joined with their measurement definitions, for the matrix editor), `setFittingValues` (full-replace per fitting — same full-replace convention Group 1 above already established for `setProductMeasurements`/`setProductFeatures`).
- [x] Routes, tenant-scoped via the existing `withTenant` pattern, all gated by `catalog.fittings.manage`: `GET /products/:productId/fittings`, `POST /products/:productId/fittings`, `GET /fittings/:id`, `PUT /fittings/:id`, `DELETE /fittings/:id`, `PUT /fittings/:id/values`. (GETs left ungated, matching `measurements.routes.ts`/`features.routes.ts`'s established real precedent — the prose above was imprecise on this point.)
- [x] Tests: full CRUD + full-replace-values round trip, tenant isolation (a fitting from tenant A never visible/editable via tenant B's session), soft-delete behavior — matching this codebase's existing service-test conventions.

### 6.3 — Frontend admin CRUD UI
- [x] Per-product fittings list screen (reachable from `ProductsPage.tsx`), matching legacy `ManageMeasurementFits.jsx`'s "eye icon — has any fits defined" affordance: list a product's real fittings, add/rename/delete.
- [x] Fit×measurement matrix editor screen (`ManageMeasurementFitsProduct.jsx` equivalent): rows = the product's real linked measurements in their configured order (reusing Group 1's `sequence_order`), one editable adjustment-value cell per measurement for the fitting currently being edited.
- [x] Verbatim CSS reuse per this phase's established strategy (see the cross-cutting note above Group 0) wherever `ManageMeasurementFits.jsx`/`ManageMeasurementFitsProduct.jsx` has real, reusable markup/classes.

**What was built (2026-08-14):** `client/src/features/catalog/fittingsApi.ts` (new RTK Query slice, mirroring `measurementDefinitionsApi.ts`'s/`measurementsApi.ts`'s established pattern; added a `"Fitting"` tag to `baseApi.ts`'s `tagTypes`). `client/src/features/catalog/FittingsPage.tsx` (per-product list, route `/catalog/products/:productId/fittings`) and `FittingValuesPage.tsx` (single-fitting matrix editor, route `/catalog/products/:productId/fittings/:fittingId`) — both new, wired into `AppRoutes.tsx`, reachable from a new "FITTINGS" column/"Manage" link added to `ProductsPage.tsx`'s existing per-row action area (same cell pattern as Measurements/Styling, per the dispatch's explicit instruction not to add a new top-level nav entry). `FittingValuesPage.tsx` is the deliberate transpose the dispatch called for: rows are the product's real linked measurements from `useProductMeasurementsQuery` (Group 1's `sequence_order`), not legacy's one-row-per-fitting layout. Added a small `getProduct` (`GET /products/:id`) query to `productsApi.ts` (route already existed server-side, just unused client-side) so the Fittings screens can show which product they belong to. Both new pages reuse `styles/legacyAdmin/{App.css,admin.css}` verbatim (`table`, `manage-btn`, `custom-btn`, `backButton`, `measurementfit`, `factory-user-from-NM`, etc.) rather than MUI-approximating, per this phase's established strategy — confirmed by direct Puppeteer screenshot comparison against the Products page these link from, not just code review. **One real visual bug found and fixed only by that live-browser check**: the new "Manage"/"Edit Values" navigation links used `.manage-btn` (which only resets `<button>` chrome) on an `<a>` element, so they rendered blue/underlined instead of matching the sibling Measurements/Styling `<button>`-based "Manage" cells — fixed with an inline `color`/`textDecoration` reset (documented inline in both files) rather than touching the byte-for-byte-copied CSS.

### 6.4 — Frontend: minimal "pre-fill from a standard fit" consumption, in the *current* (pre-Phase-9) `<MeasurementForm>`
- [x] A "Manual Fit" `<select>` added to the currently-shipped (Phase 5, 2-column) `<MeasurementForm>`: lists the product's real fittings; selecting one fetches its values and bulk-writes each matching measurement's `adjustmentValue` from the fitting's per-measurement `value`, in one `onChange` call.
- [x] Deliberately scoped as a minimal, real, **working** reference implementation, not the final UI — `PHASE_9_TASKS.md` Group 3 later rebuilds `<MeasurementForm>` into its 3-column/render-slot-integrated shape and re-hosts this same dropdown/data-fetching in that new layout, rather than building the "pick a fit → prefill" concept from scratch a second time.

**Correction against the original sketch above:** the currently-shipped `<MeasurementForm>` (verified by reading it, not assumed) has no "total" to recompute — it's a real Value/Adjustment 2-column form, no derived third column yet (that's `PHASE_9_TASKS.md` Group 3's job). So selecting a Manual Fit writes `adjustmentValue` only, via a `Map`-based immutable rebuild of the `value` array (existing entries/positions preserved, only the fitting's own measurements touched) — same single-`onChange`-call shape `handleFieldChange` already used per-keystroke, just applied to every matching measurement at once instead of one field. A measurement's real `value` (the customer's actual body measurement) is untouched by fit selection, confirmed by a dedicated test.

*Acceptance: an admin can define named fits with preset per-measurement adjustment values for a product, and a real order's measurement entry can be pre-filled from one, end-to-end, through the currently-shipped order builder — not just the admin-side CRUD in isolation. **Met and verified live**, not just by automated tests: a Puppeteer script drove the real dev server (`siam/client` on 5173 against real `siam/server` on 4545) through the actual flow — logged in as the seeded admin, created a product/measurement/fitting/value via the real API, opened `/catalog/products`, confirmed the new FITTINGS column, opened the Fittings list and the matrix editor and confirmed the real `3.25` value rendered, then drove the full `/orders/new` wizard (Retailer → Customer → Super Product → Measurements & Styling) against a real super product built around that same test product, selected the fitting from the "Manual Fit" dropdown, and confirmed the Adjustment field populated with `3.25` live in the real DOM — screenshotted at each step. This fully satisfies the group's original acceptance bar; `PHASE_9_TASKS.md` Group 3 later re-hosts the same working capability in the rebuilt form, it does not newly invent it.*

**Tests:** `client/src/features/catalog/FittingsPage.live.test.tsx` (add/rename/delete a fitting through the real UI, round-tripped against the real API), `client/src/features/catalog/FittingValuesPage.live.test.tsx` (matrix editor shows the product's real measurements in configured order, saved adjustment values round-trip through `GET /fittings/:id`), and two new tests added to the existing `client/src/features/measurements/MeasurementForm.live.test.tsx` (Manual Fit pre-fills `adjustmentValue` for every matching measurement in exactly one `onChange` call; a measurement's existing real `value` and an untouched measurement's own `adjustmentValue` both survive a fit selection unchanged). All new/changed client test files pass (10/10) against the real running server; `npx tsc -b` and `npm run lint` both clean in `client/`.

**Still open, not resolved by this breakdown (unchanged from the original sketch):** whether to backfill the 18 legacy `customFittings` documents as a one-time reference import. Not a blocker to any of 6.1–6.4 — flag separately if the user wants that backfill done.

---

## Sequencing summary

```
Group 0 (shared theme/components) ─────────────────────┐
                                                          ├─> Group 4 (per-page fixes, consume Group 0's components)
Group 1 (product measurement/feature linkage+reorder) ──┘   (parallel-safe with Group 1/2/3 otherwise)

Group 2 (schema field gaps) ── parallel-safe with everything
Group 3 (RBAC safety fix) ── parallel-safe with everything, small, worth doing early regardless of sequencing
Group 5, Group 6 ── decisions needed before any implementation, not blocking the groups above
```

**Decisions made (2026-08-12):** size charts — build for real (Group 6). Retailer pricing — don't build, remove the dead permission (Group 5). Sequencing confirmed: **3 (safety fix) → 0 (shared visual foundation) → 1 (the originally-reported gap) → 2 and 4 in parallel → 6 (size charts, new build) → 5 (small cleanup, whenever convenient).**

**Sequencing note added (2026-08-13):** Group 6 is now also an external prerequisite — `PHASE_9_TASKS.md` Group 3 (order-builder Manual Fit consumption) cannot start until Group 6 (all of 6.1–6.4) has landed. This doesn't change Group 6's position relative to the other Phase 8 groups above (still fine after 2/4, before 5), but if Phase 9 work is imminent, consider pulling Group 6 earlier in the actual dispatch order rather than leaving it last-but-one — that's a priority call for whoever is sequencing dispatches, not a re-decision of this doc's own internal ordering.

---

*Add notes below or inline above.*
