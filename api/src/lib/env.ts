import "dotenv/config";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

const defaultOrigins = ["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080"];

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:8080",
  clientUrls: process.env.CLIENT_URLS
    ? process.env.CLIENT_URLS.split(",").map((s) => s.trim())
    : process.env.CLIENT_URL
      ? [process.env.CLIENT_URL, ...defaultOrigins]
      : defaultOrigins,
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  brevoApiKey: required("BREVO_API_KEY"),
  brevoSenderEmail: required("BREVO_SENDER_EMAIL"),
  brevoSenderName: process.env.BREVO_SENDER_NAME ?? "Certification Academy",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@nexperts.io",
  adminPassword: process.env.ADMIN_PASSWORD ?? "Admin@NExperts2026",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:8080/payment-success",
  stripeCancelUrl: process.env.STRIPE_CANCEL_URL ?? "http://localhost:8080/dashboard/exams",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  proctoringServiceUrl: process.env.PROCTORING_SERVICE_URL ?? "http://127.0.0.1:8765",
  invoiceCompanyName: process.env.INVOICE_COMPANY_NAME ?? "Nexperts Academy",
  invoiceCompanyLegalName: process.env.INVOICE_COMPANY_LEGAL_NAME ?? "Nexperts Academy Sdn. Bhd.",
  invoiceCompanyAddress:
    process.env.INVOICE_COMPANY_ADDRESS ??
    "Level 10, Menara XYZ|Jalan Ampang|50450 Kuala Lumpur|Malaysia",
  invoiceCompanyEmail: process.env.INVOICE_COMPANY_EMAIL ?? "billing@nexperts.io",
  invoiceCompanyPhone: process.env.INVOICE_COMPANY_PHONE ?? "+60 3-1234 5678",
  invoiceCompanyWebsite: process.env.INVOICE_COMPANY_WEBSITE ?? "https://nexperts.io",
  invoiceCompanyTaxId: process.env.INVOICE_COMPANY_TAX_ID ?? "",
};
