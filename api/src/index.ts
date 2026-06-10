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
import { connectDatabase, prisma } from "./lib/prisma.js";
import { prismaErrorMessage, prismaErrorStatus } from "./lib/prisma-errors.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (env.nodeEnv === "development") {
        callback(null, true);
        return;
      }
      if (!origin || env.clientUrls.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Content-Type", "Content-Length"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

app.get("/api/health", async (_req, res) => {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch (e) {
    console.error("Health check: database unreachable", e);
  }
  const ok = database;
  res.status(ok ? 200 : 503).json({
    ok,
    database,
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

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const origin = req.headers.origin;
  if (
    origin &&
    (env.nodeEnv === "development" || env.clientUrls.includes(origin))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (!res.headersSent) {
    const prismaStatus = prismaErrorStatus(err);
    if (prismaStatus) {
      res.status(prismaStatus).json({ error: prismaErrorMessage(err) });
      return;
    }
    const message = err instanceof Error ? err.message : "";
    res.status(message.startsWith("CORS blocked") ? 403 : 500).json({
      error: message.startsWith("CORS blocked") ? message : "Internal server error",
    });
  }
});

async function start() {
  try {
    await connectDatabase();
    console.log("Database connected");
  } catch (e) {
    console.error(
      "Database connection failed — API will start but requests will fail until TiDB is reachable.",
      e instanceof Error ? e.message : e,
    );
  }
  app.listen(env.port, () => {
    console.log(`API running at http://localhost:${env.port}`);
  });
}

void start();
