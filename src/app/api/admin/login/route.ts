import { NextResponse } from 'next/server'
import { adminLogin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/login
 * Body: { password } — validates the admin password.
 * Responds { ok, mustChange }: mustChange=true while the initial
 * ADMIN_PASSWORD is still in use, so the panel forces a password change.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { password?: unknown } | null
    const password = typeof body?.password === 'string' ? body.password.trim() : ''
    if (!password) {
      return NextResponse.json({ error: 'رمز مدیر را وارد کنید' }, { status: 400 })
    }
    const result = await adminLogin(password)
    if (!result.ok) {
      // small delay to blunt brute-force attempts
      await new Promise((resolve) => setTimeout(resolve, 400))
      return NextResponse.json({ error: 'رمز مدیر اشتباه است' }, { status: 401 })
    }
    return NextResponse.json({ ok: true, mustChange: result.mustChange })
  } catch (err) {
    console.error('admin login POST failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
