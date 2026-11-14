/**
 * STACK & SMASH - 10 hand-designed levels with gradual difficulty.
 * Coordinates are inside the tray: x in [-trayW/2, trayW/2], z in [-trayD/2, trayD/2].
 *
 * Design rules:
 *  - Levels are LONG: goals require real chains, not one or two merges.
 *  - `autoSpawn` keeps dropping fresh items so the board never dead-ends.
 *  - Missile damage is deterministic: crate = 1 hit, crystal = 2, stone = 2.
 */
import { faNum } from '@/lib/format'
import { TIERS, type LevelDef, type LevelGoal } from './types'

export const LEVELS: LevelDef[] = [
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
    shots: 3,
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
    shots: 3,
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
    shots: 10,
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
    shots: 3,
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
    shots: 2,
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
    shots: 10,
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
    shots: 4,
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
    shots: 5,
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
    shots: 9,
    goal: { type: 'score', points: 1500 },
    guide: 'مرحله‌ی پایانی: بساز، زنجیره کن، نابود کن — تا ۳ ستاره!',
    starScores: [1500, 2000, 2600],
  },
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
