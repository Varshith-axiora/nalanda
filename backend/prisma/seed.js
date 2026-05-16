import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync("Password@123", 10);

  // 1. Super Admin
  await prisma.user.upsert({
    where: { id: "EMP-0001" },
    update: {},
    create: {
      id: "EMP-0001",
      name: "Super Admin",
      email: "super@nalanda.local",
      passwordHash,
      department: "Platform",
      role: "Super Admin",
      status: "Active"
    }
  });

  // 2. Admin
  await prisma.user.upsert({
    where: { id: "EMP-1288" },
    update: {},
    create: {
      id: "EMP-1288",
      name: "Nisha Rao",
      email: "admin@nalanda.local",
      passwordHash,
      department: "People Ops",
      role: "Admin",
      status: "Active"
    }
  });

  // 3. Manager
  await prisma.user.upsert({
    where: { id: "EMP-1102" },
    update: {},
    create: {
      id: "EMP-1102",
      name: "Kabir Sethi",
      email: "kabir@nalanda.local",
      passwordHash,
      department: "Engineering",
      role: "Manager",
      managerId: "EMP-1288",
      status: "Active"
    }
  });

  // 4. Employee
  await prisma.user.upsert({
    where: { id: "EMP-1034" },
    update: {},
    create: {
      id: "EMP-1034",
      name: "Diya Sharma",
      email: "diya@nalanda.local",
      passwordHash,
      department: "Engineering",
      role: "Employee",
      managerId: "EMP-1102",
      status: "Active"
    }
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
