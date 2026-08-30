import { relations } from "drizzle-orm";
import { tenants, users, retailers, retailerUsers, tailors, permissions, roles, rolePermissions, userRoles } from "./tenancy";
import {
  products,
  superProducts,
  superProductComponents,
  processes,
  productProcesses,
  measurementDefinitions,
  productMeasurements,
  features,
  featureProducts,
  styles,
  styleOptions,
  productFittings,
  fittingValues,
} from "./catalog";
import {
  customers,
  customerMeasurementProfiles,
  customerMeasurementProfileValues,
  orderGroups,
  orders,
  orderItems,
  orderItemComponents,
  orderItemComponentMeasurements,
  orderItemComponentFeatures,
} from "./orders";
import {
  tailorProcesses,
  manufacturingSteps,
  jobs,
  extraPaymentCategories,
  extraPayments,
  workerAdvancePayments,
  paymentSettlements,
  paymentSettlementJobs,
} from "./manufacturing";
import { retailerInvoices, retailerInvoiceOrders, orderInvoices, orderInvoiceLines, shippingBoxes, shippingBoxItems } from "./invoicing";

/**
 * All cross-file relations live in this one module (rather than alongside each table) to
 * avoid circular imports — e.g. tenancy.ts would otherwise need to import from every
 * downstream file just to declare "a tenant has many products/orders/...".
 */

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  retailers: many(retailers),
  tailors: many(tailors),
  roles: many(roles),
  products: many(products),
  superProducts: many(superProducts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  retailerLinks: many(retailerUsers),
  roleLinks: many(userRoles),
}));

export const retailersRelations = relations(retailers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [retailers.tenantId], references: [tenants.id] }),
  userLinks: many(retailerUsers),
  customers: many(customers),
  orders: many(orders),
}));

export const retailerUsersRelations = relations(retailerUsers, ({ one }) => ({
  retailer: one(retailers, { fields: [retailerUsers.retailerId], references: [retailers.id] }),
  user: one(users, { fields: [retailerUsers.userId], references: [users.id] }),
}));

export const tailorsRelations = relations(tailors, ({ one, many }) => ({
  tenant: one(tenants, { fields: [tailors.tenantId], references: [tenants.id] }),
  processLinks: many(tailorProcesses),
  jobs: many(jobs),
  advancePayments: many(workerAdvancePayments),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  permissionLinks: many(rolePermissions),
  userLinks: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roleLinks: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  processLinks: many(productProcesses),
  measurementLinks: many(productMeasurements),
  featureLinks: many(featureProducts),
  superProductLinks: many(superProductComponents),
  fittings: many(productFittings),
}));

export const superProductsRelations = relations(superProducts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [superProducts.tenantId], references: [tenants.id] }),
  components: many(superProductComponents),
  orderItems: many(orderItems),
}));

export const superProductComponentsRelations = relations(superProductComponents, ({ one }) => ({
  superProduct: one(superProducts, { fields: [superProductComponents.superProductId], references: [superProducts.id] }),
  product: one(products, { fields: [superProductComponents.productId], references: [products.id] }),
}));

export const processesRelations = relations(processes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [processes.tenantId], references: [tenants.id] }),
  productLinks: many(productProcesses),
  tailorLinks: many(tailorProcesses),
}));

export const productProcessesRelations = relations(productProcesses, ({ one }) => ({
  product: one(products, { fields: [productProcesses.productId], references: [products.id] }),
  process: one(processes, { fields: [productProcesses.processId], references: [processes.id] }),
}));

export const tailorProcessesRelations = relations(tailorProcesses, ({ one }) => ({
  tailor: one(tailors, { fields: [tailorProcesses.tailorId], references: [tailors.id] }),
  process: one(processes, { fields: [tailorProcesses.processId], references: [processes.id] }),
}));

export const measurementDefinitionsRelations = relations(measurementDefinitions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [measurementDefinitions.tenantId], references: [tenants.id] }),
  productLinks: many(productMeasurements),
}));

export const productMeasurementsRelations = relations(productMeasurements, ({ one }) => ({
  product: one(products, { fields: [productMeasurements.productId], references: [products.id] }),
  measurementDefinition: one(measurementDefinitions, {
    fields: [productMeasurements.measurementDefinitionId],
    references: [measurementDefinitions.id],
  }),
}));

export const featuresRelations = relations(features, ({ one, many }) => ({
  tenant: one(tenants, { fields: [features.tenantId], references: [tenants.id] }),
  process: one(processes, { fields: [features.processId], references: [processes.id] }),
  productLinks: many(featureProducts),
  styles: many(styles),
}));

