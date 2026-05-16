import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { signToken, authenticate } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

const publicUser = (user) => { 
  const { passwordHash, ...safe } = user; 
  return safe; 
};

router.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status === "Active" && bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
      await audit(user.id, "LOGIN", "AUTH", user.id);
      return res.json({ data: { token: signToken(user), user: publicUser(user) } });
    }
  } catch (e) {
    console.error("Prisma login lookup failed:", e.message);
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), permissions: req.user.role });
});

export default router;
