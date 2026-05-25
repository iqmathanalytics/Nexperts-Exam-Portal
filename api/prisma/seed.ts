import { PrismaClient, Role, ExamStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@nexperts.io";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@NExperts2026";
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: "Priya Nair",
      role: Role.SUPER_ADMIN,
      passwordHash: hash,
      emailVerified: true,
    },
    update: { passwordHash: hash, role: Role.SUPER_ADMIN, emailVerified: true },
  });

  const exams = [
    {
      title: "AI & Machine Learning Foundations",
      category: "Artificial Intelligence",
      description: "Validate ML fundamentals and modern AI workflows.",
      duration: 90,
      questions: 60,
      passScore: 70,
      maxAttempts: 3,
      price: 149,
      status: ExamStatus.PUBLISHED,
    },
    {
      title: "Cloud Architect Professional",
      category: "Cloud Computing",
      description: "Enterprise cloud architecture and security design.",
      duration: 120,
      questions: 80,
      passScore: 75,
      maxAttempts: 2,
      price: 249,
      status: ExamStatus.PUBLISHED,
    },
    {
      title: "Cybersecurity Analyst",
      category: "Security",
      description: "SOC operations, threat detection and incident response.",
      duration: 100,
      questions: 70,
      passScore: 72,
      maxAttempts: 3,
      price: 179,
      status: ExamStatus.DRAFT,
    },
  ];

  for (const e of exams) {
    const existing = await prisma.exam.findFirst({ where: { title: e.title } });
    if (!existing) await prisma.exam.create({ data: e });
  }

  const aiml = await prisma.exam.findFirst({ where: { title: "AI & Machine Learning Foundations" } });
  if (aiml) {
    const qCount = await prisma.question.count({ where: { examId: aiml.id } });
    if (qCount === 0) {
      await prisma.question.createMany({
        data: [
          {
            examId: aiml.id,
            title: "Which algorithm is best for non-linear classification?",
            type: "MULTIPLE_CHOICE",
            options: ["Linear Regression", "SVM with RBF kernel", "K-Means", "Apriori"],
            correctAnswer: "SVM with RBF kernel",
            explanation: "RBF kernels handle non-linear boundaries.",
            difficulty: "Intermediate",
            topic: "Machine Learning",
          },
          {
            examId: aiml.id,
            title: "Gradient descent always finds the global minimum.",
            type: "TRUE_FALSE",
            options: ["True", "False"],
            correctAnswer: "False",
            explanation: "Non-convex losses may have local minima.",
            difficulty: "Beginner",
            topic: "Optimization",
          },
          {
            examId: aiml.id,
            title: "A team needs real-time inference at scale. Best approach?",
            type: "SCENARIO",
            options: ["Batch only", "Edge deployment with model serving", "Manual scoring", "Single-threaded scripts"],
            correctAnswer: "Edge deployment with model serving",
            explanation: "Serving infrastructure supports low-latency inference.",
            difficulty: "Advanced",
            topic: "MLOps",
          },
        ],
      });
    }
  }

  await prisma.voucher.upsert({
    where: { code: "NEXPERTS25" },
    create: {
      code: "NEXPERTS25",
      discountType: "Percentage",
      discountAmount: 25,
      usageLimit: 500,
      expiry: new Date("2026-12-31"),
      active: true,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "candidate@nexperts.io" },
    create: {
      email: "candidate@nexperts.io",
      fullName: "Aarav Sharma",
      phone: "+60 12-345 6789",
      icPassport: "901234-10-5678",
      mycat: "MYCAT-2025-44218",
      degree: "B.Tech, Computer Science",
      role: Role.CANDIDATE,
      emailVerified: true,
    },
    update: { emailVerified: true, role: Role.CANDIDATE },
  });

  console.log("Seed complete:", { adminEmail, candidate: "candidate@nexperts.io" });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
