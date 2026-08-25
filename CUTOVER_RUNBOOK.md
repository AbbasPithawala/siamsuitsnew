# Cutover Runbook — Legacy (siamClient/siamServer) → New (client/server)

*Companion to `PHASE_7_TASKS.md` Group 3. This is a plan, not a log of actions taken — nothing in this document has been executed. Cutover and old-stack retirement require the user's explicit go-ahead on timing; nothing here runs automatically or was run by an agent.*

---

## 0. What "cutover" means here

Today, real traffic is served by the legacy stack: `siamClient`/`siamServer`, deployed via `.github/workflows/deploy.yml` on every push to `master`, running on a Hostinger VPS under PM2, backed by MongoDB. Cutover means: the new stack (`client`/`server`, Postgres-backed) starts serving real users instead, and the legacy stack stops taking new writes.

This is a real production migration for a live business — real retailers, tailors, and customers depend on the system working. Treat every step below as something to execute deliberately and verifiably, not as a formality.

---

## 1. Open decision this runbook cannot make on its own

**How long do legacy and new coexist, if at all, and what happens to orders placed in that window?**

Two realistic shapes, both viable — pick one before scheduling a cutover date:

- **Hard cutover.** Pick a maintenance window (e.g. a slow evening), take the legacy site offline, run the final delta-sync (§4), bring the new stack up, done. Simplest to reason about; requires accepting a short downtime window and stopping all order-taking during it (retailers/tailors need to know in advance).
- **Soft/parallel cutover.** Both stacks run for a period; new orders are only accepted on the new system starting from a cutover instant, but the legacy system stays reachable (read-only) for staff to reference historical data/finish in-flight paperwork. Avoids downtime but requires deciding *now, explicitly*, what "in-flight" means for an order that's mid-manufacturing at the cutover instant — does its remaining manufacturing/payroll work happen on the new system (requires that order to exist there, i.e. it must be part of the final delta-sync) or finish out on the legacy system (requires keeping legacy alive and writable a while longer, which reopens the "which system is the source of truth" question).

Recommendation if asked: hard cutover during the business's actual lowest-order-volume window, given the order/manufacturing/payroll data model changed structurally (Phase 7 Group 0's ETL had to invent super-products, backfill catalog features, and fuzzy-match styles that didn't exist verbatim in the new catalog) — running both systems as simultaneous sources of truth risks the two diverging in ways that are hard to reconcile later. But this is a business-continuity call, not a technical one — confirm with the user before scheduling anything.

---

## 2. Pre-flight checklist

Do not schedule a cutover date until every item here is checked, for real, not assumed:

