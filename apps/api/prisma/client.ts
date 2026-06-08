import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Raw, un-scoped client for CLI scripts (seed, reset-password). Prisma 7 requires
// a driver adapter and no longer auto-loads .env, hence the explicit setup here.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
