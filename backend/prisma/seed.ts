import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 10);

  const users = [
    { name: "Admin User", email: "admin@erp.test", role: "ADMIN" as const },
    { name: "Sales User", email: "sales@erp.test", role: "SALES" as const },
    { name: "Warehouse User", email: "warehouse@erp.test", role: "WAREHOUSE" as const },
    { name: "Accounts User", email: "accounts@erp.test", role: "ACCOUNTS" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  console.log("Seeded users (password for all: Password123!):");
  users.forEach((u) => console.log(`  ${u.role}: ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
