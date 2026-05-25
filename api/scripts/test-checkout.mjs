const base = "http://localhost:3001";

async function json(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const otp = await json("/api/auth/login/send-otp", {
  method: "POST",
  body: JSON.stringify({ email: "candidate@nexperts.io" }),
});
console.log("send-otp", otp.status, otp.body);

const auth = await json("/api/auth/verify-otp", {
  method: "POST",
  body: JSON.stringify({ email: "candidate@nexperts.io", code: "000000", purpose: "LOGIN" }),
});
console.log("verify", auth.status, auth.body);
const token = auth.body?.token;
if (!token) process.exit(1);

const exams = await json("/api/candidate/available-exams", {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("exams", exams.status, exams.body?.exams?.length);
const examId = exams.body?.exams?.[0]?.id;
if (!examId) {
  console.log("no available exam");
  process.exit(0);
}

const slots = await json(
  `/api/payments/schedule-slots?examId=${examId}&date=2026-05-27`,
  { headers: { Authorization: `Bearer ${token}` } },
);
console.log("slots", slots.status, slots.body?.slots?.[0]);

const payload = {
  examId,
  scheduledDate: "2026-05-27",
  scheduledStartTime: slots.body?.slots?.[0]?.startTime ?? "10:00",
};
console.log("payload", payload);
const checkout = await json("/api/payments/checkout", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});
console.log("checkout", checkout.status, checkout.body);
