# Phase 6 — Port the Rest: Task Breakdown

*Companion to `REWRITE_ARCHITECTURE.md` and `PHASE_5_TASKS.md`. Scope: everything not yet ported — factory/manufacturing screens, invoicing, shipping, PDF generation, and the remaining admin screens (retailers, tailors, customers) that have had backend APIs since Phase 3 but never got a UI. Living document.*

---

## Scope boundary

**In Phase 6:** extra-payment-category management (a real blocking gap found while scoping this phase), invoicing and shipping (backend + UI, neither exists at all yet), an order list/detail view, the factory floor screen (job assignment/completion against Phase 3's manufacturing API), payroll UI (advances + settlement), and the three still-missing basic admin screens (retailers, tailors, customers) whose APIs have existed since Phase 3 Group 7 / Phase 5 but were never given a UI.

**Not in Phase 6:** final production data migration, secrets/security hardening, deploy pipeline changes — all Phase 7.

**Real test-fragility bug found and fixed mid-phase (2026-08-09), not just pollution.** While verifying Group 4/5, `SuperProductsPage.live.test.tsx` and `OrderBuilderPage.live.test.tsx` (both Phase 5) were failing with "found multiple elements" — initially indistinguishable from ordinary DB pollution, but root-caused to something more durable: their assertions searched the whole document for text like `"3 (Jacket, Pant, Vest)"` / `"3 component(s): Jacket, Pant, Vest"`, which is **not unique** — any other active super product built from the same 3 real products renders identically, and multiple test files across two phases independently picked "jacket, pant, vest" as their example combination. Fixed by scoping every such assertion to the specific fixture's own row/list-item (`within(rowFor())` / `.closest('[role="button"]')`) instead of bare `screen.findByText`. Also cleaned up a real backlog of ~140 orphaned test rows (customers, super products, products, measurement definitions) accumulated from Phase 5's interrupted dispatch attempts (the connection-drop incidents) that never got to run their `afterAll` cleanup. See project memory for the full mechanism — this is a pattern to watch for in any future live-test file that asserts on a summary/count string built from shared reference data rather than the fixture's own unique name.

**Gaps found while scoping, addressed here:**
- `extra_payment_categories` has zero CRUD anywhere — Phase 3 Group 5 built `createExtraPayment`/`approveExtraPayment` against a category, but nothing creates a category to reference. The feature has been non-functional end-to-end since Phase 3. Fixed in Group 0.
- No `invoices.service.ts`/`shipping.service.ts` exist at all — schema-only since Phase 1. Fixed in Groups 1/2.
- Retailers, Tailors, and Customers all got full CRUD APIs (Phase 3 Group 7, Phase 3 Group 1) but no admin screen was ever built for any of them — Phase 4's `/retailers` route is still just the placeholder from Group 5's guard-proof, never replaced with a real screen. Fixed in Groups 4/5.

**Phase 6 complete (2026-08-11).** All 11 groups (0-10) done and verified, closing every gap this phase's scope boundary identified at the outset: extra-payment categories are usable end-to-end for the first time (Group 0), invoicing and shipping exist as real backend services for the first time (Groups 1-2), order PDFs generate generically with zero suit/tuxedo special-casing (Group 3), and Retailers/Tailors/Customers/Orders/Factory floor/Payroll/Invoicing/Shipping all now have real admin UIs where Phase 4 left only placeholders or nothing at all (Groups 4-10). The capstone (Group 10) packed a real shipping box for a real retailer with real order item components entirely through the UI, and — the concrete point of building the feature at all — proved the long-flagged legacy bug is actually closed: `FUNCTIONALITY_OVERVIEW.md`'s shipping section describes orders shipping regardless of whether every manufacturing step was finished; Group 2 closed that server-side and Group 10 surfaces it as a real, specific UI rejection (not a silent allow, not a raw error) when it fires.

**Standing follow-ups still open across the phase, rolled up here (none block real use of any Phase 6 feature, and none compound into each other):**
- `ProcessesPage.live.test.tsx` (originally flagged Phase 5, reconfirmed by every group since including this one) reproducibly fails even in full isolation — a newly-created row's action buttons are genuinely missing from the DOM at assertion time. Real bug in `ProcessesPage.tsx`'s row-rendering, still not investigated.
- No `GET /jobs`/`GET /jobs/:id` endpoint anywhere in the API (flagged Group 7) — completing a manufacturing step assigned in an earlier page session isn't supported by `JobAssignmentPage.tsx`, since there is still no way to look an existing job up by id without a component id in hand.
- No date-range filter on the invoice list, and no regenerate/void path for a `Paid` invoice mistakenly marked paid (flagged Group 9) — both deliberately left out as "reasonable, not over-built" for that group's explicit scope.
- `listUnpaidCompletedJobs`'s per-job enrichment (flagged Group 8) doesn't include the parent order's own id/order number, so a settlement-screen operator can see which piece but not jump to the order it belongs to.
- No bulk/multi-component add on the shipping pack screen (flagged Group 10) — one component id per lookup, matching this phase's manual-lookup convention throughout; a real factory-floor operator packing a large box will do several individual lookups.

Phase 7 (final production data migration, secrets/security hardening, deploy pipeline changes) is next.

---

## Group 0 — Backend: Extra Payment Categories CRUD

Depends on: nothing. Parallel-safe with Groups 1, 2, 3.

- [ ] CRUD for `extra_payment_categories` (productId, featureId?, styleId?, processId, cost, name, thaiName), tenant-scoped, mirroring the `catalog-helpers.ts` tenant-ownership pattern. Permission: reuse `factory.extra_payments.manage` (the same key Phase 3 Group 5 used for creating an actual extra payment — creating the *category* template is the same管理 concern).
- [ ] Tests: tenant isolation, permission gates, and an integration test that creates a category then successfully creates a real `ExtraPayment` referencing it through Phase 3's existing `POST /jobs/:jobId/extra-payments` — proving the two halves of this feature (built two phases apart) actually connect.

*Acceptance: the extra-payments feature is usable end-to-end for the first time — a category can be created, then referenced by a real job's extra payment.*

---

## Group 1 — Backend: Invoicing

Depends on: nothing. Parallel-safe with Groups 0, 2, 3.

- [ ] `retailer_invoices` CRUD: create (retailerId, line items, discount, shipping charge — check exact schema in `server/src/db/schema/invoicing.ts`), list/get (tenant-scoped, filterable by retailer/status), update status (e.g. mark paid). Permission: existing seeded keys `invoices.manage` (writes) / `invoices.view` (reads — confirm this is meant to gate reads more strictly than the catalog convention, since invoices are financial data, not catalog data; document your choice).
- [ ] Tests: tenant isolation, permission gates, status transitions.

*Acceptance: a real invoice can be created against a real retailer, listed, and marked paid, entirely through the API.*

---

## Group 2 — Backend: Shipping

Depends on: nothing. Parallel-safe with Groups 0, 1, 3.

- [ ] `shipping_boxes` CRUD (create a box for a retailer, list/get, tenant-scoped) + `shipping_box_items` (add an `order_item_component` to a box by its id — same opaque-ID scanning principle as Phase 3's manufacturing assignment, not a legacy string-parsed code — remove an item, close the box). Permission: existing seeded key `shipping.manage`.
- [ ] Decide and document: should adding an item to a box check that the item's manufacturing is actually complete (fixing the legacy bug where orders could ship with incomplete jobs, per `FUNCTIONALITY_OVERVIEW.md`)? This is the concrete place to finally close that long-flagged gap — check each `order_item_component`'s `manufacturing_steps` are all `"complete"` before allowing it into a box, rejecting with a clear error otherwise.
- [ ] Tests: tenant isolation, permission gates, **the incomplete-manufacturing rejection** (this is the test that proves the legacy bug is actually fixed here, not just moved).

*Acceptance: a shipping box can be created and packed with real order item components entirely through the API, and — the important part — packing a component whose manufacturing isn't finished is rejected, not silently allowed.*

---

## Group 3 — Backend: Order PDF generation

Depends on: nothing new (uses existing order/manufacturing data). Parallel-safe with Groups 0, 1, 2.

- [ ] Rebuild the order/production-ticket PDF generation (legacy: `routes.order.js`'s `/createPdf`, using Puppeteer to render an HTML string to PDF) to walk `order_items → order_item_components` generically — **no suit/tuxedo special-casing**, since the whole point of this rewrite is that an order can have 1-3 arbitrary components. The legacy version hardcoded `if (item_name == 'suit')`/`'tuxedo'` branches for layout; this version iterates whatever components actually exist.
- [ ] QR codes embedded in the PDF encode the `order_item_component`'s own id directly (per `REWRITE_ARCHITECTURE.md`'s QR redesign, already the convention `manufacturing.service.ts`'s `assignNextStep` expects) — not a parsed composite string.
- [ ] Decide the endpoint shape: `POST /api/orders/:id/pdf` (generate, store, return path) matching the legacy's generate-then-upload flow, or synchronous generate-and-stream — your call, document it. S3 upload can reuse whatever pattern existing image-upload code in this codebase already established, or a simple local-file-path-on-the-order-record approach if S3 isn't wired up yet in `siam/server` (check — it may not be, since the ETL never touched S3). If S3 isn't set up, note that as a small follow-up rather than blocking this group on standing up cloud storage.
- [ ] Tests: generate a PDF for a real order with a 3-component super product and confirm it doesn't error and produces a real file; confirm the embedded QR data is the real component id (decode it in the test, don't just trust it was written).

*Acceptance: a PDF is generated for a real order with any number of components (1-3) with zero special-casing in the generation code, and its QR codes are immediately usable by Phase 3's `assignNextStep` if scanned.*

---

## Group 4 — Frontend: Retailers & Tailors admin

Depends on: Phase 4/5 (shell/routing). Sequential relative to Groups 5, 6, 7, 8, 9, 10 (shared `navConfig.ts`/`AppRoutes.tsx` files — same collision-avoidance rule established in Phase 5).

- [ ] Retailers: list/create/edit/deactivate, replacing Phase 4's placeholder at `/retailers`. Uses the existing `retailers.service.ts` API (Phase 3 Group 7).
- [ ] Tailors: list/create/edit/deactivate, **plus process-certification management** (add/remove which processes a tailor is certified for — `tailor_processes`, via Phase 3's `/tailors/:id/processes` endpoints). This is the screen that makes Phase 3's manufacturing assignment actually usable by someone who isn't editing the database by hand.

*Acceptance: a new retailer and a new tailor (certified for at least one real process) can be created entirely through the UI — no more direct-DB-insert test fixtures needed for either, closing a gap that's been worked around since Phase 3.*

---

## Group 5 — Frontend: Customers admin

Depends on: Phase 4/5. Sequential relative to Groups 4, 6, 7, 8, 9, 10.

- [ ] List/create/edit/deactivate customers, filterable by retailer. Uses the existing `customers.service.ts` API (Phase 3 Group 1). The order-builder wizard's inline quick-create (Phase 5 Group 7) stays as-is — this is the complementary full management view for browsing/editing existing customers outside the order flow.

*Acceptance: a customer created via this screen is immediately usable in the order-builder wizard, and vice versa (same underlying data, two entry points).*

---

## Group 6 — Frontend: Order list & detail — DONE (2026-08-10)

Depends on: Phase 5 (order-builder wizard exists). Sequential relative to Groups 4, 5, 7, 8, 9, 10.

- [x] Order list (filterable by retailer/customer/status), and a detail view showing the full nested structure (items → components → measurements → features → manufacturing step status per component — reuse `GET /api/orders/:id`'s existing nested response, already built in Phase 3).
- [x] A "Generate PDF" action on the detail view, calling Group 3's new endpoint, with a link/download once ready.
- [x] A "Repeat this order" entry point launching the order-builder wizard with `repeatOfOrderId` pre-filled — closing the gap Phase 5 Group 7 explicitly flagged as not-yet-built.
- [x] Surface each component's manufacturing progress visibly (e.g. "2 of 3 steps complete") — this is the first UI visibility into the Phase 3 manufacturing data that exists anywhere in the frontend so far.

*Acceptance: every order placed via Phase 5's wizard is now visible, viewable in full detail, and can produce a real PDF and a real repeat-order — closing the loop Phase 5 left open.* **Met.** `OrderListPage.tsx`/`OrderDetailPage.tsx` built, `orders.service.ts`'s `listOrders` extended with an aggregate `manufacturingStepsTotal`/`manufacturingStepsComplete` rollup, `OrderBuilderPage.tsx` reads `?repeatOfOrderId=` and pre-fills from the source order. tsc/lint clean both sides; server suite 200/200; client live tests for orders pass reliably in isolation (full-concurrency flakiness in unrelated files confirmed as contention noise, not regressions). Full live-browser flow verified end-to-end (place → list → detail → PDF → repeat), zero console/network errors. Two real bugs found and fixed during this group: a router-context regression in `OrderBuilderPage.live.test.tsx` from the new `useSearchParams()` usage, and a race between a synchronous `getByText` assertion and independent RTK Query lookups in the two new live-test files (fixed to `findByText`).

**Follow-ups flagged, not fixed here (out of scope for Group 6):**
- ~~`orderPdf.service.ts`'s Puppeteer `getBrowser()` singleton never reconnects after the underlying Chrome process dies~~ — **fixed 2026-08-11** (see note under Group 7; root cause was orphaned `chrome.exe` from Node processes exiting without closing the browser, not just missing reconnect logic).
- `ProcessesPage.live.test.tsx` (Phase 5 Group 1) reproducibly fails even in full isolation — a newly-created row's action buttons are genuinely missing from the DOM at assertion time. Real bug, not contention; needs its own investigation.

---

## Group 7 — Frontend: Factory floor (job assignment/completion + extra payment categories) — DONE (2026-08-11)

Depends on: Phase 3 (manufacturing API), Group 0 (extra payment categories API). Sequential relative to Groups 4, 5, 6, 8, 9, 10.

- [x] A job-assignment screen: pick or scan an `order_item_component` (by id — real camera/QR scanning is a nice-to-have if practical in the time available, a manual id/lookup input is an acceptable fallback, document which you built), pick a certified tailor, call `assignNextStep`. Show the resulting job's cost.
- [x] A job-completion screen/action: mark an assigned job complete via `completeStep`, with the option to attach an extra payment (from Group 0's now-real categories, filtered to ones matching the component's product/process) before completing — reflecting the legacy's actual workflow (extra payments offered at job-completion time) but now properly validated server-side (Phase 3 Group 5's real style-selection check, not the legacy's half-enforced version).
- [x] Extra Payment Categories admin screen (Group 0's CRUD): list/create/edit, tied to a product/process/optional feature+style.
- [x] Clear sequential-dependency UX: reflect the backend's real `STEP_LOCKED`/`STEP_IN_PROGRESS`/`NO_STEP_AVAILABLE` errors (Phase 3 Group 4) as clear messages, not raw failures.

*Acceptance: a real manufacturing step is assigned to a real certified tailor, an extra payment is attached using a real category, and the step is completed — entirely through the UI, for the first time since Phase 3 built the underlying service with no UI at all.* **Met.** Manual id/lookup input was built (documented choice, not camera/QR scanning — no scanning library exists anywhere in this rewrite's client; the legacy `AssignItem.jsx`'s `qr-scanner`/`html5-qrcode` deps were never carried over). One screen, `JobAssignmentPage.tsx` at `/factory/assign`, covers both assign and completion: look up a component by id, see its per-process step chips, assign its next step to a tailor filtered to real `tailor_processes` certifications (`CertifiedTailorSelect.tsx`), see the resulting job's cost breakdown, optionally check off matching extra payment categories, then complete — mirroring the legacy's own assign-then-immediately-offer-completion flow. `ExtraPaymentCategoriesPage.tsx` at `/factory/extra-payment-categories` is Group 0's CRUD admin screen (product/process/optional feature+style, cascading style dropdown reusing `catalog/featuresApi.ts`'s data). `manufacturingErrors.ts` maps every relevant backend error code (`STEP_LOCKED`/`STEP_IN_PROGRESS`/`NO_STEP_AVAILABLE`/`NOT_CERTIFIED`/`CATEGORY_PROCESS_MISMATCH`/`STYLE_NOT_SELECTED`/etc.) to a specific message; blocked states are also surfaced proactively (before any assign attempt) via the new read endpoint below, including which tailor currently holds an in-progress step.

**Small backend addition (flagged per the boundary rule allowing a genuinely small missing read endpoint):** the API had no way to look up a single `order_item_component`'s status — only `GET /orders/:id`'s full nested tree. Filtering the tailor picker down to certified tailors, and showing a blocked-state message *before* attempting an assignment, both need to know the component's next-assignable process ahead of time. Added `GET /manufacturing/components/:componentId` (`manufacturing.service.ts`'s new `getComponentDetail`/`previewAssignableStep`, `authenticate`-only, same open-read convention as `GET /tailors`), reusing the existing `requireOwnedComponent` ownership walk. 2 new server tests cover it (component detail through a full assign→complete→assign→complete cycle, including both `STEP_LOCKED` and `STEP_IN_PROGRESS` previews, plus a 404 case).

**Verification performed:**
- `npx tsc -b` clean on both `server` and `client`.
- `npx eslint` clean on all new/changed files, both sides.
- Server suite: 202/202 passing (200 pre-existing + 2 new `getComponentDetail` tests).
- Client live integration tests (real server + real Postgres, no mocks): new `JobAssignmentPage.live.test.tsx` (2 tests — full assign→attach real extra payment→complete flow with real DB verification of the created `extra_payments` row, plus a fresh-lookup `STEP_LOCKED` blocked-message test with certified-tailor-filtering assertions) and `ExtraPaymentCategoriesPage.live.test.tsx` (1 test — create/edit/delete through the UI) all pass. Full client suite run: 55/57 passing, the 2 failures are `MeasurementDefinitionsPage.live.test.tsx` timing out under full-concurrency contention — confirmed pre-existing and unrelated by re-running that file alone (2/2 pass in isolation), same class of flakiness Group 6 already documented.
- Real-browser verification (Puppeteer driving the actual Vite dev server against the actual API dev server, not jsdom): logged in, navigated both new nav entries, created/deleted a category through the real UI, looked up a bogus component id and confirmed the mapped "No order item component was found with that ID." message (not raw JSON), then built real fixtures via the API and drove the full assign → certified-tailor-only dropdown → job-cost display → extra-payment checkbox → complete flow through real Chromium, ending in "Job completed with 1 extra payment(s). Total pay: THB 90.00." with zero page errors and zero unexpected failed requests. Screenshots reviewed directly.
- All fixtures cleaned up and verified via direct Postgres queries (zero active leftover rows across every table touched, in both the automated-test runs and the manual browser-verification run); zero orphaned jobs/extra_payments. Orphaned `chrome.exe` processes from this session's Puppeteer runs and the full test-suite run were killed; both dev servers started for verification were stopped afterward; scratch files removed.

**Follow-ups flagged, not fixed here (out of scope for Group 7):**
- Completing a step that was assigned in an *earlier* session (not the current page load) isn't supported — there is still no `GET /jobs`/`GET /jobs/:id` endpoint anywhere in the API, so a fresh lookup can show that a step is `STEP_IN_PROGRESS` (and which tailor holds it, from `manufacturingSteps[].tailorId`) but can't offer a "complete" action for it without a job id to act on. A real gap for any factory-floor operator who scans a piece a tailor already started work on in a previous session; would need a small job-lookup endpoint (by manufacturing step id, or a `GET /jobs?status=assigned` list) to close.
- ~~The pre-existing Puppeteer orphaned-`chrome.exe`-process issue Group 6 flagged reproduced again during this group's full-suite run~~ — **fixed 2026-08-11**, out of band from either group's dispatch. Root cause: `getBrowser()`'s reused-instance check (Group 6's fix) only handled *reconnecting* after a dead browser was detected on next use — it did nothing about the Node process itself exiting (test worker teardown, dev-server restart) without ever calling `closePdfBrowser()`, which is what actually orphaned the spawned `chrome.exe` since Puppeteer's own cleanup only runs on a graceful exit path it's wired into. Added a `process.once("exit", ...)` handler in `orderPdf.service.ts` that kills the tracked Chrome pid directly whenever the Node process exits, regardless of whether `closePdfBrowser()` was called. Verified no orphaned `chrome.exe`/stray `node.exe` processes remain; `tsc -b` clean.

---

## Group 8 — Frontend: Payroll — DONE (2026-08-11)

Depends on: Phase 3 (payroll API), Group 7 (jobs need to exist/be completed to be payable). Sequential relative to Groups 4, 5, 6, 7, 9, 10.

- [x] Record a tailor cash advance (`POST /tailors/:id/advances`).
- [x] Settlement screen: pick a tailor, see their unpaid completed jobs (needs a "list unpaid jobs for a tailor" read — check whether one exists on `manufacturing.service.ts`/`payroll.service.ts`; if not, this is a small additional backend read endpoint to add here, not a new phase), select which to settle, enter rent/manual bill/deducted advance, submit, and display the server-computed `subTotal`/`totalPay` breakdown (never client-computed, per Phase 3's design).

*Acceptance: a real settlement is created against real completed jobs with a real advance deduction, and the resulting `worker_advance_payments.cleared`/`extra_payments.paid` flags (made live in Phase 3) are visibly reflected somewhere in the UI (e.g. the tailor's detail view shows a cleared advance).* **Met.** Confirmed the read gap the task anticipated: `payroll.service.ts` only had `createAdvancePayment`/`createSettlement`/`getSettlement` — no way to list a tailor's settleable jobs. Added `listUnpaidCompletedJobs` + `GET /tailors/:id/unpaid-jobs` (`factory.payroll.settle`-gated, same permission `POST .../settlements` already uses — financial per-job pay data, so gated like `invoices.routes.ts`'s reads rather than left open like the catalog convention). A job is "unpaid completed" when its `manufacturing_steps` row is `complete` (not a column on `jobs` itself) and `jobs.paid` is still `false`; the response is enriched with just enough of each job's process/component/product plus a preview of its approved-and-unpaid extra payments to render a selection row — the preview is display-only, never fed back into any client-side total.

`AdvancePayment`/`UnpaidJob`/`SettlementDetail` types and `createAdvancePayment`/`listUnpaidJobs`/`createSettlement`/`getSettlement` RTK Query endpoints live in `client/src/features/payroll/payrollApi.ts`. Recording an advance was added to `TailorsPage.tsx` (Group 4) rather than a standalone screen — a new "Advance balance" column plus a per-row "Record advance" icon button (gated on `factory.advance_payments.manage`, independent of the page's own `factory.tailors.manage` route gate) opens a small dialog calling `createAdvancePayment`; the mutation invalidates the `Tailor` tag so the balance updates immediately everywhere it's shown. `PayrollSettlementPage.tsx` at `/factory/payroll` (nav entry + route gated on `factory.payroll.settle`) is the settlement screen: pick a tailor, see unpaid completed jobs in a checkbox table, enter rent/manual bill/deducted advance, submit, then read back the just-created settlement via `getSettlement` and render its confirmation — `subTotal`/`deductedAdvance`/`rent`/`manualBill`/`totalPay` all come straight off the server response, never summed client-side, including no running-subtotal preview while selecting jobs (this codebase's hard financial-totals rule, honored even for a pre-submit preview).

**Small backend addition beyond the one the task explicitly pre-authorized (flagged here, not silently added):** the acceptance criterion itself requires the settlement confirmation to visibly show which advances got cleared/which extra payments got paid, and no existing read returned that. Rather than adding a second new endpoint, enriched the *existing* `GET /tailors/:id/settlements/:id` (`getSettlement`) to also return `extraPayments` (the settled jobs' now-`paid` extra payment rows) and `clearedAdvances` (`worker_advance_payments` rows pointing at this settlement via `paymentSettlementId`) — both trivial reads off FKs `createSettlement` already sets, no new route/permission. Documented as a second, smaller touch than the pre-authorized `unpaid-jobs` read, not bundled silently into it.

**Verification performed:**
- `npx tsc -b` clean on both `server` and `client`.
- `npx eslint` clean on all new/changed files, both sides.
- Server suite: 205/205 passing (202 pre-existing + 3 new `payroll.service.test.ts` cases: `listUnpaidCompletedJobs`'s enrichment/complete-vs-assigned-vs-paid filtering, its tailor-not-found 404, and tenant isolation against a second tenant's tailor; plus inline assertions added to two existing settlement tests covering `getSettlement`'s new `extraPayments`/`clearedAdvances` fields).
- Client live integration tests (real server + real Postgres, no mocks): new `PayrollSettlementPage.live.test.tsx` (1 test — full tailor-select → unpaid-job-select → settle-with-advance-deduction flow, asserting the exact server-computed `subTotal`/`totalPay` breakdown and both the paid-extra-payment and cleared-advance chips) and a new case added to `TailorsPage.live.test.tsx` (records a real advance through the UI, confirmed via a real `GET /tailors/:id` fetch). Both pass. Full client suite re-run: 21/24 files passing standalone; the 3 files that fail under full-concurrency (`MeasurementDefinitionsPage`, `OrderBuilderPage`, `ProcessesPage` live tests) were re-run individually and all pass in isolation — confirmed pre-existing contention flakiness already documented by Groups 6/7, not a regression from this group's changes.
- Real-browser verification (Puppeteer driving the actual Vite dev server against the actual API dev server, not jsdom): logged in, recorded a real cash advance from the Tailors screen (balance column updated live), navigated to the new Payroll Settlement screen, selected the tailor, selected a real completed job, entered rent/manual bill/a deducted-advance amount, submitted, and confirmed the rendered breakdown matched the expected server computation exactly (subTotal THB 101.00 = 80 process fee + 12 styling + 9 approved extra payment; totalPay THB 51.00 = 101 + 7 rent + 3 manual bill − 60 deducted advance), with the paid extra payment and "THB 60.00 — Cleared" advance chip both visible, and the settled job gone from the unpaid-jobs list on the same page. Zero console errors, zero failed/error network requests. Two real bugs found and fixed during this verification: (1) a stray click-target mismatch — the record-advance action is an icon-only `IconButton` with no visible text, so a text-content-based click helper couldn't find it; fixed by clicking on `aria-label` instead; (2) the job-selection checkbox intermittently failed to register a click immediately after selecting the tailor from the MUI `Select` — root-caused to the `Select` popover's backdrop still completing its ~225ms exit transition and intercepting the click; fixed in the verification script by waiting for `.MuiBackdrop-root`/`[role="listbox"]` to fully clear before interacting with the table (this is a test-script timing issue, not an app bug — the live RTL test using `@testing-library/user-event` never hit it, since jsdom has no real paint/transition timing).
- All fixtures cleaned up and verified via direct Postgres queries: zero orphaned `jobs`/`worker_advance_payments`/`payment_settlements`/`orders` rows from any verification run, and every catalog/tailor/retailer/customer/super-product fixture properly soft-deleted (`deletedAt` set), matching this codebase's established live-test cleanup convention. (One unrelated, already-soft-deleted orphaned retailer from an earlier, different session's manual browser check — dated the day before this group's work — was found during cleanup and deliberately left untouched rather than swept up under a broad `LIKE` pattern.) Both dev servers started for this verification were stopped afterward; no orphaned Puppeteer `chrome.exe` processes remained (confirmed via command-line inspection — none referenced `--headless`); all scratch scripts/screenshots removed.

**Follow-ups flagged, not fixed here (out of scope for Group 8):**
- `listUnpaidCompletedJobs`'s per-job enrichment includes the component's `orderItemId` but not the parent order's own id/order number — a settlement-screen operator can see *which piece* but not jump to the order it belongs to. Would need one more join (`orderItems → orders`) if that turns out to matter in practice; left out to keep the read's scope to exactly what the settlement UI needed.
- Same job-lookup-by-id gap Group 7 already flagged (no `GET /jobs/:id`) means there's still no way to look up a single job's settlement eligibility outside the per-tailor list — not a new gap, just still open.

---

## Group 9 — Frontend: Invoicing — DONE (2026-08-11)

Depends on: Group 1 (invoicing API). Sequential relative to Groups 4, 5, 6, 7, 8, 10.

- [x] List/create retailer invoices, mark paid. Reasonable, not over-built — this is the least structurally novel screen in this phase.

*Acceptance: a real invoice can be created against a real retailer, listed, and marked paid, entirely through the UI.* **Met.** One screen, `InvoicesPage.tsx` at `/invoices` (nav entry + route gated on `invoices.view`, confirmed verbatim in `server/src/db/seed/permissions.ts` alongside `invoices.manage` — both keys already existed from Group 1, not guessed), covers list/create/mark-paid against Group 1's `invoices.service.ts`/`invoices.routes.ts` API unchanged (no backend edits this group). Reads are page-level-gated on `invoices.view` (`RequirePermission` in `AppRoutes.tsx`, same as `OrderListPage.tsx`/`PayrollSettlementPage.tsx` — financial-data reads, not the open-read catalog convention); Create/Mark-Paid are separately button-gated on `invoices.manage` via `useHasPermission`, so a view-only actor sees the list without the mutating controls, mirroring `TailorsPage.tsx`'s advance-button split.

The create dialog: pick an active retailer, a repeatable line-item list (description/quantity/unit price, add/remove rows), optional discount and shipping charge — sent as exactly `createInvoiceSchema`'s shape (`invoices.routes.ts`). Every dollar amount shown anywhere on this page — each line's `amount`, the invoice `total`, the view-dialog's line/discount/shipping/total breakdown — comes straight off the server response; the page never sums `quantity * unitPrice` itself, per this codebase's hard financial-totals rule. A per-row "View" action opens a read-only dialog with the full line-item/discount/shipping/total breakdown (reusing `listInvoices`' already-returned `lineItems`, no extra `getInvoice` call needed). "Mark paid" is a single icon-button status transition (`PATCH /invoices/:id/status`), shown only on `Unpaid` rows for actors with `invoices.manage`.

`client/src/features/invoices/invoicesApi.ts` holds the `Invoice`/`InvoiceLineItem`/`CreateInvoiceInput` types and `listInvoices`/`createInvoice`/`updateInvoiceStatus` RTK Query endpoints (new `"Invoice"` tag added to `baseApi.ts`'s `tagTypes`). `client/src/features/invoices/testSupport/invoiceDbCleanup.ts` is a new live-test-only helper (`hardDeleteInvoices`/`countInvoicesByIds`) — `invoices.routes.ts` has no DELETE endpoint (invoices are only ever created/status-transitioned per Group 1's scope, `retailer_invoices.deleted_at` is unused), so unlike retailers/tailors/etc. cleanup can't go through a soft-delete API call and needs a direct hard delete; nothing else references `retailer_invoices.id` as a foreign key, so this is a plain single-table delete, simpler than `payrollDbCleanup.ts`'s multi-table FK walk.

**Verification performed:**
- `npx tsc -b` clean on both `server` and `client` (no backend changes this group).
- `npx eslint` clean on all new/changed client files.
- Server suite: 205/205 passing, unchanged (no backend edits).
- Client live integration test (real server + real Postgres, no mocks): new `InvoicesPage.live.test.tsx` (1 test — create a real invoice for a real retailer with two real line items plus a discount and shipping charge, confirm the list shows the server-computed total `THB 23.00` (subTotal 25 − discount 5 + shipping 3) and `Unpaid` status, open the view dialog and confirm the per-line server-computed amounts, mark paid through the UI, confirm the status chip flips to `Paid` and the mark-paid button disappears, then re-fetch the invoice directly via the API to confirm the server agrees) passes. One real test-authoring bug caught and fixed during this group: `getByLabelText("Retailer")`/`("Description")` etc. initially failed because required MUI fields render an asterisk into the label's `textContent`, breaking `getByLabelText`'s default exact match — fixed by switching to the `/^Retailer/`-style regex matcher this codebase's other live tests (e.g. `RetailersPage.live.test.tsx`) already use for required fields; a second fix scoped an ambiguous `THB 5.00` text match (the "Alterations" line's unit price integer-formats without decimals while its amount doesn't, so this particular fixture wasn't actually ambiguous once diagnosed) down to `within(row)`. Full client suite re-run: 24/25 files passing; the 1 failing file (`MeasurementDefinitionsPage.live.test.tsx`, 2 tests) is the same pre-existing full-concurrency contention flakiness Groups 6/7/8 already documented — re-ran in isolation and both tests pass (42s, 2/2).
- Real-browser verification (Puppeteer driving the actual Vite dev server against the actual API dev server, not jsdom): logged in, navigated to `/invoices`, created a real invoice for a real retailer with the same two-line-item/discount/shipping fixture as the live test, confirmed the list row showed `THB 23.00` and `Unpaid` (cross-checked against a direct `GET /invoices` call), clicked "Mark paid" and confirmed the row flipped to `Paid` in the UI and via a direct `GET /invoices/:id` call, with zero browser console errors and zero failed/4xx+/5xx network requests observed throughout.
- All fixtures cleaned up and verified via direct Postgres queries: zero orphaned `retailer_invoices` rows across every run this group (unit test + manual browser verification), every retailer fixture properly soft-deleted (`deletedAt` set). Orphaned headless `chrome.exe` processes from the Puppeteer verification run (2 found via command-line inspection for `--headless`, not caught by `browser.close()` in this run) were killed; both dev servers started for this verification were stopped afterward; no stray `node.exe` beyond what was already running before this session; all scratch scripts/logs removed.

**Follow-ups flagged, not fixed here (out of scope for Group 9):**
- No filter-by-date-range on the invoice list (legacy `CreateInvoice.jsx` had start/end date filters over orders) — Group 1's `listInvoices` only filters by `retailerId`/`status`, and the rewritten invoice model isn't order-linked the way the legacy one was, so there's no obvious date field to filter on yet beyond `createdAt`; left out as not part of this group's explicit scope.
- No "regenerate/void" path for a `Paid` invoice mistakenly marked paid — `updateInvoiceStatus` only supports `Unpaid`→`Paid` in practice (both directions are technically allowed by `INVOICE_STATUSES`, but the UI only ever offers the forward transition, matching the "reasonable, not over-built" framing of this group).

---

## Group 10 — Frontend: Shipping — DONE (2026-08-11)

Depends on: Group 2 (shipping API). Sequential relative to Groups 4, 5, 6, 7, 8, 9. Last group in the phase.

- [x] Create a shipping box for a retailer, add order item components to it (by id/scan, same pattern as Group 7's job assignment), close the box. Surface Group 2's incomplete-manufacturing rejection clearly if it fires.

*Acceptance: a shipping box can be created and packed with real order item components entirely through the UI, and packing a component whose manufacturing isn't finished is rejected with a clear message, not silently allowed or a raw error.* **Met.** One screen, `ShippingPage.tsx` at `/shipping` (nav entry + route gated on `shipping.manage`, confirmed verbatim in `server/src/db/seed/permissions.ts` as this module's only permission key — unlike every other Phase 6 admin/financial page, `shipping.manage` gates `GET /shipping-boxes[/:id]` identically to every write per `shipping.routes.ts`'s own doc comment, so there's no button-level view/manage split to add, unlike Invoices/Payroll/Tailors), covers the whole workflow against Group 2's `shipping.service.ts`/`shipping.routes.ts` API unchanged (no backend edits this group): create a box for a retailer, pack it by component id, close it.

Packing reuses Group 7's manual-id-lookup pattern verbatim — literally the same `GET /manufacturing/components/:id` read (`useGetComponentDetailQuery`, already built for `JobAssignmentPage.tsx`) previews a typed component id's manufacturing-step status (slot label, product, per-process step chips) before attempting to pack it, mirroring the assign screen's lookup-then-act shape rather than reinventing a second implementation of "is this fully manufactured." The preview is a UX nicety only — the real gate is server-side (`addItemToBox`'s `requireCompleteManufacturing`), so "Add to box" always round-trips to the server regardless of what the preview showed, and a genuine `MANUFACTURING_INCOMPLETE` rejection renders the server's own message directly (e.g. "Component `<id>` cannot be shipped — manufacturing step(s) not complete: Lining (pending)") rather than a generic string — `shippingErrors.ts` deliberately leaves that one code out of its code-to-copy table (documented in that file) because the server's own message is already more specific than any fixed string would be, unlike the other five shipping error codes it does map to friendly copy (`SHIPPING_BOX_NOT_FOUND`, `BOX_CLOSED`, `BOX_ALREADY_CLOSED`, `COMPONENT_NOT_FOUND`, `DUPLICATE_SHIPPING_BOX_ITEM`, `SHIPPING_BOX_ITEM_NOT_FOUND`).

`client/src/features/shipping/shippingApi.ts` holds the `ShippingBox`/`ShippingBoxDetail`/`ShippingBoxItem` types and `listShippingBoxes`/`getShippingBox`/`createShippingBox`/`addShippingBoxItem`/`removeShippingBoxItem`/`closeShippingBox` RTK Query endpoints (new `"ShippingBox"` tag added to `baseApi.ts`'s `tagTypes`). The list view (retailer/status filter) and the pack/close detail panel live on one page rather than separate list/detail routes, matching `JobAssignmentPage.tsx`'s "one page per continuous workflow" shape rather than `OrderListPage`/`OrderDetailPage`'s two-route shape — creating a box immediately opens its detail panel so create → pack → close is one uninterrupted flow.

**Verification performed:**
- `npx tsc -b` clean on both `server` and `client` (no backend changes this group).
- `npx eslint` clean on all new/changed client files.
- Server suite: 205/205 passing, unchanged (no backend edits).
- Client live integration test (real server + real Postgres, no mocks): new `ShippingPage.live.test.tsx` (1 test — create a real box for a real retailer, pack a real order item component whose single manufacturing step was actually completed via a real assign→complete cycle, attempt to pack a second component whose step was left `pending` and confirm the real `MANUFACTURING_INCOMPLETE` rejection renders with the real process name and status, confirm the packed count stayed at 1, then close the box and confirm via a direct `GET /shipping-boxes/:id` call that `isClosed` is true and exactly one item is packed) passes. One real test-scoping bug caught and fixed during this group, the same class already documented in this file's opening note: asserting the closed-status chip's text ("Closed") without scoping matched *two* elements once the mutation's tag invalidation flipped both the list row's own status chip and the detail panel's chip to the same text — fixed by adding a `data-testid="shipping-box-detail-panel"` to the detail panel and scoping that one assertion with `within(panel)`. Full client suite re-run: 24/26 files passing; the 2 failing files (`MeasurementDefinitionsPage.live.test.tsx`, `ProcessesPage.live.test.tsx`) are the same pre-existing issues Groups 6-9 already documented (full-concurrency contention for the former — re-ran alone, 2/2 pass; the real pre-existing Phase 5 bug for the latter — re-ran alone, reproduces identically) — confirmed not regressions from this group.
- Real-browser verification (Puppeteer driving the actual Vite dev server against the actual API dev server, not jsdom): logged in, clicked the "Shipping" sidebar nav link through to `/shipping`, created a real box for a real retailer through the create dialog, looked up a component whose manufacturing was genuinely complete and confirmed the preview said "Manufacturing complete — ready to pack.", packed it and confirmed "Packed components (1)", looked up a second component left with a `pending` step and confirmed the preview proactively warned "Manufacturing isn't complete for this component yet (1 step(s) pending)", clicked "Add to box" anyway and confirmed the real rejection rendered verbatim — "Component `<id>` cannot be shipped — manufacturing step(s) not complete: `<process name>` (pending)" — as a plain red alert, not a raw JSON/network-error dump, with the packed count still showing 1 (not silently added), then closed the box and confirmed the status chip flipped to "Closed" with the packing controls disappearing, cross-checked against a direct `GET /shipping-boxes/:id` call (`isClosed: true`, one item). Screenshots reviewed directly. Zero unexpected console errors or failed network requests — the one console-logged 409 observed was Chrome's own network-tab noise for the intentional rejection response being tested, not an application bug.
- All fixtures cleaned up and verified via direct Postgres queries: zero orphaned `shipping_boxes`/`shipping_box_items`/`orders` rows and zero active (non-soft-deleted) leftover `retailers`/`customers`/`tailors`/`products`/`processes`/`super_products` rows across every run (automated live test + manual browser verification, including two earlier browser-verification attempts that hit a real Puppeteer-interaction issue before the working script — MUI's `Select`/button handlers need real dispatched mouse events, not a plain JS `.click()`, to open/fire correctly, the same class of issue Group 8's own verification script hit with click timing — whose fixtures were swept up by a follow-up cleanup pass keyed on the shared `Verify Ship`/`SHIP-VSH-` naming pattern rather than left as debris). The dev servers started for this verification were confirmed stopped afterward, along with all their child processes; the one still-running headless `chrome.exe` found at that point was the server's own PDF-generation `getBrowser()` singleton (tied to the dev server process, killed automatically by Group 7's `process.once("exit")` fix when that process was stopped) — not an orphan from this group's own Puppeteer script, which always closed its own browser cleanly in a `finally` block; all scratch scripts/screenshots removed.

**Small design note, not a backend change:** unlike every other Phase 6 group, no backend read/write gap was found or needed here — Group 2's shipping API already covered everything this UI needed (create/list/get a box, add/remove/close), including the one thing that mattered most (the incomplete-manufacturing rejection), so this is the only frontend group in the phase with zero backend touches.

**Follow-ups flagged, not fixed here (out of scope for Group 10):**
- No bulk/multi-component add — packing is one component id at a time, matching the manual-lookup convention this whole phase established (no scanning library exists anywhere in this client); a real factory-floor operator packing a large box will do several individual lookups. Acceptable per the task's own explicit "manual lookup input" framing, but worth a batch-add revisit if this screen sees heavy real use.
- The standing gaps already flagged by earlier groups and still open are rolled up in the "Phase 6 complete" note above rather than repeated here.

---

## Sequencing summary

```
Group 0 (extra payment categories) ──┐
Group 1 (invoicing backend) ─────────┼── all parallel-safe (independent backend work)
Group 2 (shipping backend) ──────────┤
Group 3 (PDF generation) ────────────┘

Group 4 (retailers/tailors admin) → Group 5 (customers admin) → Group 6 (order list/detail)
  → Group 7 (factory floor, needs Group 0) → Group 8 (payroll, needs Group 7's jobs)
  → Group 9 (invoicing UI, needs Group 1) → Group 10 (shipping UI, needs Group 2)

All frontend groups are sequential relative to each other (shared navConfig.ts/AppRoutes.tsx
collision risk, same rule established in Phase 5) even though their backend dependencies
would otherwise allow more parallelism.
```

---

*Add notes below or inline above.*
