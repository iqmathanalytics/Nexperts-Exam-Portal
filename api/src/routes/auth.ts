import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OtpPurpose, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { generateOtpCode, otpExpiresAt } from "../lib/otp.js";
import { signToken } from "../lib/jwt.js";
import { sendOtpEmail } from "../services/brevo.js";
import { env } from "../lib/env.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  icPassport: z.string().min(4),
  password: z.string().min(6).optional(),
});

const emailSchema = z.object({ email: z.string().email() });

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  purpose: z.enum(["REGISTER", "LOGIN"]),
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function issueOtp(email: string, purpose: OtpPurpose) {
  const code = generateOtpCode();
  await prisma.otpCode.create({
    data: { email, code, purpose, expiresAt: otpExpiresAt(5) },
  });
  await sendOtpEmail(email, code, purpose === "REGISTER" ? "registration" : "login");
  if (env.nodeEnv === "development") {
    console.log(`[OTP] ${email} (${purpose}): ${code}`);
  }
  return { sent: true };
}

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing?.emailVerified) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

    await prisma.user.upsert({
      where: { email: data.email },
      create: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        icPassport: data.icPassport,
        passwordHash,
        role: Role.CANDIDATE,
        emailVerified: false,
      },
      update: {
        fullName: data.fullName,
        phone: data.phone,
        icPassport: data.icPassport,
        passwordHash,
      },
    });

    await issueOtp(data.email, OtpPurpose.REGISTER);
    res.json({ message: "OTP sent to your email" });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login/send-otp", async (req, res) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== Role.CANDIDATE) {
      return res.status(404).json({ error: "No account found" });
    }
    await issueOtp(email, OtpPurpose.LOGIN);
    res.json({ message: "OTP sent" });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error(e);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code, purpose } = verifySchema.parse(req.body);
    const otp = await prisma.otpCode.findFirst({
      where: {
        email,
        code,
        purpose: purpose as OtpPurpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const devBypass =
      env.nodeEnv === "development" && code === (process.env.DEV_OTP ?? "000000");

    if (!otp && !devBypass) return res.status(400).json({ error: "Invalid or expired OTP" });

    if (devBypass && !otp) {
      // Dev-only: allow fixed OTP without DB record
    } else if (otp) {

      await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (purpose === "REGISTER") {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    console.error(e);
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireAuth(), async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      icPassport: true,
      degree: true,
      dob: true,
      role: true,
      status: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

const profilePatchSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  icPassport: z.string().min(4).optional(),
  degree: z.string().optional(),
  dob: z.string().optional(),
});

router.patch("/me", requireAuth(), async (req: AuthedRequest, res) => {
  try {
    const body = profilePatchSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: {
        ...(body.fullName && { fullName: body.fullName }),
        ...(body.phone && { phone: body.phone }),
        ...(body.icPassport && { icPassport: body.icPassport }),
        ...(body.degree !== undefined && { degree: body.degree }),
        ...(body.dob && { dob: new Date(body.dob) }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        icPassport: true,
        degree: true,
        dob: true,
        role: true,
        createdAt: true,
      },
    });
    res.json({ user });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.flatten() });
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
