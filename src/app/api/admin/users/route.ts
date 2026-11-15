import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { adminFromRequest, adminUnauthorized } from '@/lib/admin'

export const dynamic = 'force-dynamic'

interface AdminUserRow {
  id: string
  name: string
  coins: number
  totalStars: number
  createdAt: string
  updatedAt: string
}

/** Sum of star values inside the stored JSON. */
function sumStars(json: string): number {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const nums = Object.values(parsed).filter((v): v is number => typeof v === 'number')
    return nums.reduce((a, b) => a + b, 0)
  } catch {
    return 0
  }
}

/**
 * GET /api/admin/users
 * Headers: x-admin-device
 * Query: q (optional search in name / device id)
 * Returns all players (newest first) + aggregate stats for the admin panel.
 */
export async function GET(req: NextRequest) {
  if (!adminFromRequest(req)) return adminUnauthorized()

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()

  try {
    await ensureSchema()
    const rows = await db.playerProgress.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, coins: true, stars: true, createdAt: true, updatedAt: true },
    })

    const users: AdminUserRow[] = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        coins: r.coins,
        totalStars: sumStars(r.stars),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
      .filter((u) => {
        if (!q) return true
        return u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
      })

    const stats = {
      players: rows.length,
      coins: rows.reduce((a, r) => a + r.coins, 0),
    }

    return NextResponse.json({ ok: true, stats, users })
  } catch (err) {
    console.error('admin users GET failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
