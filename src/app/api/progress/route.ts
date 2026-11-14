import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ProgressBody {
  playerId?: string
  coins?: number
  stars?: Record<string, number>
  items?: Record<string, unknown>
  settings?: Record<string, unknown>
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get('playerId')
  if (!playerId || playerId.length > 64) {
    return NextResponse.json({ error: 'playerId required' }, { status: 400 })
  }
  try {
    const row = await db.playerProgress.findUnique({ where: { id: playerId } })
    if (!row) return NextResponse.json({ found: false })
    return NextResponse.json({
      found: true,
      coins: row.coins,
      stars: JSON.parse(row.stars),
      items: JSON.parse(row.items),
      settings: JSON.parse(row.settings),
    })
  } catch (err) {
    console.error('progress GET failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ProgressBody | null
  if (!body || !body.playerId || body.playerId.length > 64) {
    return NextResponse.json({ error: 'playerId required' }, { status: 400 })
  }
  const data = {
    coins: clampInt(body.coins, 0, 10_000_000, 100),
    stars: JSON.stringify(body.stars ?? {}),
    items: JSON.stringify(body.items ?? {}),
    settings: JSON.stringify(body.settings ?? {}),
  }
  try {
    await db.playerProgress.upsert({
      where: { id: body.playerId },
      create: { id: body.playerId, ...data },
      update: data,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('progress POST failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