export const featureProductsRelations = relations(featureProducts, ({ one }) => ({
  feature: one(features, { fields: [featureProducts.featureId], references: [features.id] }),
  product: one(products, { fields: [featureProducts.productId], references: [products.id] }),
}));

export const stylesRelations = relations(styles, ({ one, many }) => ({
  feature: one(features, { fields: [styles.featureId], references: [features.id] }),
  options: many(styleOptions),
}));

export const styleOptionsRelations = relations(styleOptions, ({ one }) => ({
  style: one(styles, { fields: [styleOptions.styleId], references: [styles.id] }),
}));

export const productFittingsRelations = relations(productFittings, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productFittings.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [productFittings.productId], references: [products.id] }),
  values: many(fittingValues),
}));

export const fittingValuesRelations = relations(fittingValues, ({ one }) => ({
  productFitting: one(productFittings, { fields: [fittingValues.productFittingId], references: [productFittings.id] }),
  measurementDefinition: one(measurementDefinitions, {
    fields: [fittingValues.measurementDefinitionId],
    references: [measurementDefinitions.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  retailer: one(retailers, { fields: [customers.retailerId], references: [retailers.id] }),
  orders: many(orders),
  measurementProfiles: many(customerMeasurementProfiles),
}));

export const customerMeasurementProfilesRelations = relations(customerMeasurementProfiles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customerMeasurementProfiles.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [customerMeasurementProfiles.customerId], references: [customers.id] }),
  product: one(products, { fields: [customerMeasurementProfiles.productId], references: [products.id] }),
  values: many(customerMeasurementProfileValues),
}));

export const customerMeasurementProfileValuesRelations = relations(customerMeasurementProfileValues, ({ one }) => ({
  profile: one(customerMeasurementProfiles, {
    fields: [customerMeasurementProfileValues.profileId],
    references: [customerMeasurementProfiles.id],
  }),
  measurementDefinition: one(measurementDefinitions, {
    fields: [customerMeasurementProfileValues.measurementDefinitionId],
    references: [measurementDefinitions.id],
  }),
}));