- [ ] **Data migration verified.** `PHASE_7_TASKS.md` Group 0's ETL has been run and independently verified (done once already, 2026-08-12 — real Postgres row counts cross-checked against legacy Mongo counts, a real order traced end-to-end through the live API). Before actual cutover, **re-run `npm run etl:production` one more time** as a fresh dry run and confirm the skip/migrated counts are stable (no new categories of failure introduced by any schema/code changes made since 2026-08-12) — don't reuse the old run's numbers as if they're still current.
- [ ] **Both new-gap decisions from Group 0 resolved** (or explicitly accepted as permanently deferred): customer-level saved measurement profiles (149/624 customers) and per-order free-text tailoring notes (353/551 item instances) currently have no schema destination and are not migrated. If the business needs either at go-live, that's a schema addition to scope and build *before* cutover, not after — retrofitting it post-cutover means re-deriving the data from a legacy system that may no longer be running.
- [ ] **Tailor credentials plan decided.** The 11 migrated tailors got random, non-communicated passwords during the ETL (logged once to a console that likely wasn't captured). Before go-live, use the existing Tailors admin screen (`PATCH /tailors/:id`) to set a real, known password for each, and have a plan to communicate it to them (in person, printed slip, etc. — this is a real operational task, not a technical one).
- [ ] **Retailer login accounts.** Group 0 deliberately did not create `users` rows for retailer staff (only the `retailers` business-entity rows) — decide whether/how existing retailers get real logins on the new system before cutover, since without this they cannot use the new system at all on day one.
- [ ] **Seed admin password changed.** `SEED_ADMIN_PASSWORD = "ChangeMe123!"` is a known placeholder — must be changed before the new stack is reachable by anyone outside the dev team.
- [ ] **Critical-path tests green.** `npm test` passing in both `server` and `client` (Phase 7 Group 1 confirmed the money-critical path — order → manufacturing → payroll → invoice — has real, non-mocked coverage; re-confirm this is still true at cutover time, not just as of Group 1's audit date).
- [ ] **Deploy pipeline's secrets provisioned.** `.github/workflows/deploy-v2.yml` (Group 2) needs `DATABASE_URL`, `JWT_SECRET`, `VITE_API_BASE_URL`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `SSH_PRIVATE_KEY`, `DEPLOY_SERVICE_RESTART_CMD`, `HEALTH_CHECK_URL` set as real GitHub repo secrets (full description of each in that workflow file's header comment). This depends on the deploy-target decision (§3) actually being made.
- [ ] **Deploy target decided and provisioned.** As of Group 2, this was intentionally left undecided (same Hostinger VPS alongside legacy, or somewhere new) — a real host needs to exist, be reachable via SSH, and have Postgres + Node available before `deploy-v2.yml` can run for real.
- [ ] **Legacy Hostinger SSH key / GitHub PAT rotation.** The user is handling this personally, separately (deliberately deferred per `PHASE_7_TASKS.md`'s scope-boundary note) — confirm it's actually been done, or at minimum that its deferral doesn't block cutover (e.g. if the new deploy target is a *different* host than the one those leaked credentials grant access to, this may not be a hard blocker for cutover specifically, only for the legacy pipeline's own security — but confirm this reasoning holds before relying on it).
- [ ] **A real backup of the legacy MongoDB exists**, taken close to (ideally right before) the final delta-sync, independent of this migration effort — standard practice before any irreversible-feeling step, even though nothing in this migration writes to Mongo.

---

## 3. Deploy-target decision (blocks §2's pipeline-secrets item)

Not yet decided as of this runbook's writing (2026-08-12) — flagged during Group 2's scoping and left open. Whoever schedules the actual cutover date needs to resolve this first: same Hostinger VPS as legacy (simplest, reuses existing infra, but means the leaked-credential rotation in §2 becomes more directly relevant since the same host is involved) or a new host entirely (cleaner separation, but is new infrastructure to provision and secure from scratch before cutover can even be dry-run end-to-end).

---

## 4. Cutover sequence

Only begin this section once every §2 checkbox is real, not assumed, and a date/window has been chosen per §1.

1. **Announce the maintenance window** to retailers/tailors/staff in advance if doing a hard cutover (§1) — give them real notice, not a surprise outage.
2. **Freeze legacy writes.** Stop new order creation / manufacturing assignment / settlement on the legacy system at the agreed instant (how depends on the legacy app's structure — may require literally taking it offline, or a feature-flag/maintenance-mode if one exists; check `siamServer` for any such mechanism before assuming one needs to be built).
3. **Run the final delta-sync**: `npm run etl:production` one more time. Because the ETL resolves records via natural keys (order number, username, etc. — not a `legacy_mongo_id` column, per this rewrite's standing decision) and is designed to be idempotent, re-running it against the now-frozen legacy data should pick up only what changed since the 2026-08-12 run (new orders, new jobs, new settlements) without duplicating anything already migrated. **Verify this assumption for real** on this specific run — compare before/after row counts the same way Group 0 did, don't assume idempotency held just because it was designed to.
4. **Spot-check the delta.** Pick 2-3 of the newest migrated orders (created in the window between the last full ETL run and this final one) and trace them through the live new-stack API the same way Group 0's verification did — confirm they reconstruct correctly, not just that row counts moved.
5. **Deploy the new stack** via `deploy-v2.yml` (`workflow_dispatch`, manually triggered) to the now-decided, now-provisioned real target. Confirm the health-check step passes.
6. **Smoke-test the live new stack** as a real user would: log in, view an order, assign a manufacturing step, generate a PDF — the same category of check every phase of this rewrite has used, now against the actual production deploy target rather than a dev environment.
7. **Point real traffic at the new stack** (DNS change, load-balancer switch, or whatever the actual infrastructure requires — depends on the deploy-target decision in §3).
8. **Announce it's live.** Retailers/tailors resume normal use, now against the new system.
9. **Watch closely** for the first real business day — errors, unexpected 500s, anything that looks like the ETL missed an edge case that only shows up under real live usage rather than the verification passes already done.

---

## 5. Rollback plan

If something goes seriously wrong after step 7 (data corruption, a critical feature broken, real business impact):

1. **Point traffic back at the legacy stack** (reverse whatever mechanism §4 step 7 used). The legacy Mongo was never written to by anything in this migration, so it's exactly as it was at the freeze point in step 2 — reverting is safe from a data-loss perspective for anything that happened *before* the freeze.
2. **Any orders/data created on the new stack between go-live and rollback are at risk of being lost from the legacy system's perspective** — they exist in the new Postgres but have no legacy Mongo equivalent. Before resuming legacy-only operation, these need to be manually re-entered into legacy (small number, since this should be caught quickly if it's caught at all) or the rollback decision needs to account for accepting that gap.
3. **Do not delete or truncate anything on the new Postgres during a rollback** — keep it as-is for post-mortem investigation into what went wrong before attempting cutover again.
4. **Root-cause before re-attempting** — don't retry the same cutover sequence hoping the problem was transient without understanding what happened first.

---

## 6. Retire old stack (final step, only once the new stack is confirmed stable)

Do not do this immediately after cutover — give it real time (the user's call on how long) to confirm the new stack is actually stable under real usage before doing anything irreversible to the legacy system.

- [ ] Stop the legacy PM2 process on the Hostinger VPS.
- [ ] Disable (don't immediately delete) `.github/workflows/deploy.yml` — comment out its `push` trigger or remove it, so an accidental push to `master` can't resurrect the legacy deploy.
- [ ] **Archive, don't delete, the legacy MongoDB** — keep a real backup/export accessible for a meaningful retention period (the user's call on how long) in case something the migration missed surfaces later. This project's own experience during Phases 2-7 (repeatedly going back to the live legacy Mongo to verify ETL correctness, resolve ambiguous-looking migrated rows, and confirm data gaps) is a direct demonstration of why the source shouldn't be deleted the moment cutover completes.
- [ ] Archive, don't delete, the legacy repo code (`siamClient`/`siamServer` directories) — still valuable as reference for as long as any behavior question about "what did the old system actually do here" might come up.
- [ ] Only after all of the above and real confidence the new stack is the sole system of record: revisit whether to actually delete anything, on a separate, explicit, later decision — not part of this runbook.

---

*This document describes a plan. Execution requires the user's explicit go-ahead on timing for every step in §4 onward.*
