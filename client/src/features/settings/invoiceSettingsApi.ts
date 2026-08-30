import { baseApi } from "../../api/baseApi";

/** Mirrors `server/src/db/schema/tenancy.ts`'s letterhead fields on `tenants`. */
export interface InvoiceSettings {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  invoiceFooterText: string | null;
}

export interface UpdateInvoiceSettingsInput {
  logo?: string;
  address?: string;
  invoiceFooterText?: string;
}

interface InvoiceSettingsResponseEnvelope {
  data: InvoiceSettings;
}

/**
 * The tenant's invoice letterhead (logo/address/footer text) — `server/src/services/
 * invoicePdf.service.ts` reads these for both the single-order and grouped-retailer-invoice
 * PDFs. Legacy hardcoded this company info directly into every PDF template, which only
 * worked because legacy served exactly one company; this rewrite is multi-tenant, so it's a
 * real settings screen instead.
 */
export const invoiceSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoiceSettings: builder.query<InvoiceSettings, void>({
      query: () => "/invoice-settings",
      transformResponse: (response: InvoiceSettingsResponseEnvelope) => response.data,
      providesTags: [{ type: "InvoiceSettings", id: "SINGLETON" }],
    }),
    updateInvoiceSettings: builder.mutation<InvoiceSettings, UpdateInvoiceSettingsInput>({
      query: (body) => ({ url: "/invoice-settings", method: "PATCH", body }),
      transformResponse: (response: InvoiceSettingsResponseEnvelope) => response.data,
      invalidatesTags: [{ type: "InvoiceSettings", id: "SINGLETON" }],
    }),
  }),
});

export const { useGetInvoiceSettingsQuery, useUpdateInvoiceSettingsMutation } = invoiceSettingsApi;
