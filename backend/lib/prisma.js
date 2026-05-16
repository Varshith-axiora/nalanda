import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : { rejectUnauthorized: false } // Keeping it true for now as Supabase requires it
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
export default prisma;
