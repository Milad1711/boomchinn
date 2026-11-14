/**
 * بوم چین (STACK & SMASH) — 105 levels in three difficulty bands.
 *  - #1–10:  handcrafted tutorial arc.
 *  - #11–105: deterministic procedural generation (seeded PRNG → identical
 *             results on server and client, so SSR hydration never breaks).
 *
 * Difficulty bands (1-based):
 *  - #1–29  : easy   — small trays, few weak obstacles, generous missiles.
 *  - #30–59 : medium — bigger trays, crystal walls, tighter missile budget.
 *  - #60–105: hard   — large trays, stone fortresses, long merge chains.
 *
 * Design rules:
 *  - Levels are LONG: goals require real chains, not one or two merges.
 *  - `autoSpawn` keeps dropping fresh items so the board never dead-ends.
 *  - Clear-goal levels always get noticeably more missiles than needed.
 */
import { faNum } from '@/lib/format'
import {
  TIERS,
  MISSILE_DMG,
  type LevelDef,
  type LevelGoal,
  type ObstacleDef,
  type ObstacleKind,
  type SpawnDef,
} from './types'

export const TOTAL_LEVELS = 105
export const MEDIUM_FROM = 30 // 1-based: first medium level
export const HARD_FROM = 60 // 1-based: first hard level

export type Difficulty = 'easy' | 'medium' | 'hard'

/** 0-based index → difficulty band. */
export function difficultyOf(levelIndex: number): Difficulty {
  if (levelIndex < MEDIUM_FROM - 1) return 'easy'
  if (levelIndex < HARD_FROM - 1) return 'medium'
  return 'hard'
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'آسان',
  medium: 'متوسط',
  hard: 'سخت',
}

/** Chapters shown on the level-select screen. */
export interface ChapterDef {
  name: string
  /** 1-based inclusive range */
  from: number
  to: number
  difficulty: Difficulty
}

export const CHAPTERS: ChapterDef[] = [
  { name: 'فصل ۱ — بچین', from: 1, to: MEDIUM_FROM - 1, difficulty: 'easy' },
  { name: 'فصل ۲ — ادغام کن', from: MEDIUM_FROM, to: HARD_FROM - 1, difficulty: 'medium' },
  { name: 'فصل ۳ — بشکن!', from: HARD_FROM, to: TOTAL_LEVELS, difficulty: 'hard' },
]

// ------------------------------------------------------------------- helpers

/** Deterministic PRNG (mulberry32) — same sequence on every device. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = (r: () => number, min: number, max: number) => min + r() * (max - min)
const randInt = (r: () => number, min: number, max: number) => Math.floor(rand(r, min, max + 1))

const NAMES: string[] = [
  'برج مرجانی', 'جعبه‌های ناقلا', 'زنجیره‌ی عسلی', 'کارگاه بنفش', 'بلورهای پنهان',
  'کوبه‌ی سنگین', 'دشت مکعب‌ها', 'انبار شلوغ', 'قلعه‌ی چوبی', 'غار بلور',
  'فولاد و طلا', 'برج سنگی', 'آزمون زنجیره', 'طوفان مرجانی', 'سدهای دوقلو',
  'معمای بنفش', 'ستاره‌ساز', 'گنج بلورها', 'دیوار آجری', 'قلب سنگی',
  'ردیف مرجانی', 'آشوب رنگ‌ها', 'بمباران چوبی', 'زنجیره‌ی طلایی', 'خروش ماشین',
  'دوَازده کوب', 'برج نازک', 'چالش بلورین', 'شب کوبنده', 'فینال کوبنده',
]

function nameFor(index: number): string {
  return NAMES[(index - 10) % NAMES.length]
}

function guideFor(goal: LevelGoal, kinds: Set<ObstacleKind>): string {
  switch (goal.type) {
    case 'merge': {
      const t = goal.tier ?? 1
      const prev = TIERS[Math.max(0, t - 1)].name
      if (t >= 3)
        return `زنجیره را از پایین برو: دو «${prev}» بساز و ادغام کن، تا ${faNum(goal.count ?? 1)} عدد «${TIERS[t].name}» ساخته شود.`
      return `دو «${prev}» را روی هم بینداز تا ${faNum(goal.count ?? 1)} عدد «${TIERS[t].name}» بسازی.`
    }
    case 'clear': {
      const parts: string[] = []
      if (kinds.has('crate')) parts.push('جعبه ۱ موشک')
      if (kinds.has('crystal')) parts.push('بلور ۲ موشک')
      if (kinds.has('stone')) parts.push('سنگ ۲ موشک')
      return `همه‌ی موانع را نابود کن — ${parts.join('، ')} می‌خواهد.`
    }
    case 'score':
      return 'ادغام‌ها را پشت‌سرهم انجام بده تا زنجیره بسازی و به امتیاز خواسته برسی.'
  }
}

/** Perimeter slots for initial items (corners + edges, away from walls). */
function perimeterSlots(trayW: number, trayD: number): SpawnDef[] {
  const hw = trayW / 2 - 0.95
  const hd = trayD / 2 - 0.95
  return [
    { tier: 0, x: -hw, z: -hd },
    { tier: 0, x: 0, z: -hd },
    { tier: 0, x: hw, z: -hd },
    { tier: 0, x: -hw, z: 0 },
    { tier: 0, x: hw, z: 0 },
    { tier: 0, x: -hw, z: hd },
    { tier: 0, x: 0, z: hd },
    { tier: 0, x: hw, z: hd },
  ]
}

