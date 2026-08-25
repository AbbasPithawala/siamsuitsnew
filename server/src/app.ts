import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { meRouter } from "./routes/me.routes";
import { tailorRouter } from "./routes/tailor.routes";
import { productsRouter } from "./routes/products.routes";
import { superProductsRouter } from "./routes/superProducts.routes";
import { processesRouter } from "./routes/processes.routes";
import { measurementsRouter } from "./routes/measurements.routes";
import { featuresRouter } from "./routes/features.routes";
import { fittingsRouter } from "./routes/fittings.routes";
import { customersRouter } from "./routes/customers.routes";
import { measurementProfilesRouter } from "./routes/measurementProfiles.routes";
import { retailersRouter } from "./routes/retailers.routes";
import { tailorsRouter } from "./routes/tailors.routes";
import { usersRouter } from "./routes/users.routes";
import { rolesRouter } from "./routes/roles.routes";
import { permissionsRouter } from "./routes/permissions.routes";
import { ordersRouter } from "./routes/orders.routes";
import { orderGroupsRouter } from "./routes/order-groups.routes";
import { manufacturingRouter } from "./routes/manufacturing.routes";
import { extraPaymentsRouter } from "./routes/extra-payments.routes";
import { extraPaymentCategoriesRouter } from "./routes/extraPaymentCategories.routes";
import { payrollRouter } from "./routes/payroll.routes";
import { invoicesRouter } from "./routes/invoices.routes";
import { shippingRouter } from "./routes/shipping.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { localStorageRootDir, LOCAL_STATIC_URL_PREFIX } from "./services/storage.service";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(LOCAL_STATIC_URL_PREFIX, (_req, res, next) => {
  // Uploaded images are meant to be loaded cross-origin (e.g. the client dev server on a
  // different port) — override helmet's default same-origin resource policy for this route only.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(LOCAL_STATIC_URL_PREFIX, express.static(localStorageRootDir));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/tailor", tailorRouter);
app.use("/api", meRouter);
app.use("/api", productsRouter);
app.use("/api", superProductsRouter);
app.use("/api", processesRouter);
app.use("/api", measurementsRouter);
app.use("/api", featuresRouter);
app.use("/api", fittingsRouter);
app.use("/api", customersRouter);
app.use("/api", measurementProfilesRouter);
app.use("/api", retailersRouter);
app.use("/api", tailorsRouter);
app.use("/api", usersRouter);
app.use("/api", rolesRouter);
app.use("/api", permissionsRouter);
app.use("/api", ordersRouter);
app.use("/api", orderGroupsRouter);
app.use("/api", manufacturingRouter);
app.use("/api", extraPaymentsRouter);
app.use("/api", extraPaymentCategoriesRouter);
app.use("/api", payrollRouter);
app.use("/api", invoicesRouter);
app.use("/api", shippingRouter);
app.use("/api", uploadsRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: { message: `Not found: ${req.method} ${req.path}`, code: "NOT_FOUND" } });
});

interface HttpError extends Error {
  status?: number;
  code?: string;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status ?? 500).json({
    error: { message: err.message || "Internal server error", code: err.code ?? "INTERNAL_ERROR" },
  });
});
