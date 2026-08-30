import nodemailer from "nodemailer";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

/**
 * Env-configured SMTP (`SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM`) — replaces legacy
 * `routes.retailerInvoices.js`'s hardcoded live Gmail address + app password committed
 * directly in the route file, which is not something this rewrite carries forward as-is.
 * Lazily constructed (not at module load) so importing this file in an environment with no
 * SMTP configured (dev/test/CI, same posture as `storage.service.ts`'s S3 fallback) doesn't
 * throw until someone actually tries to send an email.
 */
function hasSmtpConfig(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!hasSmtpConfig()) {
    throw new HttpError(503, "EMAIL_NOT_CONFIGURED", "No SMTP configuration is set for this server");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface SendPdfEmailInput {
  to: string[];
  subject: string;
  text: string;
  attachmentFilename: string;
  attachment: Buffer;
}

/** Legacy `routes.retailerInvoices.js`'s `/send-email` route, minus the hardcoded transport — attaches a generated PDF and emails it to one or more recipients. */
export async function sendPdfEmail(input: SendPdfEmailInput): Promise<void> {
  if (input.to.length === 0) {
    throw new HttpError(422, "NO_EMAIL_RECIPIENTS", "This retailer has no email recipients configured");
  }
  await getTransporter().sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: [{ filename: input.attachmentFilename, content: input.attachment }],
  });
}
