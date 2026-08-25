import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { RequirePermission } from "./RequirePermission";
import { LoginRoute } from "./LoginRoute";
import { AppShell } from "../components/shell/AppShell";
import { DashboardPage } from "./placeholders/DashboardPage";
import { FeaturesPage } from "../features/catalog/FeaturesPage";
import { FittingsPage } from "../features/catalog/FittingsPage";
import { FittingValuesPage } from "../features/catalog/FittingValuesPage";
import { MeasurementDefinitionsPage } from "../features/catalog/MeasurementDefinitionsPage";
import { ProcessesPage } from "../features/catalog/ProcessesPage";
import { ProductsPage } from "../features/catalog/ProductsPage";
import { SuperProductsPage } from "../features/catalog/SuperProductsPage";
import { CustomersPage } from "../features/customers/CustomersPage";
import { ExtraPaymentCategoriesPage } from "../features/extraPayments/ExtraPaymentCategoriesPage";
import { InvoicesPage } from "../features/invoices/InvoicesPage";
import { JobAssignmentPage } from "../features/manufacturing/JobAssignmentPage";
import { GroupOrderDetailPage } from "../features/orders/GroupOrderDetailPage";
import { GroupOrdersPage } from "../features/orders/GroupOrdersPage";
import { NewGroupOrderPage } from "../features/orders/NewGroupOrderPage";
import { OrderBuilderPage } from "../features/orders/OrderBuilderPage";
import { OrderDetailPage } from "../features/orders/OrderDetailPage";
import { OrderListPage } from "../features/orders/OrderListPage";
import { PayrollSettlementPage } from "../features/payroll/PayrollSettlementPage";
import { RetailerProfilePage } from "../features/retailers/RetailerProfilePage";
import { RetailersPage } from "../features/retailers/RetailersPage";
import { ShippingPage } from "../features/shipping/ShippingPage";
import { TailorsPage } from "../features/tailors/TailorsPage";
import { RolesPage } from "../features/rbac/RolesPage";
import { UsersPage } from "../features/rbac/UsersPage";

