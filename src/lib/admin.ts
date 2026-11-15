/**
 * Server-side admin authentication.
 *
 * The admin signs in with a secret "device id" (ADMIN_DEVICE_ID env var).
 * Every admin API call must carry it in the `x-admin-device` header so the
 * server re-validates on each request (no trusted client session).
 */

const HEADER = 'x-admin-device'

/** Parse the configured admin id(s) — supports one id or a comma-separated list. */
function configuredAdminIds(): string[] {
  const raw = process.env.ADMIN_DEVICE_ID ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Constant-time-ish equality for short strings (avoid trivial timing leaks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** True when the given device id matches the configured admin id(s). */
export function isAdminDevice(device: unknown): boolean {
  if (typeof device !== 'string' || device.length === 0 || device.length > 128) return false
  const ids = configuredAdminIds()
  if (ids.length === 0) return false
  return ids.some((id) => safeEqual(device, id))
}

/** Extract + validate the admin header from a request. */
export function adminFromRequest(req: Request): string | null {
  const device = req.headers.get(HEADER)
  return isAdminDevice(device) ? (device as string) : null
}

/** Standard 401 response for unauthorized admin calls. */
export function adminUnauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
