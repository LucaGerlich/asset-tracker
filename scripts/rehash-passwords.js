// Re-hash any plaintext user passwords with bcrypt
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { password: { equals: null } },
        { password: { equals: "" } },
        { NOT: { password: { startsWith: "$2" } } }, // not already bcrypt
      ],
    },
    select: { userid: true, password: true, firstname: true, lastname: true, email: true },
  });

  if (!candidates.length) {
    console.log("No plaintext passwords found. Nothing to do.");
    return;
  }

  console.log(`Found ${candidates.length} user(s) with plaintext passwords. Re-hashing...`);

  let success = 0;
  let failed = 0;
  for (const u of candidates) {
    try {
      const value = u.password || "";
      // Skip empty values (cannot hash an unknown password). You may want to force a reset instead.
      if (!value) {
        console.warn(`Skipping ${u.userid} (empty password)`);
        continue;
      }
      const hashed = await bcrypt.hash(value, 10);
      await prisma.user.update({ where: { userid: u.userid }, data: { password: hashed } });
      success++;
    } catch (e) {
      console.error(`Failed to rehash user ${u.userid}:`, e.message);
      failed++;
    }
  }

  console.log(`Done. Rehashed: ${success}, Failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

