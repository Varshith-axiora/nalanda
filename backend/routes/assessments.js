import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole, isAdmin } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  let where = {};
  if (req.user.role === "Manager") {
    where = { OR: [{ ownerId: req.user.id }, { approval: "Approved" }] };
  } else if (req.user.role === "Employee") {
    where = { approval: "Approved" };
  }

  try {
    const assessments = await prisma.assessment.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data: assessments, total: assessments.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

router.post("/", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  const schema = z.object({ 
    title: z.string().min(4), 
    courseId: z.string(), 
    type: z.enum(["MCQ", "Descriptive", "Timed Quiz"]), 
    strictMode: z.boolean().default(true), 
    questions: z.array(z.record(z.string(), z.any())).min(1), 
    durationMinutes: z.number().min(1), 
    passScore: z.number().min(1).max(100) 
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const assessment = await prisma.assessment.create({
      data: {
        id: `ASM-${Math.floor(1000 + Math.random() * 9000)}`,
        ...parsed.data,
        approval: isAdmin(req.user.role) ? "Approved" : "Pending",
        ownerId: req.user.id
      }
    });

    await audit(req.user.id, "CREATE_ASSESSMENT", "ASSESSMENT", assessment.id, { approval: assessment.approval });
    res.status(201).json({ data: assessment });
  } catch (err) {
    res.status(500).json({ error: "Failed to create assessment" });
  }
});

export default router;
