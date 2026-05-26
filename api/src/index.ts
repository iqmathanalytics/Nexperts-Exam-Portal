import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import authRoutes from "./routes/auth.js";
import examRoutes from "./routes/exams.js";
import adminRoutes from "./routes/admin.js";
import paymentRoutes from "./routes/payments.js";
import attemptRoutes from "./routes/attempts.js";
import candidateRoutes from "./routes/candidate.js";
import certificateRoutes from "./routes/certificates.js";
import { handleStripeWebhook } from "./routes/payments.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.clientUrls.includes(origin)) {
        callback(null, true);
      } else if (env.nodeEnv === "development") {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  }),
);

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      await handleStripeWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (e) {
      console.error("Webhook error:", e);
      res.status(400).json({ error: "Webhook failed" });
    }
  },
);

app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nexperts-api",
    stripe: Boolean(env.stripeSecretKey),
    groq: Boolean(env.groqApiKey),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/certificates", certificateRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`API running at http://localhost:${env.port}`);
});
