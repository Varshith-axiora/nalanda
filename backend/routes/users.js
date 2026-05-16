import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

const roles = ["Super Admin", "Admin", "Manager", "Employee"];
const publicUser = (user) => { 
  const { passwordHash, ...safe } = user; 
  return safe; 
};

router.get("/", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  const { department, role, status = "Active" } = req.query;
  
  let where = req.user.role === "Manager" ? { managerId: req.user.id } : {};
  if (department && department !== "All") where.department = department;
  if (role) where.role = role;
  if (status && status !== "All") where.status = status;

  try {
    const dbUsers = await prisma.user.findMany({ 
      where, 
      orderBy: { createdAt: 'desc' } 
    });
    res.json({ data: dbUsers.map(publicUser), total: dbUsers.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/", authenticate, requireRole("Admin"), async (req, res) => {
  const schema = z.object({ 
    name: z.string().min(2), 
    email: z.string().email(), 
    department: z.string().min(2), 
    role: z.enum(roles), 
    managerId: z.string().nullable().optional(), 
    password: z.string().min(8) 
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const email = parsed.data.email;
  const existsInDb = await prisma.user.findUnique({ where: { email } });
  
  if (existsInDb) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const id = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const newUser = await prisma.user.create({
      data: {
        id,
        name: parsed.data.name,
        email: parsed.data.email,
        department: parsed.data.department,
        role: parsed.data.role,
        managerId: parsed.data.managerId || null,
        passwordHash: bcrypt.hashSync(parsed.data.password, 10),
        status: "Active"
      }
    });

    await audit(req.user.id, "CREATE_USER", "USER", newUser.id, { role: newUser.role });
    res.status(201).json({ data: publicUser(newUser) });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/:id", authenticate, requireRole("Admin"), async (req, res) => {
  const schema = z.object({ 
    name: z.string().min(2).optional(), 
    department: z.string().min(2).optional(), 
    role: z.enum(roles).optional(), 
    managerId: z.string().nullable().optional(), 
    status: z.enum(["Active", "Inactive"]).optional() 
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const dataToUpdate = { ...parsed.data };
    
    // If status changed to Inactive, increment sessionVersion
    if (parsed.data.status === "Inactive" && user.status === "Active") {
      dataToUpdate.sessionVersion = (user.sessionVersion || 0) + 1;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });

    await audit(req.user.id, "UPDATE_USER", "USER", updatedUser.id, parsed.data);
    res.json({ data: publicUser(updatedUser) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/:id", authenticate, requireRole("Super Admin"), async (req, res) => {
  const schema = z.object({ deletionComment: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Archive before deletion
    await prisma.archive.create({
      data: {
        entityType: "User",
        entityId: user.id,
        entityData: user,
        deletedBy: req.user.id,
        deletedByName: req.user.name,
        deletionComment: parsed.data.deletionComment
      }
    });

    await prisma.user.delete({ where: { id: req.params.id } });
    await audit(req.user.id, "DELETE_USER", "USER", user.id);
    
    res.json({ success: true, message: "User permanently deleted and archived" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
