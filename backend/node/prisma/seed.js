const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding plans...");

  const plans = [
    {
      name: "free",
      priceCents: 0,
      limits: {
        maxJobsPerMonth: 50,
        maxFileSizeMB: 10,
        maxPagesPerJob: 50,
        concurrentJobs: 1,
        retentionDays: 1,
      },
    },
    {
      name: "pro",
      priceCents: 1999,
      limits: {
        maxJobsPerMonth: 1000,
        maxFileSizeMB: 100,
        maxPagesPerJob: 500,
        concurrentJobs: 5,
        retentionDays: 7,
      },
    },
    {
      name: "business",
      priceCents: 4999,
      limits: {
        maxJobsPerMonth: -1,
        maxFileSizeMB: 500,
        maxPagesPerJob: 5000,
        concurrentJobs: 20,
        retentionDays: 30,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: { priceCents: plan.priceCents, limits: plan.limits },
      create: plan,
    });
    console.log(`  Upserted plan: ${plan.name}`);
  }

  // Create anonymous user for no-auth mode
  console.log("Creating anonymous user...");
  const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });
  await prisma.user.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "anonymous@pdflow.local",
      passwordHash: "no-auth",
      planId: freePlan.id,
    },
  });
  console.log("  Anonymous user ready");

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