/** Tier mix for the initial items depending on the goal (keeps levels solvable). */
function spawnTiers(r: () => number, goal: LevelGoal, diff: Difficulty, slotCount: number): number[] {
  const tiers: number[] = []
  if (goal.type === 'merge') {
    const t = goal.tier ?? 1
    const c = goal.count ?? 1
    if (t >= 4) {
      // every high-tier seed saves an entire sub-chain
      for (let i = 0; i < Math.min(c, 2); i++) tiers.push(t - 1)
      if (slotCount - tiers.length >= 2) tiers.push(Math.max(1, t - 2))
    } else {
      const seeds = Math.max(1, Math.floor(c / 2))
      for (let i = 0; i < Math.min(seeds, slotCount - 3); i++) tiers.push(t - 1)
      if (t >= 3 && slotCount - tiers.length >= 2) tiers.push(t - 2)
    }
  } else if (diff === 'hard') {
    tiers.push(1)
    if (r() < 0.6) tiers.push(2)
  } else {
    tiers.push(1)
  }
  while (tiers.length < slotCount) tiers.push(0)
  return tiers
}

/** Scatter obstacles with deterministic rejection sampling (no overlaps). */
function placeObstacles(
  r: () => number,
  trayW: number,
  trayD: number,
  count: number,
  kinds: ObstacleKind[],
  hpMul: number,
  spawns: SpawnDef[]
): ObstacleDef[] {
  const out: ObstacleDef[] = []
  if (count <= 0 || kinds.length === 0) return out
  const hw = trayW / 2
  const hd = trayD / 2
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length]
    const w = kind === 'crate' ? rand(r, 1.1, 1.35) : rand(r, 0.9, 1.3)
    const h = kind === 'crystal' ? rand(r, 1.35, 1.65) : rand(r, 1.1, 1.4)
    const d = w
    const baseHp = kind === 'crate' ? 16 : kind === 'crystal' ? 26 : 32
    const hp = Math.max(12, Math.round((baseHp * hpMul) / 2) * 2) // even → predictable hits
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = rand(r, -(hw - 1.25), hw - 1.25)
      const z = rand(r, -(hd - 1.5), hd - 1.7)
      const clearOfSpawns = spawns.every((s) => Math.hypot(s.x - x, s.z - z) > 1.7)
      const clearOfOthers = out.every((o) => Math.hypot(o.x - x, o.z - z) > (o.w + w) / 2 + 1.1)
      if (clearOfSpawns && clearOfOthers) {
        out.push({ x, z, w, h, d, hp, kind, rot: r() < 0.35 ? rand(r, -0.35, 0.35) : 0 })
        break
      }
    }
  }
  return out
}

