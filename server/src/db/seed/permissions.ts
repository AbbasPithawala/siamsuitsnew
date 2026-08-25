/**
 * The full permission catalog (PHASE_1_TASKS.md Group 6). Enumerated from every module
 * in FUNCTIONALITY_OVERVIEW.md. This list is what Phase 2's route-guard middleware
 * checks against — treat additions/removals here as a deliberate review, not a quick
 * edit, since gaps are expensive to retrofit once routes are built against it.
 */
export const permissionCatalog: Array<{ key: string; module: string; description: string }> = [
  // Catalog
  { key: "catalog.products.manage", module: "Catalog", description: "Create/edit/deactivate base products" },
  { key: "catalog.super_products.manage", module: "Catalog", description: "Define super products and their component bundles" },
  { key: "catalog.features.manage", module: "Catalog", description: "Manage style/fabric/lining/monogram/piping features and their product links" },
  { key: "catalog.measurements.manage", module: "Catalog", description: "Manage measurement point definitions" },
  { key: "catalog.processes.manage", module: "Catalog", description: "Manage manufacturing processes and their pricing" },
  { key: "catalog.retailer_pricing.manage", module: "Catalog", description: "Manage per-retailer price overrides" },
  { key: "catalog.fittings.manage", module: "Catalog", description: "Manage per-product named fits and their preset measurement adjustments" },

  // Tenant & access administration
  { key: "tenant.settings.manage", module: "Tenant", description: "Manage tenant-level settings" },
  { key: "tenant.users.manage", module: "Tenant", description: "Create/edit/deactivate user logins" },
  { key: "rbac.roles.manage", module: "Access Control", description: "Create/edit roles and their permission sets" },
  { key: "rbac.permissions.view", module: "Access Control", description: "View the permission catalog" },

  // Retailers & customers
  { key: "retailers.manage", module: "Retailers", description: "Create/edit/deactivate retailer accounts" },
  { key: "customers.manage", module: "Retailers", description: "Create/edit customer records" },

  // Orders
  { key: "orders.create", module: "Orders", description: "Create new orders" },
  { key: "orders.edit", module: "Orders", description: "Edit existing orders" },
  { key: "orders.view", module: "Orders", description: "View/search orders" },
  { key: "orders.repeat", module: "Orders", description: "Repeat a prior order" },
  { key: "orders.rush", module: "Orders", description: "Flag an order as rush" },
  { key: "orders.group.create", module: "Orders", description: "Create group/bulk orders" },

  // Factory
  { key: "factory.tailors.manage", module: "Factory", description: "Manage the tailor roster and their process certifications" },
  { key: "factory.jobs.assign", module: "Factory", description: "Assign a manufacturing step to a tailor" },
  { key: "factory.jobs.complete", module: "Factory", description: "Mark a manufacturing step complete" },
  { key: "factory.extra_payments.manage", module: "Factory", description: "Create extra payment categories and records" },
  { key: "factory.extra_payments.approve", module: "Factory", description: "Approve pending extra payments" },
  { key: "factory.advance_payments.manage", module: "Factory", description: "Record/clear tailor cash advances" },
  { key: "factory.payroll.settle", module: "Factory", description: "Run a tailor payroll settlement" },

  // Invoicing & shipping
  { key: "invoices.manage", module: "Invoicing", description: "Create/edit retailer invoices" },
  { key: "invoices.view", module: "Invoicing", description: "View invoice history" },
  { key: "shipping.manage", module: "Shipping", description: "Pack and close shipping boxes" },
  { key: "shipping.view", module: "Shipping", description: "View shipping box status" },
];
