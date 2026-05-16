import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole, isAdmin } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

const nextCourseId = (skill = "GN") => `NLD-${skill.slice(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
const canManageCourse = (user, course) => user.role === "Admin" || user.role === "Super Admin" || course.ownerId === user.id;

router.get("/", authenticate, async (req, res) => {
  const { skill, approval, status = "Active" } = req.query;
  
  let where = {};
  if (req.user.role === "Manager") {
    where = { OR: [{ ownerId: req.user.id }, { approval: "Approved" }] };
  } else if (req.user.role === "Employee") {
    where = { approval: "Approved", status: "Active" };
  }

  if (skill) where.skill = skill;
  if (approval) where.approval = approval;
  if (status && status !== "All") where.status = status;

  try {
    const courses = await prisma.course.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data: courses, total: courses.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

router.post("/", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  const body = typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body;
  const schema = z.object({ 
    title: z.string().min(4), 
    description: z.string().min(10), 
    skill: z.string().min(2), 
    tags: z.array(z.string()).default([]), 
    contentTypes: z.array(z.string()).default(["Rich Text"]) 
  });
  
  const parsed = schema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const course = await prisma.course.create({
      data: {
        id: nextCourseId(parsed.data.skill),
        title: parsed.data.title,
        description: parsed.data.description,
        skill: parsed.data.skill,
        tags: parsed.data.tags,
        approval: isAdmin(req.user.role) ? "Approved" : "Pending",
        status: "Active",
        ownerId: req.user.id,
        version: 1
      }
    });

    await audit(req.user.id, "CREATE_COURSE", "COURSE", course.id, { approval: course.approval });
    res.status(201).json({ data: course });
  } catch (err) {
    res.status(500).json({ error: "Failed to create course" });
  }
});

router.put("/:id", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ error: "Course not found" });
    if (!canManageCourse(req.user, course)) return res.status(403).json({ error: "Forbidden" });

    const updatedCourse = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        version: (course.version || 0) + 1,
        approval: isAdmin(req.user.role) ? "Approved" : "Pending"
      }
    });

    await audit(req.user.id, "UPDATE_COURSE", "COURSE", updatedCourse.id, { version: updatedCourse.version });
    res.json({ data: updatedCourse });
  } catch (err) {
    res.status(500).json({ error: "Failed to update course" });
  }
});

router.patch("/:id/approval", authenticate, requireRole("Admin"), async (req, res) => {
  const schema = z.object({ approval: z.enum(["Approved", "Rejected"]), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        approval: parsed.data.approval,
        status: parsed.data.approval === "Rejected" ? "Inactive" : undefined
      }
    });

    await audit(req.user.id, "COURSE_APPROVAL", "COURSE", course.id, parsed.data);
    res.json({ data: course });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve/reject course" });
  }
});

export default router;
