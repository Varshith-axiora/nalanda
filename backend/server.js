import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 500 } });

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";

// ΓöÇΓöÇ CORS ΓÇö allow Netlify frontend + local dev ΓöÇΓöÇ
app.use(cors({
  origin: [
    "https://nalandalms.netlify.app",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [])
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(helmet());
app.use(express.json({ limit: "2mb" }));

const roles = ["Super Admin", "Admin", "Manager", "Employee"];
const adminRoles = ["Super Admin", "Admin"];
const now = () => new Date().toISOString();
const nextCourseId = (skill = "GN") => `NLD-${skill.slice(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

// ΓöÇΓöÇ In-memory state ΓöÇΓöÇ
const loginSecurity = {};
const sessionVersions = {};
const rateLimitLog = [];
const issuedCertificates = [];
const archives = [];
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const isAdmin = (role) => adminRoles.includes(role);

const rateLimitCheck = (ip, endpoint) => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const recent = rateLimitLog.filter((e) => e.ip === ip && e.endpoint === endpoint && e.at > cutoff);
  return recent.length >= RATE_LIMIT_MAX;
};

const rateLimitRecord = (ip, endpoint) => {
  rateLimitLog.push({ ip, endpoint, at: Date.now() });
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  while (rateLimitLog.length > 0 && rateLimitLog[0].at < cutoff) rateLimitLog.shift();
};

const users = [
  { id: "EMP-1001", name: "Aarav Menon",  email: "aarav@nalanda.local",  passwordHash: bcrypt.hashSync("Password@123", 10), department: "Sales",       role: "Manager",    managerId: "EMP-1288", status: "Active", createdAt: now() },
  { id: "EMP-1034", name: "Diya Sharma",  email: "diya@nalanda.local",   passwordHash: bcrypt.hashSync("Password@123", 10), department: "Engineering", role: "Employee",   managerId: "EMP-1102", status: "Active", createdAt: now() },
  { id: "EMP-1102", name: "Kabir Sethi",  email: "kabir@nalanda.local",  passwordHash: bcrypt.hashSync("Password@123", 10), department: "Engineering", role: "Manager",    managerId: "EMP-1288", status: "Active", createdAt: now() },
  { id: "EMP-1288", name: "Nisha Rao",    email: "admin@nalanda.local",  passwordHash: bcrypt.hashSync("Password@123", 10), department: "People Ops",  role: "Admin",      managerId: null,       status: "Active", createdAt: now() },
  { id: "EMP-0001", name: "Super Admin",  email: "super@nalanda.local",  passwordHash: bcrypt.hashSync("Password@123", 10), department: "Platform",    role: "Super Admin",managerId: null,       status: "Active", createdAt: now() },
];

const courses = [
  { id: "NLD-SC-2048", title: "Secure Coding for Cloud Teams",       description: "Threat modeling, OWASP controls, and secure release patterns.", skill: "Security",   tags: ["OWASP","Cloud"],    contentTypes: ["PDF","Rich Text","Video Link"],  approval: "Approved", status: "Active", ownerId: "EMP-1288", version: 3, createdAt: now(), updatedAt: now() },
  { id: "NLD-LD-1130", title: "Manager Essentials: Feedback Systems", description: "Coaching rituals and measurable development plans.",             skill: "Leadership", tags: ["People","Coaching"], contentTypes: ["Rich Text","Uploaded Video"], approval: "Pending",  status: "Active", ownerId: "EMP-1001", version: 1, createdAt: now(), updatedAt: now() },
];

const assessments = [
  { id: "ASM-9001", title: "Secure Release Readiness",  courseId: "NLD-SC-2048", type: "Timed Quiz",   approval: "Approved", strictMode: true, questions: [{ id: "Q1", type: "MCQ",         prompt: "Best control for leaked API key prevention?", options: ["Manual approval","CI secret scanning","Newsletter","Post audit"], answer: 1 }], durationMinutes: 45, passScore: 80, ownerId: "EMP-1288", createdAt: now() },
  { id: "ASM-9038", title: "Feedback Scenario Review",  courseId: "NLD-LD-1130", type: "Descriptive",  approval: "Pending",  strictMode: true, questions: [{ id: "Q1", type: "Descriptive", prompt: "Write feedback for a missed target using SBI." }],                                                                                       durationMinutes: 60, passScore: 70, ownerId: "EMP-1001", createdAt: now() },
];

const assignments = [
  { id: uuid(), courseId: "NLD-SC-2048", userId: "EMP-1034", assignedBy: "EMP-1102", progress: 76, timeSpentSeconds: 11200, completedAt: null, createdAt: now() },
];

const attempts = [];
const proctoringLogs = [];
const auditLogs = [];

let settings = { fullscreenRequired: true, cameraRequired: true, microphoneRequired: true, tabSwitchAutoSubmit: true, noiseThreshold: 70, maxAssessmentFlags: 2 };

const publicUser = (user) => { const { passwordHash, ...safe } = user; return safe; };

const audit = async (actorId, action, entityType, entityId, metadata = {}) => {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata }
    });
  } catch (e) {
    console.error("Audit error:", e);
  }
  // Still unshift to mock logs for legacy routes that view them in-memory
  auditLogs.unshift({ id: uuid(), actorId, action, entityType, entityId, metadata, createdAt: now() });
};

const signToken = (user) => {
  const sv = sessionVersions[user.id] || 0;
  return jwt.sign({ sub: user.id, role: user.role, department: user.department, sv }, JWT_SECRET, { expiresIn: "30m" });
};

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    
    // Attempt to find user in Prisma first
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    
    if (!user) {
      // Fallback to mock users for legacy compatibility
      const mockUser = users.find((item) => item.id === payload.sub);
      if (!mockUser) return res.status(401).json({ error: "Unknown user" });
      req.user = mockUser;
    } else {
      if (user.status !== "Active") return res.status(401).json({ error: "Account deactivated" });
      req.user = user;
    }
    
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireRole = (...allowed) => (req, res, next) => {
  const effective = req.user.role === "Super Admin" && allowed.includes("Admin") ? true : allowed.includes(req.user.role);
  if (!effective) return res.status(403).json({ error: "Forbidden" });
  return next();
};

const canManageCourse = (user, course) => user.role === "Admin" || user.role === "Super Admin" || course.ownerId === user.id;

// ΓöÇΓöÇ Health check ΓÇö Render pings this ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, status: "ok", service: "Nalanda API", time: now(), env: process.env.NODE_ENV });
});

// ΓöÇΓöÇ Auth ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.post("/api/auth/login", async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (rateLimitCheck(ip, "/api/auth/login")) {
    return res.status(429).json({ error: "Too many login attempts. Please try again later." });
  }
  rateLimitRecord(ip, "/api/auth/login");
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email;

  // 1. Try Prisma first
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === "Active" && bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    await audit(user.id, "LOGIN", "AUTH", user.id);
    return res.json({ token: signToken(user), user: publicUser(user) });
  }

  // 2. Fallback to mock users
  const mockUser = users.find((item) => item.email === email && item.status === "Active");
  if (mockUser && bcrypt.compareSync(parsed.data.password, mockUser.passwordHash)) {
    await audit(mockUser.id, "LOGIN", "AUTH", mockUser.id);
    return res.json({ token: signToken(mockUser), user: publicUser(mockUser) });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), permissions: req.user.role });
});

// ΓöÇΓöÇ Users ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/users", authenticate, requireRole("Admin", "Manager"), async (req, res) => {
  const { department, role, status = "Active" } = req.query;
  
  // Fetch from Prisma
  let where = req.user.role === "Manager" ? { managerId: req.user.id } : {};
  const dbUsers = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
  
  // Combine with mock users (filtering for uniqueness)
  const dbUserIds = new Set(dbUsers.map(u => u.id));
  let visible = [
    ...dbUsers,
    ...users.filter(u => !dbUserIds.has(u.id) && (req.user.role === "Admin" || req.user.role === "Super Admin" || u.managerId === req.user.id))
  ];

  if (department) visible = visible.filter((user) => user.department === department);
  if (role) visible = visible.filter((user) => user.role === role);
  if (status !== "All") visible = visible.filter((user) => user.status === status);
  
  res.json({ data: visible.map(publicUser), total: visible.length });
});

app.post("/api/users", authenticate, requireRole("Admin"), async (req, res) => {
  const schema = z.object({ name: z.string().min(2), email: z.string().email(), department: z.string().min(2), role: z.enum(roles), managerId: z.string().nullable().optional(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const email = parsed.data.email;
  const existsInDb = await prisma.user.findUnique({ where: { email } });
  const existsInMock = users.find(u => u.email === email);
  
  if (existsInDb || existsInMock) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const id = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
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
});

app.patch("/api/users/:id", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ name: z.string().min(2).optional(), department: z.string().min(2).optional(), role: z.enum(roles).optional(), managerId: z.string().nullable().optional(), status: z.enum(["Active", "Inactive"]).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (parsed.data.status === "Inactive" && user.status === "Active") {
    sessionVersions[user.id] = (sessionVersions[user.id] || 0) + 1;
  }
  Object.assign(user, parsed.data);
  audit(req.user.id, "UPDATE_USER", "USER", user.id, parsed.data);
  res.json({ data: publicUser(user) });
});

app.patch("/api/users/:id/status", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ status: z.enum(["Active", "Inactive"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (parsed.data.status === "Inactive" && user.status === "Active") {
    sessionVersions[user.id] = (sessionVersions[user.id] || 0) + 1;
  }
  user.status = parsed.data.status;
  audit(req.user.id, "CHANGE_USER_STATUS", "USER", user.id, parsed.data);
  res.json({ data: publicUser(user), note: "Session revoked if inactivated." });
});

app.delete("/api/users/:id", authenticate, requireRole("Super Admin"), (req, res) => {
  const schema = z.object({ deletionComment: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const idx = users.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  const user = users[idx];
  sessionVersions[user.id] = (sessionVersions[user.id] || 0) + 1;
  archives.unshift({ id: uuid(), entityType: "User", entityId: user.id, entityData: user, deletedBy: req.user.id, deletedByName: req.user.name, deletionComment: parsed.data.deletionComment, deletedAt: now() });
  users.splice(idx, 1);
  audit(req.user.id, "DELETE_USER", "USER", user.id);
  res.json({ success: true, message: "User permanently deleted and archived" });
});

// ΓöÇΓöÇ Courses ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/courses", authenticate, (req, res) => {
  const { skill, approval, status = "Active" } = req.query;
  let visible = courses;
  if (req.user.role === "Manager") visible = visible.filter((c) => c.ownerId === req.user.id || c.approval === "Approved");
  if (req.user.role === "Employee") visible = visible.filter((c) => c.approval === "Approved" && c.status === "Active");
  if (skill) visible = visible.filter((c) => c.skill === skill);
  if (approval) visible = visible.filter((c) => c.approval === approval);
  if (status !== "All") visible = visible.filter((c) => c.status === status);
  res.json({ data: visible, total: visible.length });
});

app.post("/api/courses", authenticate, requireRole("Admin", "Manager"), upload.fields([{ name: "pdf" }, { name: "video" }]), (req, res) => {
  const body = typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body;
  const schema = z.object({ title: z.string().min(4), description: z.string().min(10), skill: z.string().min(2), tags: z.array(z.string()).default([]), contentTypes: z.array(z.string()).default(["Rich Text"]) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const course = { id: nextCourseId(parsed.data.skill), ...parsed.data, approval: isAdmin(req.user.role) ? "Approved" : "Pending", status: "Active", ownerId: req.user.id, version: 1, createdAt: now(), updatedAt: now(), storage: { files: Object.keys(req.files || {}) } };
  courses.unshift(course);
  audit(req.user.id, "CREATE_COURSE", "COURSE", course.id, { approval: course.approval });
  res.status(201).json({ data: course });
});

app.put("/api/courses/:id", authenticate, requireRole("Admin", "Manager"), (req, res) => {
  const course = courses.find((item) => item.id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });
  if (!canManageCourse(req.user, course)) return res.status(403).json({ error: "Forbidden" });
  Object.assign(course, req.body, { version: course.version + 1, approval: isAdmin(req.user.role) ? "Approved" : "Pending", updatedAt: now() });
  audit(req.user.id, "UPDATE_COURSE", "COURSE", course.id, { version: course.version });
  res.json({ data: course });
});

app.post("/api/courses/:id/duplicate", authenticate, requireRole("Admin", "Manager"), (req, res) => {
  const source = courses.find((item) => item.id === req.params.id);
  if (!source) return res.status(404).json({ error: "Course not found" });
  const copy = { ...source, id: nextCourseId(source.skill), title: `${source.title} Copy`, approval: isAdmin(req.user.role) ? "Approved" : "Pending", ownerId: req.user.id, version: 1, createdAt: now(), updatedAt: now() };
  courses.unshift(copy);
  audit(req.user.id, "DUPLICATE_COURSE", "COURSE", copy.id, { sourceId: source.id });
  res.status(201).json({ data: copy });
});

app.patch("/api/courses/:id/approval", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ approval: z.enum(["Approved", "Rejected"]), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const course = courses.find((item) => item.id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });
  course.approval = parsed.data.approval;
  if (parsed.data.approval === "Rejected") course.status = "Inactive";
  audit(req.user.id, "COURSE_APPROVAL", "COURSE", course.id, parsed.data);
  res.json({ data: course });
});

app.patch("/api/courses/:id/status", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ status: z.enum(["Active", "Inactive"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const course = courses.find((item) => item.id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });
  course.status = parsed.data.status;
  audit(req.user.id, "COURSE_STATUS", "COURSE", course.id, parsed.data);
  res.json({ data: course });
});

app.delete("/api/courses/:id", authenticate, requireRole("Super Admin"), (req, res) => {
  const schema = z.object({ deletionComment: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const idx = courses.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Course not found" });
  const course = courses[idx];
  archives.unshift({ id: uuid(), entityType: "Course", entityId: course.id, entityData: course, deletedBy: req.user.id, deletedByName: req.user.name, deletionComment: parsed.data.deletionComment, deletedAt: now() });
  courses.splice(idx, 1);
  audit(req.user.id, "DELETE_COURSE", "COURSE", course.id);
  res.json({ success: true, message: "Course permanently deleted and archived" });
});

// ΓöÇΓöÇ Assignments ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.post("/api/assignments", authenticate, requireRole("Admin", "Manager"), (req, res) => {
  const schema = z.object({ courseId: z.string(), userIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = parsed.data.userIds.map((userId) => ({ id: uuid(), courseId: parsed.data.courseId, userId, assignedBy: req.user.id, progress: 0, timeSpentSeconds: 0, completedAt: null, createdAt: now() }));
  assignments.push(...created);
  audit(req.user.id, "ASSIGN_COURSE", "COURSE", parsed.data.courseId, { count: created.length });
  res.status(201).json({ data: created });
});

app.get("/api/assignments", authenticate, (req, res) => {
  let visible = assignments;
  if (req.user.role === "Employee") visible = visible.filter(a => a.userId === req.user.id);
  if (req.user.role === "Manager") {
    const teamIds = new Set(users.filter(u => u.managerId === req.user.id).map(u => u.id));
    visible = visible.filter(a => teamIds.has(a.userId) || a.userId === req.user.id);
  }
  res.json({ data: visible, total: visible.length });
});

// ΓöÇΓöÇ Assessments ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/assessments", authenticate, (req, res) => {
  let visible = assessments;
  if (req.user.role === "Manager") visible = visible.filter((item) => item.ownerId === req.user.id || item.approval === "Approved");
  if (req.user.role === "Employee") visible = visible.filter((item) => item.approval === "Approved");
  res.json({ data: visible, total: visible.length });
});

app.post("/api/assessments", authenticate, requireRole("Admin", "Manager"), (req, res) => {
  const schema = z.object({ title: z.string().min(4), courseId: z.string(), type: z.enum(["MCQ", "Descriptive", "Timed Quiz"]), strictMode: z.boolean().default(true), questions: z.array(z.record(z.string(), z.any())).min(1), durationMinutes: z.number().min(1), passScore: z.number().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const assessment = { id: `ASM-${Math.floor(1000 + Math.random() * 9000)}`, ...parsed.data, approval: isAdmin(req.user.role) ? "Approved" : "Pending", ownerId: req.user.id, createdAt: now() };
  assessments.unshift(assessment);
  audit(req.user.id, "CREATE_ASSESSMENT", "ASSESSMENT", assessment.id, { approval: assessment.approval });
  res.status(201).json({ data: assessment });
});

app.patch("/api/assessments/:id/approval", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ approval: z.enum(["Approved", "Rejected"]), feedback: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const assessment = assessments.find((item) => item.id === req.params.id);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });
  assessment.approval = parsed.data.approval;
  audit(req.user.id, "ASSESSMENT_APPROVAL", "ASSESSMENT", assessment.id, parsed.data);
  res.json({ data: assessment });
});

app.patch("/api/assessments/:id/status", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ status: z.enum(["Active", "Inactive"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const assessment = assessments.find((item) => item.id === req.params.id);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });
  assessment.status = parsed.data.status;
  audit(req.user.id, "ASSESSMENT_STATUS", "ASSESSMENT", assessment.id, parsed.data);
  res.json({ data: assessment });
});

app.delete("/api/assessments/:id", authenticate, requireRole("Super Admin"), (req, res) => {
  const schema = z.object({ deletionComment: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const idx = assessments.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Assessment not found" });
  const assessment = assessments[idx];
  archives.unshift({ id: uuid(), entityType: "Assessment", entityId: assessment.id, entityData: assessment, deletedBy: req.user.id, deletedByName: req.user.name, deletionComment: parsed.data.deletionComment, deletedAt: now() });
  assessments.splice(idx, 1);
  audit(req.user.id, "DELETE_ASSESSMENT", "ASSESSMENT", assessment.id);
  res.json({ success: true, message: "Assessment permanently deleted and archived" });
});

// ΓöÇΓöÇ Assessment Attempts ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.post("/api/assessments/:id/attempts/start", authenticate, (req, res) => {
  const assessment = assessments.find((item) => item.id === req.params.id && item.approval === "Approved");
  if (!assessment) return res.status(404).json({ error: "Approved assessment not found" });
  const attempt = { id: uuid(), assessmentId: assessment.id, userId: req.user.id, startedAt: now(), submittedAt: null, status: "InProgress", score: null, flags: [] };
  attempts.unshift(attempt);
  audit(req.user.id, "START_ATTEMPT", "ASSESSMENT_ATTEMPT", attempt.id);
  res.status(201).json({ data: attempt, strictRules: assessment.strictMode ? settings : null });
});

app.post("/api/assessments/attempts/:attemptId/submit", authenticate, (req, res) => {
  const attempt = attempts.find((item) => item.id === req.params.attemptId && item.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  const assessment = assessments.find((item) => item.id === attempt.assessmentId);
  const mcqQuestions = assessment.questions.filter((q) => q.type === "MCQ");
  const mcqScore = mcqQuestions.length ? Math.round((mcqQuestions.filter((q) => req.body.answers?.[q.id] === q.answer).length / mcqQuestions.length) * 100) : null;
  Object.assign(attempt, { submittedAt: now(), status: mcqScore === null ? "PendingManualReview" : "Submitted", score: mcqScore });
  audit(req.user.id, "SUBMIT_ATTEMPT", "ASSESSMENT_ATTEMPT", attempt.id, { score: mcqScore });
  res.json({ data: attempt, feedback: mcqScore === null ? "Manual evaluation required" : mcqScore >= assessment.passScore ? "Passed" : "Needs improvement" });
});

// ΓöÇΓöÇ Proctoring ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.post("/api/proctoring/events", authenticate, (req, res) => {
  const schema = z.object({ attemptId: z.string(), eventType: z.enum(["FULLSCREEN_EXIT","TAB_SWITCH","NOISE","CAMERA_OFF","MIC_OFF","FACE_MISMATCH"]), severity: z.enum(["low","medium","high"]), metadata: z.record(z.string(), z.any()).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const event = { id: uuid(), userId: req.user.id, ...parsed.data, createdAt: now() };
  proctoringLogs.unshift(event);
  const attempt = attempts.find((item) => item.id === parsed.data.attemptId);
  if (attempt) attempt.flags.push(event);
  if (settings.tabSwitchAutoSubmit && parsed.data.eventType === "TAB_SWITCH" && attempt) Object.assign(attempt, { status: "AutoSubmitted", submittedAt: now() });
  audit(req.user.id, "PROCTORING_EVENT", "PROCTORING_LOG", event.id, { eventType: event.eventType });
  res.status(201).json({ data: event, autoSubmitted: attempt?.status === "AutoSubmitted" });
});

// ΓöÇΓöÇ Analytics ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/analytics/global", authenticate, requireRole("Admin"), (_req, res) => {
  res.json({ users: users.length, activeUsers: users.filter((u) => u.status === "Active").length, courses: courses.length, approvedCourses: courses.filter((c) => c.approval === "Approved").length, completionRate: 78, averageScore: 86, topPerformers: ["Diya Sharma","Nisha Rao"], lowPerformers: ["Rohan Das"] });
});

app.get("/api/analytics/team", authenticate, requireRole("Manager"), (req, res) => {
  const team = users.filter((u) => u.managerId === req.user.id);
  res.json({ managerId: req.user.id, members: team.map(publicUser), completionRate: 74, skillGaps: ["Secure coding","Data storytelling"], engagement: "Medium-high" });
});

app.get("/api/analytics/me", authenticate, (req, res) => {
  res.json({ userId: req.user.id, progress: 76, completedCourses: 9, pendingCourses: 3, strengths: ["Communication","Compliance"], weaknesses: ["Secure coding"], suggestions: ["Complete Secure Coding for Cloud Teams","Retake practice quiz"] });
});

// ΓöÇΓöÇ Reports ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.post("/api/reports/export", authenticate, requireRole("Admin", "Manager"), (req, res) => {
  const schema = z.object({ format: z.enum(["PDF","Excel"]), reportType: z.enum(["User","Team","Course"]), filters: z.record(z.string(), z.any()).default({}) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const report = { id: uuid(), requestedBy: req.user.id, status: "Ready", downloadUrl: `/exports/${uuid()}.${parsed.data.format === "PDF" ? "pdf" : "xlsx"}`, ...parsed.data, createdAt: now() };
  audit(req.user.id, "EXPORT_REPORT", "REPORT", report.id, parsed.data);
  res.status(202).json({ data: report });
});

// ΓöÇΓöÇ Certificates ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/certificates", authenticate, (req, res) => {
  let visible = issuedCertificates;
  if (req.user.role === "Manager") {
    const teamIds = new Set(users.filter((u) => u.managerId === req.user.id).map((u) => u.id));
    visible = visible.filter((cert) => cert.employeeId === req.user.id || teamIds.has(cert.employeeId));
  } else if (req.user.role === "Employee") {
    visible = visible.filter((cert) => cert.employeeId === req.user.id);
  }
  res.json({ data: visible, total: visible.length });
});

app.post("/api/certificates", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ employeeId: z.string(), courseId: z.string(), title: z.string().default("Certificate of Completion"), template: z.string().default("Executive"), accent: z.string().default("#0f766e"), duration: z.string().default(""), subtitle: z.string().default(""), footer: z.string().default(""), htmlSnapshot: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const employee = users.find((u) => u.id === parsed.data.employeeId);
  const course = courses.find((c) => c.id === parsed.data.courseId);
  if (!employee || !course) return res.status(404).json({ error: "Employee or Course not found" });
  const cert = { id: `CERT-${Math.floor(1000 + Math.random() * 9000)}`, ...parsed.data, issuedBy: req.user.id, issuedByName: req.user.name, issuedAt: now() };
  issuedCertificates.unshift(cert);
  audit(req.user.id, "ISSUE_CERTIFICATE", "CERTIFICATE", cert.id, { employeeId: cert.employeeId, courseId: cert.courseId });
  res.status(201).json({ data: cert });
});

// ΓöÇΓöÇ Archive (Super Admin only) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/archive", authenticate, requireRole("Super Admin"), (req, res) => {
  res.json({ data: archives, total: archives.length });
});

app.post("/api/archive/:id/restore", authenticate, requireRole("Super Admin"), (req, res) => {
  const idx = archives.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Archived record not found" });
  const record = archives[idx];
  if (record.entityType === "User") users.unshift(record.entityData);
  else if (record.entityType === "Course") courses.unshift(record.entityData);
  else if (record.entityType === "Assessment") assessments.unshift(record.entityData);
  archives.splice(idx, 1);
  audit(req.user.id, "RESTORE_ARCHIVE", record.entityType.toUpperCase(), record.entityId);
  res.json({ success: true, message: `${record.entityType} restored successfully` });
});

// ΓöÇΓöÇ Settings ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/settings", authenticate, requireRole("Admin"), (_req, res) => {
  res.json({ data: settings });
});

app.patch("/api/settings", authenticate, requireRole("Admin"), (req, res) => {
  const schema = z.object({ fullscreenRequired: z.boolean().optional(), cameraRequired: z.boolean().optional(), microphoneRequired: z.boolean().optional(), tabSwitchAutoSubmit: z.boolean().optional(), noiseThreshold: z.number().min(1).max(100).optional(), maxAssessmentFlags: z.number().min(0).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  settings = { ...settings, ...parsed.data };
  audit(req.user.id, "UPDATE_SETTINGS", "SETTINGS", "proctoring", parsed.data);
  res.json({ data: settings });
});

// ΓöÇΓöÇ Audit Logs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/audit-logs", authenticate, requireRole("Admin"), (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  res.json({ data: auditLogs.slice(0, limit), total: auditLogs.length });
});

// ΓöÇΓöÇ Global error handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ΓöÇΓöÇ Start server ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.listen(PORT, () => {
  console.log(`Γ£à Nalanda API listening on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
