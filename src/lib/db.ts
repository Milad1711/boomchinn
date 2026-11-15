/**
 * Prisma client factory.
 *
 * - Local development: plain SQLite file (DATABASE_URL=file:...) — the
 *   classic query engine is used, exactly like before.
 * - Production (Vercel): DATABASE_URL is a libsql://... Turso URL, so the
 *   client is created through the official libSQL driver adapter
 *   (@prisma/adapter-libsql + @libsql/client).
 *
 * The module also exposes ensureSchema(): an idempotent bootstrap that
 * creates the tables on a brand-new database (e.g. a freshly created Turso
 * database) so deploying to Vercel + Turso needs no manual migration step.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const url = process.env.DATABASE_URL ?? 'file:./db/custom.db'

/** Turso/libSQL URLs start with libsql:// (or https:// for the turso sqld). */
const isRemote = url.startsWith('libsql://') || url.startsWith('https://')

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  if (isRemote) {
    // The adapter builds and owns the libSQL client itself (config-based API).
    const adapter = new PrismaLibSQL({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/* ------------------------------------------------------------------ */
/* Schema bootstrap — auto-creates tables on an empty (cloud) database */
/* ------------------------------------------------------------------ */

/**
 * Mirrors prisma/schema.prisma exactly (generated with `prisma migrate diff
 * --from-empty`). Every statement is idempotent (IF NOT EXISTS), so running
 * it on an existing database is a harmless no-op.
 */
const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS "PlayerProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "coins" INTEGER NOT NULL DEFAULT 100,
    "stars" TEXT NOT NULL DEFAULT '{}',
    "bestScores" TEXT NOT NULL DEFAULT '{}',
    "items" TEXT NOT NULL DEFAULT '{}',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
]

const globalForSchema = globalThis as unknown as {
  boomchinSchemaReady: Promise<void> | null | undefined
}

/**
 * Ensures the database has all required tables. Called at the top of every
 * API route; the work is done at most once per server instance and retried
 * on the next request if it failed.
 */
export function ensureSchema(): Promise<void> {
  globalForSchema.boomchinSchemaReady ??= (async () => {
    try {
      for (const stmt of BOOTSTRAP_SQL) {
        await db.$executeRawUnsafe(stmt)
      }
    } catch (err) {
      // allow a retry on the next request (e.g. transient network error)
      globalForSchema.boomchinSchemaReady = null
      throw err
    }
  })()
  return globalForSchema.boomchinSchemaReady
}