/** Total guided missiles a clear-goal needs + fair buffer. */
function shotsForClear(obstacles: ObstacleDef[], diff: Difficulty): number {
  const mult = diff === 'easy' ? 1.9 : diff === 'medium' ? 1.65 : 1.45
  let hits = 0
  for (const o of obstacles) hits += Math.ceil(o.hp / MISSILE_DMG[o.kind])
  return Math.ceil(hits * mult) + 2
}

function starScoresFor(goal: LevelGoal, autoCount: number, obstacleCount: number): [number, number, number] {
  if (goal.type === 'score') {
    const p = goal.points ?? 500
    return [p, Math.round(p * 1.3), Math.round(p * 1.65)]
  }
  if (goal.type === 'clear') {
    const expected = obstacleCount * 50 + autoCount * 30
    return [Math.round(expected * 0.6), Math.round(expected * 0.85), Math.round(expected * 1.12)]
  }
  const base = (goal.count ?? 1) * TIERS[goal.tier ?? 1].score
  return [Math.round(base * 0.9), Math.round(base * 1.15), Math.round(base * 1.5)]
}

// ----------------------------------------------------------------- generator

function generateLevel(index: number): LevelDef {
  const r = mulberry32(index * 2654435761 + 1013904223)
  const diff = difficultyOf(index)

  // progress 0..1 inside the current difficulty band
  const bandStart = diff === 'easy' ? 0 : diff === 'medium' ? MEDIUM_FROM - 1 : HARD_FROM - 1
  const bandLen =
    diff === 'easy' ? MEDIUM_FROM - 1 : diff === 'medium' ? HARD_FROM - MEDIUM_FROM : TOTAL_LEVELS - HARD_FROM + 1
  const p = Math.min(1, Math.max(0, (index - bandStart) / Math.max(1, bandLen - 1)))

  // ------------------------------------------------------------- geometry
  const trayW = diff === 'easy' ? rand(r, 8, 8.6) + p * 0.4 : diff === 'medium' ? rand(r, 8.5, 9.1) + p * 0.3 : rand(r, 9, 9.6)
  const trayD = diff === 'easy' ? rand(r, 10, 10.8) + p * 0.6 : diff === 'medium' ? rand(r, 10.8, 11.5) : rand(r, 11.2, 12)

  // ----------------------------------------------------------------- goal
  let goal: LevelGoal
  if (diff === 'easy') {
    const rot = index % 5
    if (rot === 4) {
      goal = { type: 'clear' }
    } else if (index >= 16 && rot === 3) {
      goal = { type: 'score', points: 600 + Math.round((p * 350) / 10) * 10 }
    } else {
      const tier = index % 3 === 2 ? 2 : 1
      goal = { type: 'merge', tier, count: tier === 1 ? randInt(r, 5, 8) : randInt(r, 2, 4) }
    }
  } else if (diff === 'medium') {
    const rot = index % 5
    if (rot === 2 || rot === 3) {
      goal = { type: 'clear' }
    } else if (rot === 4) {
      goal = { type: 'score', points: 1100 + Math.round((p * 900) / 50) * 50 }
    } else if (p < 0.4 || r() < 0.55) {
      goal = { type: 'merge', tier: 2, count: randInt(r, 3, 5) }
    } else {
      goal = { type: 'merge', tier: 3, count: randInt(r, 1, 3) }
    }
  } else {
    const rot = index % 4
    if (rot === 1 || rot === 2) {
      goal = { type: 'clear' }
    } else if (rot === 3) {
      goal = { type: 'score', points: 2000 + Math.round((p * 1400) / 100) * 100 }
    } else if (p < 0.5 || r() < 0.6) {
      goal = { type: 'merge', tier: 3, count: randInt(r, 2, 4) }
    } else {
      goal = { type: 'merge', tier: 4, count: r() < 0.25 ? 2 : 1 }
    }
  }

  // ----------------------------------------------------------------- tray
  const slots = perimeterSlots(trayW, trayD)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  const spawnCount = diff === 'easy' ? randInt(r, 6, 7) : diff === 'medium' ? randInt(r, 6, 7) : randInt(r, 7, 8)
  const chosen = slots.slice(0, spawnCount)
  const tiers = spawnTiers(r, goal, diff, spawnCount)
  const spawns: SpawnDef[] = chosen.map((s, i) => ({ tier: tiers[i], x: s.x, z: s.z }))

  // ------------------------------------------------------------ obstacles
  const hpMul = diff === 'easy' ? 1 + p * 0.2 : diff === 'medium' ? 1.1 + p * 0.3 : 1.4 + p * 0.5
  let obstacleCount = 0
  if (goal.type === 'clear') {
    obstacleCount = diff === 'easy' ? randInt(r, 2, 4) : diff === 'medium' ? randInt(r, 4, 7) : randInt(r, 6, 9)
  } else if (goal.type === 'score') {
    obstacleCount = diff === 'easy' ? randInt(r, 1, 2) : diff === 'medium' ? randInt(r, 2, 4) : randInt(r, 3, 5)
  } else {
    obstacleCount = diff === 'easy' ? randInt(r, 0, 1) : diff === 'medium' ? randInt(r, 1, 3) : randInt(r, 2, 4)
  }

  const kinds: ObstacleKind[] = []
  if (goal.type === 'clear') {
    if (diff === 'easy') {
      kinds.push('crate')
      if (index > 20) kinds.push('crystal')
    } else if (diff === 'medium') {
      kinds.push('crate', 'crystal')
      if (index >= 50 && r() < 0.35) kinds.push('stone')
    } else {
      kinds.push('crate', 'crystal', 'stone')
    }
  } else {
    kinds.push('crate')
    if (diff !== 'easy') kinds.push('crystal')
    if (diff === 'hard') kinds.push('stone')
  }

  const obstacles = placeObstacles(r, trayW, trayD, obstacleCount, kinds, hpMul, spawns)

  // --------------------------------------------------------------- missiles
  let shots: number
  if (goal.type === 'clear') {
    shots = shotsForClear(obstacles, diff)
  } else if (goal.type === 'score') {
    shots = diff === 'easy' ? randInt(r, 2, 4) : diff === 'medium' ? randInt(r, 3, 6) : randInt(r, 4, 7)
  } else {
    shots = diff === 'easy' ? randInt(r, 1, 3) : diff === 'medium' ? randInt(r, 2, 4) : randInt(r, 3, 5)
  }

  // ------------------------------------------------------------- auto-spawn
  let autoCount: number
  if (goal.type === 'merge') {
    const t = goal.tier ?? 1
    autoCount = diff === 'easy' ? randInt(r, 10, 14) + (t === 1 ? 2 : 4) : diff === 'medium' ? randInt(r, 14, 18) + (t === 2 ? 2 : 4) : randInt(r, 18, 24) + (t === 3 ? 2 : 6)
  } else if (goal.type === 'clear') {
    autoCount = diff === 'easy' ? randInt(r, 6, 9) : diff === 'medium' ? randInt(r, 8, 12) : randInt(r, 10, 14)
  } else {
    autoCount = diff === 'easy' ? randInt(r, 10, 13) : diff === 'medium' ? randInt(r, 12, 16) : randInt(r, 16, 22)
  }
  const autoInterval = diff === 'easy' ? 4.4 - p * 1.2 : diff === 'medium' ? 3.4 - p * 0.8 : 3.0 - p * 0.8
  const autoMax = diff === 'easy' ? randInt(r, 9, 10) : diff === 'medium' ? randInt(r, 10, 11) : randInt(r, 10, 12)

  return {
    name: nameFor(index),
    trayW: Math.round(trayW * 10) / 10,
    trayD: Math.round(trayD * 10) / 10,
    spawns,
    autoSpawn: { tier: 0, count: autoCount, interval: Math.round(autoInterval * 10) / 10, maxOnTray: autoMax },
    obstacles,
    shots,
    goal,
    guide: guideFor(goal, new Set(obstacles.map((o) => o.kind))),
    starScores: starScoresFor(goal, autoCount, obstacles.length),
  }
}

