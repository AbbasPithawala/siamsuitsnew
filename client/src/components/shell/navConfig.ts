// Named barrel import — see LoginPage.tsx's comment on this project's Vite
// dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import {
  AdminPanelSettings as AdminIcon,
  Dashboard as DashboardIcon,
  Factory as FactoryIcon,
  Inventory2 as OrdersIcon,
  ReceiptLong as InvoiceIcon,
  LocalShipping as ShippingIcon,
  Person as ProfileIcon,
} from "@mui/icons-material";
import type { SvgIconComponent } from "@mui/icons-material";

export interface NavEntry {
  label: string;
  path: string;
  /** Omit for links that should be visible to every authenticated user (e.g. Dashboard). */
  permission?: string;
  /** True only for a `retailer_users`-linked session (`me.retailerId` non-null) — hidden
   * from staff entirely, independent of `permission` (a staff session could hold every
   * permission and still never see this, since it's identity-based, not grant-based). */
  requiresRetailerLink?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: SvgIconComponent;
  entries: NavEntry[];
}

/**
 * Grouped into accordion sections mirroring legacy `siamClient/src/components/superAdmin/
 * sidebar/Sidebar.jsx`'s actual functional grouping (Admin/Factory/Orders/Invoice/Shipping)
 * — not its literal per-page labels, since this rewrite consolidated several legacy pages
 * into fewer, more general ones (see PHASE_5_TASKS.md Group 3, PHASE_8_TASKS.md). `Dashboard`
 * is its own single-entry group here (a deliberate departure from legacy, which rendered it
 * as a standalone link outside every accordion) — real-user feedback was that a lone
 * top-level link, visually inconsistent with every other section, read as broken/out of
 * place; a one-entry accordion is a small, harmless list-item, not a special case.
 *
 * One open item intentionally not resolved here (flagged during Phase 8 grouping design,
 * see PHASE_8_TASKS.md's sidebar-grouping notes for the fuller reasoning):
 * - `Customers` is folded into `Orders` — legacy's *retailer*-facing sidebar
 *   (`RetailerSidebar.jsx`) gave it its own top-level group, but that sidebar no longer
 *   exists as a separate thing (Phase 4 unified staff/retailer into one `AppShell`), and
 *   there's no other natural home for it in the staff-side grouping this list is based on.
 *
 * `Group Orders`/`New Group Order` (below, under `orders`) closed what used to be a standing
 * gap here: real backend support existed since Phase 3 (`order_groups`) with zero frontend
 * page ever built for it. `client/src/features/orders/orderGroupsApi.ts`/`GroupOrdersPage.tsx`/
 * `GroupOrderDetailPage.tsx`/`NewGroupOrderPage.tsx` close it. `orders.view` gates the list/
 * detail (same key the plain Orders list uses); `orders.group.create` gates the create entry
 * point, distinct from `orders.create` (the seeded Retailer role holds both).
 *
 * Icons are MUI equivalents of legacy's FontAwesome section-header glyphs (this client has
 * no FontAwesome dependency, per the established `@mui/icons-material` convention) — a
 * deliberate, disclosed substitution; nothing else about the accordion structure/CSS is
 * approximated (see `AppShell.tsx`'s doc comment on the verbatim `sidebar.css` reuse).
 */
export const navGroups: NavGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
    entries: [{ label: "Dashboard", path: "/dashboard" }],
  },
  {
    key: "admin",
    label: "Admin",
    icon: AdminIcon,
    entries: [
      { label: "Retailers", path: "/retailers", permission: "retailers.manage" },
      { label: "Users", path: "/admin/users", permission: "tenant.users.manage" },
      { label: "Roles", path: "/admin/roles", permission: "rbac.roles.manage" },
      { label: "Products", path: "/catalog/products", permission: "catalog.products.manage" },
      { label: "Processes", path: "/catalog/processes", permission: "catalog.processes.manage" },
      { label: "Measurement Definitions", path: "/catalog/measurements", permission: "catalog.measurements.manage" },
      { label: "Super Products", path: "/catalog/super-products", permission: "catalog.super_products.manage" },
      { label: "Features & Styles", path: "/catalog/features", permission: "catalog.features.manage" },
    ],
  },
  {
    key: "factory",
    label: "Factory",
    icon: FactoryIcon,
    entries: [
      { label: "Tailors", path: "/factory/tailors", permission: "factory.tailors.manage" },
      { label: "Assign / Complete Job", path: "/factory/assign", permission: "factory.jobs.assign" },
      { label: "Extra Payment Categories", path: "/factory/extra-payment-categories", permission: "factory.extra_payments.manage" },
      { label: "Extra Payments Approval", path: "/factory/extra-payments", permission: "factory.extra_payments.approve" },
      { label: "Payroll Settlement", path: "/factory/payroll", permission: "factory.payroll.settle" },
      { label: "Worker Payment History", path: "/factory/payment-history", permission: "factory.payroll.settle" },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    icon: OrdersIcon,
    entries: [
      { label: "Orders", path: "/orders", permission: "orders.view" },
      { label: "New Order", path: "/orders/new", permission: "orders.create" },
      { label: "Group Orders", path: "/group-orders", permission: "orders.view" },
      { label: "New Group Order", path: "/group-orders/new", permission: "orders.group.create" },
      { label: "Customers", path: "/customers" },
    ],
  },
  {
    key: "invoice",
    label: "Invoice",
    icon: InvoiceIcon,
    entries: [
      { label: "Invoices", path: "/invoices", permission: "invoices.view" },
      { label: "Invoice Settings", path: "/invoice-settings", permission: "invoices.view" },
    ],
  },
  {
    key: "shipping",
    label: "Shipping",
    icon: ShippingIcon,
    entries: [{ label: "Shipping", path: "/shipping", permission: "shipping.manage" }],
  },
  {
    key: "profile",
    label: "Profile",
    icon: ProfileIcon,
    entries: [{ label: "Profile Settings", path: "/retailer/profile", requiresRetailerLink: true }],
  },
];

/** Flat view of every entry across every group — `RequireAuth`/tests that need the full list without the grouping structure. */
export const navEntries: NavEntry[] = navGroups.flatMap((group) => group.entries);
