import { env } from "../lib/env.js";

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

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo email failed: ${res.status} ${err}`);
  }
}