export const orderGroupsRelations = relations(orderGroups, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orderGroups.tenantId], references: [tenants.id] }),
  retailer: one(retailers, { fields: [orderGroups.retailerId], references: [retailers.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orders.tenantId], references: [tenants.id] }),
  retailer: one(retailers, { fields: [orders.retailerId], references: [retailers.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  group: one(orderGroups, { fields: [orders.groupId], references: [orderGroups.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  superProduct: one(superProducts, { fields: [orderItems.superProductId], references: [superProducts.id] }),
  components: many(orderItemComponents),
}));

export const orderItemComponentsRelations = relations(orderItemComponents, ({ one, many }) => ({
  orderItem: one(orderItems, { fields: [orderItemComponents.orderItemId], references: [orderItems.id] }),
  product: one(products, { fields: [orderItemComponents.productId], references: [products.id] }),
  measurements: many(orderItemComponentMeasurements),
  features: many(orderItemComponentFeatures),
  manufacturingSteps: many(manufacturingSteps),
  shippingBoxLinks: many(shippingBoxItems),
}));

export const orderItemComponentMeasurementsRelations = relations(orderItemComponentMeasurements, ({ one }) => ({
  component: one(orderItemComponents, {
    fields: [orderItemComponentMeasurements.orderItemComponentId],
    references: [orderItemComponents.id],
  }),
  measurementDefinition: one(measurementDefinitions, {
    fields: [orderItemComponentMeasurements.measurementDefinitionId],
    references: [measurementDefinitions.id],
  }),
}));

export const orderItemComponentFeaturesRelations = relations(orderItemComponentFeatures, ({ one }) => ({
  component: one(orderItemComponents, {
    fields: [orderItemComponentFeatures.orderItemComponentId],
    references: [orderItemComponents.id],
  }),
  feature: one(features, { fields: [orderItemComponentFeatures.featureId], references: [features.id] }),
  style: one(styles, { fields: [orderItemComponentFeatures.styleId], references: [styles.id] }),
  styleOption: one(styleOptions, {
    fields: [orderItemComponentFeatures.styleOptionId],
    references: [styleOptions.id],
  }),
}));

export const manufacturingStepsRelations = relations(manufacturingSteps, ({ one, many }) => ({
  component: one(orderItemComponents, {
    fields: [manufacturingSteps.orderItemComponentId],
    references: [orderItemComponents.id],
  }),
  process: one(processes, { fields: [manufacturingSteps.processId], references: [processes.id] }),
  tailor: one(tailors, { fields: [manufacturingSteps.tailorId], references: [tailors.id] }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  tenant: one(tenants, { fields: [jobs.tenantId], references: [tenants.id] }),
  manufacturingStep: one(manufacturingSteps, {
    fields: [jobs.manufacturingStepId],
    references: [manufacturingSteps.id],
  }),
  tailor: one(tailors, { fields: [jobs.tailorId], references: [tailors.id] }),
  extraPayments: many(extraPayments),
  settlementLinks: many(paymentSettlementJobs),
}));

export const extraPaymentCategoriesRelations = relations(extraPaymentCategories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [extraPaymentCategories.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [extraPaymentCategories.productId], references: [products.id] }),
  feature: one(features, { fields: [extraPaymentCategories.featureId], references: [features.id] }),
  style: one(styles, { fields: [extraPaymentCategories.styleId], references: [styles.id] }),
  process: one(processes, { fields: [extraPaymentCategories.processId], references: [processes.id] }),
  extraPayments: many(extraPayments),
}));

export const extraPaymentsRelations = relations(extraPayments, ({ one }) => ({
  job: one(jobs, { fields: [extraPayments.jobId], references: [jobs.id] }),
  category: one(extraPaymentCategories, {
    fields: [extraPayments.categoryId],
    references: [extraPaymentCategories.id],
  }),
  tailor: one(tailors, { fields: [extraPayments.tailorId], references: [tailors.id] }),
}));

export const workerAdvancePaymentsRelations = relations(workerAdvancePayments, ({ one }) => ({
  tenant: one(tenants, { fields: [workerAdvancePayments.tenantId], references: [tenants.id] }),
  tailor: one(tailors, { fields: [workerAdvancePayments.tailorId], references: [tailors.id] }),
  paymentSettlement: one(paymentSettlements, {
    fields: [workerAdvancePayments.paymentSettlementId],
    references: [paymentSettlements.id],
  }),
}));

export const paymentSettlementsRelations = relations(paymentSettlements, ({ one, many }) => ({
  tenant: one(tenants, { fields: [paymentSettlements.tenantId], references: [tenants.id] }),
  tailor: one(tailors, { fields: [paymentSettlements.tailorId], references: [tailors.id] }),
  jobLinks: many(paymentSettlementJobs),
  clearedAdvances: many(workerAdvancePayments),
}));

export const paymentSettlementJobsRelations = relations(paymentSettlementJobs, ({ one }) => ({
  settlement: one(paymentSettlements, {
    fields: [paymentSettlementJobs.paymentSettlementId],
    references: [paymentSettlements.id],
  }),
  job: one(jobs, { fields: [paymentSettlementJobs.jobId], references: [jobs.id] }),
}));

export const retailerInvoicesRelations = relations(retailerInvoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [retailerInvoices.tenantId], references: [tenants.id] }),
  retailer: one(retailers, { fields: [retailerInvoices.retailerId], references: [retailers.id] }),
  orderLinks: many(retailerInvoiceOrders),
}));

export const retailerInvoiceOrdersRelations = relations(retailerInvoiceOrders, ({ one }) => ({
  retailerInvoice: one(retailerInvoices, {
    fields: [retailerInvoiceOrders.retailerInvoiceId],
    references: [retailerInvoices.id],
  }),
  order: one(orders, { fields: [retailerInvoiceOrders.orderId], references: [orders.id] }),
}));

export const orderInvoicesRelations = relations(orderInvoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [orderInvoices.tenantId], references: [tenants.id] }),
  order: one(orders, { fields: [orderInvoices.orderId], references: [orders.id] }),
  lines: many(orderInvoiceLines),
}));

export const orderInvoiceLinesRelations = relations(orderInvoiceLines, ({ one }) => ({
  orderInvoice: one(orderInvoices, { fields: [orderInvoiceLines.orderInvoiceId], references: [orderInvoices.id] }),
}));

export const shippingBoxesRelations = relations(shippingBoxes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [shippingBoxes.tenantId], references: [tenants.id] }),
  retailer: one(retailers, { fields: [shippingBoxes.retailerId], references: [retailers.id] }),
  items: many(shippingBoxItems),
}));

export const shippingBoxItemsRelations = relations(shippingBoxItems, ({ one }) => ({
  box: one(shippingBoxes, { fields: [shippingBoxItems.shippingBoxId], references: [shippingBoxes.id] }),
  component: one(orderItemComponents, {
    fields: [shippingBoxItems.orderItemComponentId],
    references: [orderItemComponents.id],
  }),
}));
