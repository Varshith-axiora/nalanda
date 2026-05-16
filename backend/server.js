import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";

// Import route modules
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import courseRoutes from "./routes/courses.js";
import assignmentRoutes from "./routes/assignments.js";
import assessmentRoutes from "./routes/assessments.js";
import skillsRoutes from "./routes/skills.js";
import analyticsRoutes from "./routes/analytics.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──
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

// ── Health Check ──
app.get("/api/health", (_req, res) => {
  res.status(200).json({ 
    ok: true, 
    status: "ok", 
    service: "Nalanda API", 
    time: new Date().toISOString(), 
    env: process.env.NODE_ENV 
  });
});

// ── Route Registration ──
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", adminRoutes); // Handles /audit-logs, /archive, etc.

// ── Global Error Handler ──
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`✅ Nalanda API listening on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});