/**
 * `AppShell` is its own layout route nested inside `RequireAuth` rather than
 * folded into `RequireAuth` itself — keeps that guard's already-subtle
 * auth/redirect logic (see its doc comment) untouched, while still making
 * every protected route render inside the shell via this level's `<Outlet />`.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/retailers"
            element={
              <RequirePermission permission="retailers.manage">
                <RetailersPage />
              </RequirePermission>
            }
          />
          {/*
            Group 4 (PHASE_6_TASKS.md) Tailors admin: page-level
            RequirePermission, same reasoning as Retailers just above
            (see navConfig.ts's/TailorsPage.tsx's doc comments) despite
            GET /tailors itself only requiring `authenticate`.
          */}
          <Route
            path="/factory/tailors"
            element={
              <RequirePermission permission="factory.tailors.manage">
                <TailorsPage />
              </RequirePermission>
            }
          />
          {/*
            Group 5 (PHASE_6_TASKS.md) Customers admin: RequireAuth-only, no
            RequirePermission wrapper — same open-read/gated-write reasoning
            as the Group 1/2/3 catalog screens just below (GET /customers
            only requires `authenticate`, see navConfig.ts's/CustomersPage.tsx's
            doc comments). The page gates its own Add/Edit/Delete buttons
            internally via `useHasPermission("customers.manage")`.
          */}
          <Route path="/customers" element={<CustomersPage />} />
          {/*
            PHASE_10_TASKS.md Workstream E Group 4 (catalog admin route
            lockdown): these were previously RequireAuth-only (no
            RequirePermission wrapper) on the reasoning that the backend
            gates only their write endpoints (catalog.*.manage), not reads,
            per Decision 4 — reads genuinely do need to stay open server-side
            since the order-builder hits the identical GET routes. But
            Decision 4 also calls for a real frontend route-level gate on top
            of that (a Retailer-role session should never land on an admin
            catalog page at all, even though the underlying reads would
            technically succeed) — each page's own internal
            useHasPermission-gated Add/Edit/Delete buttons stay as
            defense-in-depth, unchanged.
          */}
          <Route
            path="/catalog/products"
            element={
              <RequirePermission permission="catalog.products.manage">
                <ProductsPage />
              </RequirePermission>
            }
          />
          {/*
            Group 6 (PHASE_8_TASKS.md) custom fittings/size-chart admin, now
            also route-gated per the Workstream E Group 4 note above —
            GET /products/:id/fittings and GET /fittings/:id themselves stay
            ungated server-side (see fittings.routes.ts), only writes require
            catalog.fittings.manage, still checked inside FittingsPage.tsx/
            FittingValuesPage.tsx for their own buttons.
          */}
          <Route
            path="/catalog/products/:productId/fittings"
            element={
              <RequirePermission permission="catalog.fittings.manage">
                <FittingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalog/products/:productId/fittings/:fittingId"
            element={
              <RequirePermission permission="catalog.fittings.manage">
                <FittingValuesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalog/processes"
            element={
              <RequirePermission permission="catalog.processes.manage">
                <ProcessesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalog/measurements"
            element={
              <RequirePermission permission="catalog.measurements.manage">
                <MeasurementDefinitionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalog/super-products"
            element={
              <RequirePermission permission="catalog.super_products.manage">
                <SuperProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/catalog/features"
            element={
              <RequirePermission permission="catalog.features.manage">
                <FeaturesPage />
              </RequirePermission>
            }
          />
          {/*
            Group 4 RBAC admin screens: unlike the catalog pages above,
            these ARE wrapped in RequirePermission at the route level — a
            deliberate page-level gate for this admin surface (see
            navConfig.ts's and UsersPage.tsx's/RolesPage.tsx's doc comments
            on why, despite GET /users and GET /roles themselves only
            requiring `authenticate` per their route files, same as the
            catalog resources).
          */}
          <Route
            path="/admin/users"
            element={
              <RequirePermission permission="tenant.users.manage">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequirePermission permission="rbac.roles.manage">
                <RolesPage />
              </RequirePermission>
            }
          />
          {/*
            Group 7 order-builder wizard: page-level RequirePermission, same
            reasoning as the Group 4 RBAC pages above (see
            navConfig.ts's/OrderBuilderPage.tsx's doc comments) — this page's
            only purpose is the orders.create-gated submit action, so there
            is no open-page/button-level-gate mode worth supporting here.
          */}
          <Route
            path="/orders/new"
            element={
              <RequirePermission permission="orders.create">
                <OrderBuilderPage />
              </RequirePermission>
            }
          />
          {/*
            Group 6 (PHASE_6_TASKS.md) order list/detail: page-level
            RequirePermission on `orders.view` — confirmed in
            `orders.routes.ts`, `GET /orders[/:id]` itself requires
            `orders.view` (unlike the open-read catalog/customers
            convention above), so this matches the backend's actual access
            rule rather than being a stricter-than-necessary UI choice (see
            navConfig.ts's doc comment on this entry). Declared as two
            static/dynamic routes ("/orders", "/orders/:id") alongside the
            existing "/orders/new" — React Router ranks the literal "new"
            segment over the ":id" param regardless of declaration order,
            so there's no ambiguity between "/orders/new" and "/orders/:id".
          */}
          <Route
            path="/orders"
            element={
              <RequirePermission permission="orders.view">
                <OrderListPage />
              </RequirePermission>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <RequirePermission permission="orders.view">
                <OrderDetailPage />
              </RequirePermission>
            }
          />
          {/*
            PHASE_10_TASKS.md Workstream E Group 6.3b — the admin edit-wizard
            entry point, gated on `orders.edit` (granted to Admin/Owner, not
            Retailer, per Group 5/`orders.edit.routes.test.ts`) rather than
            `orders.create` — re-hosts `OrderBuilderPage.tsx` itself (see its
            own doc comment on `isEditMode`) in an "edit an existing order"
            mode, not a separate page component. Declared after the static
            "/orders/:id" and "/orders/new" routes (same React Router
            static-over-param ranking already noted above), with its own
            dedicated ":id/edit" segment so it never collides with either.
          */}
          <Route
            path="/orders/:id/edit"
            element={
              <RequirePermission permission="orders.edit">
                <OrderBuilderPage />
              </RequirePermission>
            }
          />
          {/*
            Group Orders — closes the standing gap `navConfig.ts` used to
            flag ("`Group Orders` has no entry at all... a standing gap"):
            real backend support (`order_groups`, Phase 3) existed with zero
            frontend consumer until now. Same page-level gating shape as the
            plain Orders routes just above: list/detail on `orders.view`
            (confirmed in `order-groups.routes.ts`, matching `orders.routes.ts`'s
            own `GET /orders[/:id]` gate), create on `orders.group.create`
            (distinct key the seeded Retailer role holds directly, per
            `order-groups.routes.ts`'s `requirePermission` on `POST /order-groups`)
            rather than `orders.create` — see `NewGroupOrderPage.tsx`'s own doc
            comment for why this is a new page rather than a third
            `OrderBuilderPage.tsx` mode. Declared with the literal "new"
            segment ahead of ":id", same static-over-param reasoning already
            noted for "/orders/new" vs "/orders/:id" above (React Router
            ranks the literal segment regardless of declaration order, but
            this keeps the file's ordering self-documenting either way).
          */}
          <Route
            path="/group-orders/new"
            element={
              <RequirePermission permission="orders.group.create">
                <NewGroupOrderPage />
              </RequirePermission>
            }
          />
          <Route
            path="/group-orders"
            element={
              <RequirePermission permission="orders.view">
                <GroupOrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/group-orders/:id"
            element={
              <RequirePermission permission="orders.view">
                <GroupOrderDetailPage />
              </RequirePermission>
            }
          />
          {/*
            Group 7 (PHASE_6_TASKS.md) factory floor: page-level
            RequirePermission on `factory.jobs.assign` — the assign action is
            this screen's primary purpose (same reasoning as `/orders/new`
            above), and unlike the open-read catalog convention,
            `GET /manufacturing/components/:id` doesn't need its own
            permission check duplicated here since the whole page already
            requires a real factory-floor permission to reach. The
            complete-job action nested inside the same page is separately
            gated at the button level via `useHasPermission("factory.jobs.complete")`
            (see JobAssignmentPage.tsx) since assign/complete are distinct
            permission keys (`server/src/db/seed/permissions.ts`) an actor
            might hold independently.
          */}
          <Route
            path="/factory/assign"
            element={
              <RequirePermission permission="factory.jobs.assign">
                <JobAssignmentPage />
              </RequirePermission>
            }
          />
          {/*
            Group 7 Extra Payment Categories admin: page-level
            RequirePermission on `factory.extra_payments.manage` — the same
            key Group 0's `extraPaymentCategories.routes.ts` gates every
            write with (`GET` itself only requires `authenticate`, same
            open-read convention as the catalog resources, but this admin
            surface is gated at the page level like Retailers/Tailors/Users/
            Roles above rather than left open with button-level gating).
          */}
          <Route
            path="/factory/extra-payment-categories"
            element={
              <RequirePermission permission="factory.extra_payments.manage">
                <ExtraPaymentCategoriesPage />
              </RequirePermission>
            }
          />
          {/*
            Group 8 (PHASE_6_TASKS.md) payroll settlement: page-level
            RequirePermission on `factory.payroll.settle` — confirmed in
            `payroll.routes.ts`, both the new `GET .../unpaid-jobs` read and
            `POST .../settlements` require this key, and the page's sole
            purpose is that workflow (see navConfig.ts's doc comment on this
            entry). Recording a cash advance is gated separately at the
            button level inside `TailorsPage.tsx` via
            `factory.advance_payments.manage`, not routed here.
          */}
          <Route
            path="/factory/payroll"
            element={
              <RequirePermission permission="factory.payroll.settle">
                <PayrollSettlementPage />
              </RequirePermission>
            }
          />
          {/*
            Group 9 (PHASE_6_TASKS.md) invoicing: page-level
            RequirePermission on `invoices.view` — confirmed in
            `invoices.routes.ts`, `GET /invoices[/:id]` itself requires
            `invoices.view` (unlike the open-read catalog/customers
            convention above), so this matches the backend's actual access
            rule rather than being a stricter-than-necessary UI choice (see
            navConfig.ts's doc comment on this entry). Create/mark-paid are
            separately gated at the button level via
            `useHasPermission("invoices.manage")` inside `InvoicesPage.tsx`.
          */}
          <Route
            path="/invoices"
            element={
              <RequirePermission permission="invoices.view">
                <InvoicesPage />
              </RequirePermission>
            }
          />
          {/*
            Group 10 (PHASE_6_TASKS.md) shipping — last group of Phase 6:
            page-level RequirePermission on `shipping.manage`, confirmed in
            `shipping.routes.ts` as this module's only permission key,
            gating `GET /shipping-boxes[/:id]` identically to every write
            (see navConfig.ts's doc comment on this entry) — unlike every
            other financial/admin page above, there is no button-level split
            to add here at all.
          */}
          <Route
            path="/shipping"
            element={
              <RequirePermission permission="shipping.manage">
                <ShippingPage />
              </RequirePermission>
            }
          />
          {/*
            Retailer self-service "My Profile" — RequireAuth-only, no
            RequirePermission wrapper: this is identity-based (a
            `retailer_users`-linked session editing its OWN retailer, per
            `retailers.routes.ts`'s `assertCanUpdateRetailer`), not
            permission-based, so there is no single permission key to gate on
            here. `RetailerProfilePage.tsx` itself renders an explanatory
            message instead of the form when `me.retailerId` is null (a
            staff session reaching this route directly), matching
            navConfig.ts's `requiresRetailerLink` nav-hiding with a real
            in-page fallback for direct navigation.
          */}
          <Route path="/retailer/profile" element={<RetailerProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}
