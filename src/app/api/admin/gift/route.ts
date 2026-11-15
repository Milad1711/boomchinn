import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db, ensureSchema } from '@/lib/db'
import { isAdminRequest, adminUnauthorized } from '@/lib/admin'

export const dynamic = 'force-dynamic'

interface GiftBody {
  playerId?: string
  coins?: number
}

/** Same upper bound the client progress-sync uses, so gifted coins survive syncs. */
const MAX_GIFT = 10_000_000

/**
 * POST /api/admin/gift
 * Headers: x-admin-password
 * Body: { playerId, coins } — adds `coins` (1..10,000,000) to the player.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return adminUnauthorized()

  const body = (await req.json().catch(() => null)) as GiftBody | null
  const playerId = body?.playerId
  const amount = body?.coins

  if (!playerId || typeof playerId !== 'string' || playerId.length > 64) {
    return NextResponse.json({ error: 'playerId required' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: 'مقدار سکه باید عددی بزرگ‌تر از صفر باشد' }, { status: 400 })
  }
  const gift = Math.min(Math.round(amount), MAX_GIFT)

  try {
    await ensureSchema()
    const row = await db.playerProgress.update({
      where: { id: playerId },
      data: { coins: { increment: gift } },
      select: { id: true, name: true, coins: true },
    })
    return NextResponse.json({ ok: true, player: row, gifted: gift })
  } catch (err) {
    // player id does not exist in the database (P2025 = record not found)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'بازیکن پیدا نشد' }, { status: 404 })
    }
    console.error('admin gift POST failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
