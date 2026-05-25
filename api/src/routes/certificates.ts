import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/public/:credentialId", async (req, res) => {
  const credentialId = String(req.params.credentialId);
  const cert = await prisma.certificate.findUnique({
    where: { credentialId },
    include: { user: true, exam: true },
  });
  if (!cert) return res.status(404).json({ error: "Certificate not found" });

  res.json({
    credentialId: cert.credentialId,
    recipientName: cert.user.fullName,
    examTitle: cert.exam.title,
    category: cert.exam.category,
    score: cert.score,
    issuedOn: cert.issuedOn.toISOString(),
    verified: true,
  });
});

export default router;
