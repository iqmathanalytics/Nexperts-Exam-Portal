import { env } from "./env.js";

/** Issuer details on invoices and certificates */
export const COMPANY = {
  name: env.invoiceCompanyName,
  legalName: env.invoiceCompanyLegalName,
  addressLines: env.invoiceCompanyAddress.split("|").map((s) => s.trim()).filter(Boolean),
  email: env.invoiceCompanyEmail,
  phone: env.invoiceCompanyPhone,
  website: env.invoiceCompanyWebsite,
  taxId: env.invoiceCompanyTaxId,
} as const;
