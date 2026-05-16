import express from "express";
import { v4 as uuid } from "uuid";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole } from "../lib/auth.js";
import { audit, auditLogs } from "../lib/audit.js";

const router = express.Router();

// ── Archive (Super Admin only) ──
router.get("/archive", authenticate, requireRole("Super Admin"), async (req, res) => {
  try {
    const archives = await prisma.archive.findMany({ orderBy: { deletedAt: 'desc' } });
    res.json({ data: archives, total: archives.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch archive" });
  }
});

router.post("/archive/:id/restore", authenticate, requireRole("Super Admin"), async (req, res) => {
  try {
    const record = await prisma.archive.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: "Archived record not found" });
    
    const data = record.entityData;
    if (record.entityType === "User") await prisma.user.create({ data });
    else if (record.entityType === "Course") await prisma.course.create({ data });
    else if (record.entityType === "Assessment") await prisma.assessment.create({ data });
    
    await prisma.archive.delete({ where: { id: req.params.id } });
    await audit(req.user.id, "RESTORE_ARCHIVE", record.entityType.toUpperCase(), record.entityId);
    res.json({ success: true, message: `${record.entityType} restored successfully` });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore record" });
  }
});

// ── Audit Logs ──
router.get("/audit-logs", authenticate, requireRole("Admin"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  try {
    const logs = await prisma.auditLog.findMany({ 
      take: limit, 
      orderBy: { createdAt: 'desc' } 
    });
    // Fallback to in-memory if DB logs are empty (for transition)
    const data = logs.length > 0 ? logs : auditLogs.slice(0, limit);
    res.json({ data, total: logs.length || auditLogs.length });
  } catch (err) {
    res.json({ data: auditLogs.slice(0, limit), total: auditLogs.length });
  }
});

// ── Settings ──
router.get("/settings", authenticate, requireRole("Admin"), (req, res) => {
    // For now keep settings in memory or use a simple DB table if it exists
    res.json({ data: { fullscreenRequired: true, cameraRequired: true, microphoneRequired: true, tabSwitchAutoSubmit: true, noiseThreshold: 70, maxAssessmentFlags: 2 } });
});

export default router;
