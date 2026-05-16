import express from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  let where = {};
  if (req.user.role === "Employee") {
    where = { userId: req.user.id };
  } else if (req.user.role === "Manager") {
    // For managers, we'd ideally filter by their team, but for now we'll fetch all related to them or their own
    where = { OR: [{ userId: req.user.id }, { assignedBy: req.user.id }] };
  }

  try {
    const assignments = await prisma.assignment.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data: assignments, total: assignments.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  const schema = z.object({ courseId: z.string(), userIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const created = await Promise.all(parsed.data.userIds.map((userId) => 
      prisma.assignment.create({
        data: {
          id: uuid(),
          courseId: parsed.data.courseId,
          userId,
          assignedBy: req.user.id
        }
      })
    ));

    await audit(req.user.id, "ASSIGN_COURSE", "COURSE", parsed.data.courseId, { count: created.length });
    res.status(201).json({ data: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to create assignments" });
  }
});

export default router;
