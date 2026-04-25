import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(4000),
})

const env = envSchema.parse(process.env)

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
}
