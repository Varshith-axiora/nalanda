import prisma from "./prisma.js";
import { v4 as uuid } from "uuid";

// We'll keep the in-memory log for now to avoid breaking legacy routes that might use it
export const auditLogs = [];

export const audit = async (actorId, action, entityType, entityId, metadata = {}) => {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata }
    });
  } catch (e) {
    console.error("Audit error:", e);
  }
  
  // Also push to in-memory for immediate legacy view if needed
  auditLogs.unshift({ 
    id: uuid(), 
    actorId, 
    action, 
    entityType, 
    entityId, 
    metadata, 
    createdAt: new Date().toISOString() 
  });
  
  // Keep memory usage in check
  if (auditLogs.length > 1000) auditLogs.pop();
};
