/**
 * Server-side admin authentication — password based.
 *
 * - The very first password is the ADMIN_PASSWORD environment variable (with
 *   a built-in fallback so local dev works with zero configuration).
 * - While that initial password is still in use, the panel forces the admin
 *   to change it; the new password is stored hashed (scrypt + random salt)
 *   in the AdminSetting table of the game database.
 * - Every admin API call must carry the current password in the
 *   `x-admin-password` header, so the server re-validates on each request.
 */
import crypto from 'crypto'
import { db, ensureSchema } from '@/lib/db'

export const ADMIN_HEADER = 'x-admin-password'

/** Initial password — used until the admin changes it (UI enforces that). */
function defaultAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? 'boomchin-1404').trim()
}

/* --------------------------------------------------------------- hashing */

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}

/* ---------------------------------------------------------- stored state */

interface StoredRow {
  value: string
}

/** Reads the hashed custom password from the DB (null while still default). */
async function storedHash(): Promise<string | null> {
  await ensureSchema()
  const rows = await db.$queryRawUnsafe<StoredRow[]>(
    `SELECT "value" FROM "AdminSetting" WHERE "key" = 'admin_password' LIMIT 1`
  )
  return rows[0]?.value ?? null
}

/* ---------------------------------------------------------------- checks */

/** True when the request carries a valid admin password header. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const pw = req.headers.get(ADMIN_HEADER)
  if (!pw || pw.length === 0 || pw.length > 128) return false
  const hash = await storedHash()
  return hash ? verifyPassword(pw, hash) : pw === defaultAdminPassword()
}

/** Sign-in check. mustChange is true while the initial password is in use. */
export async function adminLogin(password: string): Promise<{ ok: boolean; mustChange: boolean }> {
  const hash = await storedHash()
  if (hash) return { ok: verifyPassword(password, hash), mustChange: false }
  return { ok: password === defaultAdminPassword(), mustChange: true }
}

/** Validates the current password, then stores the new one hashed. */
export async function adminChangePassword(
  current: string,
  next: string
): Promise<{ ok: boolean; error?: string }> {
  if (next.length < 4) return { ok: false, error: 'رمز جدید باید حداقل ۴ کاراکتر باشد' }
  if (next.length > 128) return { ok: false, error: 'رمز جدید خیلی بلند است' }
  const hash = await storedHash()
  const currentValid = hash ? verifyPassword(current, hash) : current === defaultAdminPassword()
  if (!currentValid) return { ok: false, error: 'رمز فعلی اشتباه است' }
  if (hash && verifyPassword(next, hash)) {
    return { ok: false, error: 'رمز جدید باید با رمز فعلی متفاوت باشد' }
  }
  await db.$executeRawUnsafe(
    `INSERT INTO "AdminSetting" ("key", "value") VALUES ('admin_password', ?)
     ON CONFLICT("key") DO UPDATE SET "value" = "excluded"."value"`,
    hashPassword(next)
  )
  return { ok: true }
}

/** Standard 401 response for unauthorized admin calls. */
export function adminUnauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
