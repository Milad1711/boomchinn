import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * GET /api/leaderboard?playerId=...&limit=50
 *
 * Competition ranking for بوم چین: every saved player is ranked by
 * total stars first, then total best score. Returns the top entries
 * plus the requesting player's own row with its real rank.
 */

interface LeaderRow {
  rank: number
  id: string
  name: string
  totalStars: number
  totalScore: number
  levels: number // levels cleared (>= 1 star)
}

const MAX_LIMIT = 100

function parseJsonMap(raw: string): Record<string, number> {
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v)
      if (Number.isFinite(n)) out[k] = n
    }
    return out
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get('playerId') ?? ''
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Math.min(MAX_LIMIT, Math.max(10, Math.round(Number.isFinite(limitParam) ? limitParam : 50)))

  try {
    await ensureSchema()
    const rows = await db.playerProgress.findMany({
      select: { id: true, name: true, stars: true, bestScores: true },
    })

    const scored: LeaderRow[] = rows.map((r) => {
      const stars = parseJsonMap(r.stars)
      const scores = parseJsonMap(r.bestScores)
      const starValues = Object.values(stars)
      const totalStars = starValues.reduce((a, b) => a + b, 0)
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
      const levels = starValues.filter((s) => s > 0).length
      return { rank: 0, id: r.id, name: r.name, totalStars, totalScore, levels }
    })

    // rank: stars desc, then score desc, then name for stable ordering
    scored.sort(
      (a, b) =>
        b.totalStars - a.totalStars ||
        b.totalScore - a.totalScore ||
        a.name.localeCompare(b.name, 'fa') ||
        a.id.localeCompare(b.id)
    )
    scored.forEach((row, i) => {
      row.rank = i + 1
    })

    const top = scored.slice(0, limit)
    const mine = playerId ? (scored.find((r) => r.id === playerId) ?? null) : null

    return NextResponse.json({
      top,
      me: mine,
      total: scored.length,
    })
  } catch (err) {
    console.error('leaderboard GET failed', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
