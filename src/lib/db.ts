/**
 * Prisma client factory.
 *
 * - Local development: plain SQLite file (DATABASE_URL=file:...) — the
 *   classic query engine is used, exactly like before.
 * - Production (Vercel): DATABASE_URL is a libsql://... Turso URL, so the
 *   client is created through the official libSQL driver adapter
 *   (@prisma/adapter-libsql + @libsql/client).
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const url = process.env.DATABASE_URL ?? 'file:./db/custom.db'

/** Turso/libSQL URLs start with libsql:// (or https:// for the turso sqld). */
const isRemote = url.startsWith('libsql://') || url.startsWith('https://')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  if (isRemote) {
    const libsql = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