// ------------------------------------------------------------ handcrafted 1-10

const HANDCRAFTED: LevelDef[] = [
  {
    name: 'اولین ادغام‌ها',
    trayW: 8,
    trayD: 10,
    spawns: [
      { tier: 0, x: -1.3, z: -1.2 },
      { tier: 0, x: 1.3, z: -1.2 },
      { tier: 0, x: -1.3, z: 1.4 },
      { tier: 0, x: 1.3, z: 1.4 },
      { tier: 0, x: 0, z: -3.2 },
      { tier: 0, x: 0.9, z: 3.2 },
    ],
    autoSpawn: { tier: 0, count: 6, interval: 4.5 },
    obstacles: [],
    shots: 0,
    goal: { type: 'merge', tier: 1, count: 5 },
    guide: 'دو گویِ هم‌شکل را با انگشت بکش و روی هم بینداز تا ادغام شوند.',
    starScores: [200, 260, 330],
  },
  {
    name: 'بشکن و بساز',
    trayW: 8,
    trayD: 10,
    spawns: [
      { tier: 0, x: -2.6, z: -3.2 },
      { tier: 0, x: 2.6, z: -3.2 },
      { tier: 0, x: -2.6, z: 3.2 },
      { tier: 0, x: 2.6, z: 3.2 },
      { tier: 0, x: -2.6, z: 0 },
      { tier: 0, x: 2.6, z: 0 },
    ],
    autoSpawn: { tier: 0, count: 8, interval: 4 },
    obstacles: [
      { x: 0, z: -1.0, w: 1.4, h: 1.4, d: 1.4, hp: 16, kind: 'crate' },
      { x: 0, z: 1.8, w: 1.4, h: 1.4, d: 1.4, hp: 16, kind: 'crate' },
    ],
    shots: 6,
    goal: { type: 'merge', tier: 1, count: 6 },
    guide: 'روی جعبه‌ها بزن تا موشک شلیک شود؛ ادغام‌ها را هم ادامه بده.',
    starScores: [240, 300, 380],
  },
  {
    name: 'کارخانه‌ی بشکه‌ها',
    trayW: 8.5,
    trayD: 10.5,
    spawns: [
      { tier: 0, x: -2.8, z: -3.4 },
      { tier: 0, x: 2.8, z: -3.4 },
      { tier: 0, x: -2.8, z: 3.4 },
      { tier: 0, x: 2.8, z: 3.4 },
      { tier: 0, x: 0, z: -1.6 },
      { tier: 1, x: -2.8, z: 0 },
      { tier: 1, x: 2.8, z: 0 },
    ],
    autoSpawn: { tier: 0, count: 8, interval: 4 },
    obstacles: [
      { x: 0, z: -3.5, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: 0, z: 3.5, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
    ],
    shots: 6,
    goal: { type: 'merge', tier: 2, count: 3 },
    guide: 'زنجیره را بالا برو: دو گوی ← مکعب عسلی، دو مکعب ← بشکه‌ی بنفش.',
    starScores: [270, 340, 430],
  },
  {
    name: 'دستور تخریب',
    trayW: 8,
    trayD: 10,
    spawns: [
      { tier: 0, x: -2.6, z: -3.6 },
      { tier: 0, x: 2.6, z: -3.6 },
      { tier: 0, x: -2.6, z: 0.2 },
      { tier: 0, x: 2.6, z: 0.2 },
      { tier: 1, x: -2.6, z: 3.4 },
      { tier: 1, x: 2.6, z: 3.4 },
    ],
    autoSpawn: { tier: 0, count: 6, interval: 5 },
    obstacles: [
      { x: 0, z: -2.6, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: 0.95, z: -1.2, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: -0.95, z: -1.2, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: 0, z: 0.4, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
      { x: 0, z: 2.4, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
      { x: 0, z: 3.9, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
    ],
    shots: 14,
    goal: { type: 'clear' },
    guide: 'همه‌ی سدها را نابود کن؛ روی هر بلور دو بار بزن.',
    starScores: [320, 450, 600],
  },
  {
    name: 'دوقلوها',
    trayW: 8.5,
    trayD: 11,
    spawns: [
      { tier: 0, x: -2.9, z: -4.0 },
      { tier: 0, x: 2.9, z: -4.0 },
      { tier: 0, x: -2.9, z: 0 },
      { tier: 1, x: 2.9, z: 0 },
      { tier: 1, x: -2.9, z: 4.0 },
      { tier: 2, x: 2.9, z: 4.0 },
    ],
    autoSpawn: { tier: 0, count: 10, interval: 3.8 },
    obstacles: [
      { x: 0, z: -2.4, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: 0, z: 1.2, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
    ],
    shots: 6,
    goal: { type: 'merge', tier: 2, count: 4 },
    guide: 'چهار بشکه‌ی بنفش بساز؛ اشیای تازه خودشان به سینی می‌ریزند.',
    starScores: [360, 450, 560],
  },
  {
    name: 'بلور بزرگ',
    trayW: 8.5,
    trayD: 11,
    spawns: [
      { tier: 0, x: -2.9, z: -4.0 },
      { tier: 0, x: 0, z: -4.0 },
      { tier: 0, x: 2.9, z: -4.0 },
      { tier: 0, x: -2.9, z: 0 },
      { tier: 0, x: 2.9, z: 0 },
      { tier: 1, x: -2.9, z: 4.0 },
      { tier: 2, x: 2.9, z: 4.0 },
    ],
    autoSpawn: { tier: 0, count: 12, interval: 3.2 },
    obstacles: [{ x: 0, z: -1.6, w: 1.3, h: 1.3, d: 1.3, hp: 16, kind: 'crate' }],
    shots: 5,
    goal: { type: 'merge', tier: 3, count: 1 },
    guide: 'زنجیره را کامل کن: دو بشکه‌ی بنفش ← یک بلور ارغوانی.',
    starScores: [550, 750, 950],
  },
  {
    name: 'دیوار بلوری',
    trayW: 7.5,
    trayD: 9.5,
    spawns: [
      { tier: 0, x: -2.2, z: -3.4 },
      { tier: 0, x: 2.2, z: -3.4 },
      { tier: 0, x: -2.2, z: 3.4 },
      { tier: 0, x: 2.2, z: 3.4 },
      { tier: 1, x: -2.2, z: 0 },
      { tier: 1, x: 2.2, z: 0 },
    ],
    autoSpawn: { tier: 0, count: 6, interval: 4.5 },
    obstacles: [
      { x: 0, z: -2.6, w: 1.15, h: 1.15, d: 1.15, hp: 16, kind: 'crate' },
      { x: 0, z: -1.2, w: 1.15, h: 1.15, d: 1.15, hp: 16, kind: 'crate' },
      { x: 0, z: 0.2, w: 1.15, h: 1.15, d: 1.15, hp: 16, kind: 'crate' },
      { x: 0, z: 1.6, w: 1.15, h: 1.15, d: 1.15, hp: 16, kind: 'crate' },
      { x: 0, z: 3.3, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
      { x: 0, z: -3.9, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
    ],
    shots: 14,
    goal: { type: 'clear' },
    guide: 'دیوار بلوری را سوراخ‌سوراخ کن؛ هر بلور دو موشک می‌خواهد.',
    starScores: [350, 480, 620],
  },
  {
    name: 'کوره‌ی امتیاز',
    trayW: 8.5,
    trayD: 10.5,
    spawns: [
      { tier: 0, x: -2.9, z: -3.8 },
      { tier: 0, x: 0, z: -3.8 },
      { tier: 0, x: 2.9, z: -3.8 },
      { tier: 0, x: -2.9, z: -1.2 },
      { tier: 1, x: 0, z: -1.2 },
    ],
    autoSpawn: { tier: 0, count: 14, interval: 3 },
    obstacles: [
      { x: 2.0, z: 0.2, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
      { x: -1.8, z: -2.6, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
      { x: -1.6, z: 2.8, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
    ],
    shots: 8,
    goal: { type: 'score', points: 900 },
    guide: 'سریع ادغام کن تا زنجیره بسازی؛ هرچه پشت‌سرهم، امتیاز بیشتر.',
    starScores: [900, 1150, 1400],
  },
  {
    name: 'ستاره‌ی درخشان',
    trayW: 9,
    trayD: 11.5,
    spawns: [
      { tier: 0, x: -3.5, z: -4.6 },
      { tier: 0, x: -1.2, z: -4.6 },
      { tier: 0, x: 1.2, z: -4.6 },
      { tier: 0, x: 3.5, z: -4.6 },
      { tier: 0, x: -3.5, z: -1.6 },
      { tier: 0, x: 3.5, z: -1.6 },
      { tier: 2, x: 0, z: 4.4 },
    ],
    autoSpawn: { tier: 0, count: 14, interval: 2.8 },
    obstacles: [
      { x: 2.2, z: 3.6, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
      { x: 0, z: -2.9, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
    ],
    shots: 9,
    goal: { type: 'merge', tier: 4, count: 1 },
    guide: 'دو بلور ارغوانی را ادغام کن تا ستاره‌ی درخشان ساخته شود!',
    starScores: [1100, 1400, 1750],
  },
  {
    name: 'فینال بزرگ',
    trayW: 8.5,
    trayD: 11,
    spawns: [
      { tier: 0, x: -2.9, z: -4.2 },
      { tier: 0, x: 0, z: -4.2 },
      { tier: 0, x: 2.9, z: -4.2 },
      { tier: 1, x: -2.9, z: 3.8 },
      { tier: 1, x: 2.9, z: 3.8 },
      { tier: 2, x: 0, z: 3.8 },
    ],
    autoSpawn: { tier: 0, count: 18, interval: 2.4, maxOnTray: 10 },
    obstacles: [
      { x: 1.4, z: -2.2, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: -1.4, z: -2.2, w: 1.2, h: 1.2, d: 1.2, hp: 16, kind: 'crate' },
      { x: 1.2, z: 0.6, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
      { x: -1.2, z: 0.6, w: 1.2, h: 1.2, d: 1.2, hp: 18, kind: 'crate' },
      { x: 0, z: 1.6, w: 1.3, h: 1.1, d: 1.3, hp: 32, kind: 'stone' },
      { x: 0, z: -3.4, w: 0.95, h: 1.6, d: 0.95, hp: 26, kind: 'crystal' },
    ],
    shots: 14,
    goal: { type: 'score', points: 1500 },
    guide: 'مرحله‌ی پایانی فصل اول: بساز، زنجیره کن، نابود کن — تا ۳ ستاره!',
    starScores: [1500, 2000, 2600],
  },
]

// ------------------------------------------------------------------- exports

export const LEVELS: LevelDef[] = [
  ...HANDCRAFTED,
  ...Array.from({ length: TOTAL_LEVELS - HANDCRAFTED.length }, (_, i) => generateLevel(i + HANDCRAFTED.length)),
]

/** Human readable goal text (Persian) for HUD / overlays. */
export function goalText(goal: LevelGoal): string {
  switch (goal.type) {
    case 'merge':
      return `ساخت ${faNum(goal.count ?? 1)} عدد «${TIERS[goal.tier ?? 1].name}»`
    case 'clear':
      return 'تخریب همه‌ی موانع'
    case 'score':
      return `رسیدن به ${faNum(goal.points ?? 0)} امتیاز`
  }
}
