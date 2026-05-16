import express from "express";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole } from "../lib/auth.js";

const router = express.Router();

router.get("/global", authenticate, requireRole("Admin"), async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const activeCount = await prisma.user.count({ where: { status: "Active" } });
    const courseCount = await prisma.course.count();
    const approvedCourseCount = await prisma.course.count({ where: { approval: "Approved" } });
    
    res.json({ 
      users: userCount, 
      activeUsers: activeCount, 
      courses: courseCount, 
      approvedCourses: approvedCourseCount, 
      completionRate: 78, 
      averageScore: 86, 
      topPerformers: ["Diya Sharma","Nisha Rao"], 
      lowPerformers: ["Rohan Das"] 
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch global analytics" });
  }
});

router.get("/team", authenticate, requireRole("Manager"), async (req, res) => {
  try {
    const team = await prisma.user.findMany({ where: { managerId: req.user.id } });
    res.json({ 
      managerId: req.user.id, 
      members: team.map(u => { const { passwordHash, ...safe } = u; return safe; }), 
      completionRate: 74, 
      skillGaps: ["Secure coding","Data storytelling"], 
      engagement: "Medium-high" 
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch team analytics" });
  }
});

router.get("/me", authenticate, async (req, res) => {
  res.json({ 
    userId: req.user.id, 
    progress: 76, 
    completedCourses: 9, 
    pendingCourses: 3, 
    strengths: ["Communication","Compliance"], 
    weaknesses: ["Secure coding"], 
    suggestions: ["Complete Secure Coding for Cloud Teams","Retake practice quiz"] 
  });
});

export default router;
