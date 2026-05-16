import jwt from "jsonwebtoken";
import prisma from "./prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const adminRoles = ["Super Admin", "Admin"];

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing bearer token" });
  
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    
    // Attempt to find user in Prisma
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    
    if (!user) {
      return res.status(401).json({ error: "Unknown user" });
    }
    
    if (user.status !== "Active") {
      return res.status(401).json({ error: "Account deactivated" });
    }
    
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (...allowed) => (req, res, next) => {
  const effective = req.user.role === "Super Admin" && allowed.includes("Admin") ? true : allowed.includes(req.user.role);
  if (!effective) return res.status(403).json({ error: "Forbidden" });
  return next();
};

export const isAdmin = (role) => adminRoles.includes(role);

export const signToken = (user) => {
  // Use session version from DB if available, else default to 0
  const sv = user.sessionVersion || 0;
  return jwt.sign(
    { sub: user.id, role: user.role, department: user.department, sv }, 
    JWT_SECRET, 
    { expiresIn: "30m" }
  );
};
