import express from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: skills, total: skills.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

router.post("/", authenticate, requireRole("Admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    category: z.string(),
    description: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const skill = await prisma.skill.create({
      data: {
        id: uuid(),
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description,
        status: "Active"
      }
    });
    await audit(req.user.id, "CREATE_SKILL", "SKILL", skill.id);
    res.status(201).json({ data: skill });
  } catch (err) {
    res.status(500).json({ error: "Failed to create skill" });
  }
});

router.patch("/:id", authenticate, requireRole("Admin"), async (req, res) => {
  try {
    const skill = await prisma.skill.update({
      where: { id: req.params.id },
      data: req.body
    });
    await audit(req.user.id, "UPDATE_SKILL", "SKILL", skill.id);
    res.json({ data: skill });
  } catch (err) {
    res.status(500).json({ error: "Failed to update skill" });
  }
});

export default router;
