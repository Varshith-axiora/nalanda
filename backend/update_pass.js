import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";

async function main() {
  const hash = bcrypt.hashSync("Password@123", 10);
  await prisma.user.update({
    where: { email: "admin@nalanda.local" },
    data: { passwordHash: hash }
  });
  console.log("Password updated for admin@nalanda.local");
  process.exit(0);
}
main();
