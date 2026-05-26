import { env } from "../lib/env.js";

type EmailAttachment = { name: string; contentBase64: string };

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
};

export async function sendEmail(options: SendEmailOptions) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
      attachment: options.attachments?.map((a) => ({
        name: a.name,
        content: a.contentBase64,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo email failed: ${res.status} ${err}`);
  }
}

export async function sendOtpEmail(to: string, code: string, purpose: "registration" | "login") {
  const subject =
    purpose === "registration"
      ? "Verify your NExperts account"
      : "Your NExperts sign-in code";

  const html = `
    <div style="font-family:Manrope,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#8B1538">NExperts Academy</h2>
      <p>Your verification code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#8B1538">${code}</p>
      <p style="color:#666;font-size:14px">This code expires in 5 minutes. Do not share it with anyone.</p>
    </div>
  `;

  await sendEmail({ to, subject, html });
}

export async function sendInvoiceEmail(params: {
  to: string;
  recipientName: string;
  examTitle: string;
  invoiceId: string;
  amount: number;
  pdf: Buffer;
}) {
  const html = `
    <div style="font-family:Manrope,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
      <h2 style="color:#8B1538;margin:0 0 8px">${env.brevoSenderName}</h2>
      <p style="margin:0 0 16px;color:#666">Payment confirmation</p>
      <p>Hi ${params.recipientName},</p>
      <p>Thank you for your payment. Your exam registration for <strong>${params.examTitle}</strong> is confirmed.</p>
      <p style="background:#f8f8f8;padding:12px 16px;border-radius:8px;font-size:14px">
        Invoice: <strong>${params.invoiceId}</strong><br/>
        Amount paid: <strong>MYR ${params.amount.toFixed(2)}</strong>
      </p>
      <p style="color:#666;font-size:14px">Your invoice PDF is attached to this email. You can also download it anytime from <strong>Dashboard → Payments &amp; Invoices</strong>.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">This is an automated message. Please do not reply.</p>
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: `Invoice ${params.invoiceId} — ${params.examTitle}`,
    html,
    attachments: [
      {
        name: `${params.invoiceId}.pdf`,
        contentBase64: params.pdf.toString("base64"),
      },
    ],
  });
}
