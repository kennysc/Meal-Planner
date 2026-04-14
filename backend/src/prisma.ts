import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { config } from './config'

const pool = new Pool({ connectionString: config.databaseUrl })
const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({ adapter })
