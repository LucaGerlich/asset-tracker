// Seed essential reference data for the app
// Ensures required status types exist
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function ensureStatus(name) {
  const existing = await prisma.statusType.findFirst({
    where: { statustypename: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.statusType.create({ data: { statustypename: name } });
}

async function main() {
  await ensureStatus("Active");
  await ensureStatus("Available");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

