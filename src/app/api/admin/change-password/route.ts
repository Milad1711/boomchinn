import { NextResponse } from 'next/server'
import { adminChangePassword } from '@/lib/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/change-password
 * Body: { currentPassword, newPassword }
 * Stores the new admin password (scrypt-hashed) in the database.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { currentPassword?: unknown; newPassword?: unknown }
      | null
    const current = typeof body?.currentPassword === 'string' ? body.currentPassword.trim() : ''
    const next = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''
    if (!current || !next) {
      return NextResponse.json({ error: 'همه‌ی فیلدها را وارد کنید' }, { status: 400 })
    }
    const result = await adminChangePassword(current, next)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'تغییر رمز ناموفق بود' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('admin change-password POST failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
