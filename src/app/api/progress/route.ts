import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ProgressBody {
  playerId?: string
  name?: string
  coins?: number
  stars?: Record<string, number>
  bestScores?: Record<string, number>
  items?: Record<string, unknown>
  settings?: Record<string, unknown>
}

/** Sanitize a display name: trimmed, no control/zero-width chars, max 20 code points. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .trim()
  const chars = [...cleaned]
  return chars.slice(0, 20).join('')
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
      name: row.name,
      coins: row.coins,
      stars: JSON.parse(row.stars),
      bestScores: JSON.parse(row.bestScores),
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
    bestScores: JSON.stringify(body.bestScores ?? {}),
    items: JSON.stringify(body.items ?? {}),
    settings: JSON.stringify(body.settings ?? {}),
  }
  const name = sanitizeName(body.name)
  try {
    await db.playerProgress.upsert({
      where: { id: body.playerId },
      // on create store whatever name we got (may be empty);
      // on update only overwrite the name when a non-empty one arrives
      // so another device cannot wipe it with an empty payload.
      create: { id: body.playerId, name, ...data },
      update: name ? { ...data, name } : data,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('progress POST failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
