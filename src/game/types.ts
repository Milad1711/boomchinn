/**
 * STACK & SMASH - Core game types
 * Shared between the 3D engine, level data and UI layers.
 */

export type TierShape = 'sphere' | 'box' | 'cylinder' | 'ico' | 'gem'

export interface TierDef {
  name: string
  shape: TierShape
  color: string
  /** sphere / cylinder / ico radius */
  r?: number
  /** box size (full edge) */
  s?: number
  /** cylinder height */
  h?: number
  mass: number
  /** score awarded when this tier is created by a merge */
  score: number
  /** emissive glow strength */
  glow?: number
}

/**
 * Merge tiers (index 0 = tier 1 ... index 4 = tier 5).
 * Two objects of tier N merge into one object of tier N+1.
 * Merging two tier-5 objects triggers a destructive STAR BLAST.
 *
 * Palette: warm coral/amber/violet/fuchsia/rose — every tier keeps a
 * strong contrast against the mint-green environment.
 */
export const TIERS: TierDef[] = [
  { name: 'گوی مرجانی', shape: 'sphere', color: '#ff8f6b', r: 0.38, mass: 1.0, score: 0 },
  { name: 'مکعب عسلی', shape: 'box', color: '#fbbf24', s: 0.8, mass: 1.6, score: 40 },
  { name: 'بشکه‌ی بنفش', shape: 'cylinder', color: '#b18cfe', r: 0.5, h: 0.88, mass: 2.4, score: 90 },
  { name: 'بلور ارغوانی', shape: 'ico', color: '#e879f9', r: 0.72, mass: 3.4, score: 180, glow: 0.25 },
  { name: 'ستاره‌ی درخشان', shape: 'gem', color: '#f43f5e', s: 1.22, mass: 5.0, score: 400, glow: 0.55 },
]

export const MAX_TIER = TIERS.length - 1

export type GoalType = 'merge' | 'clear' | 'score'

export interface LevelGoal {
  type: GoalType
  /** for 'merge': required tier index (1..4) */
  tier?: number
  /** for 'merge': how many objects of that tier must be created */
  count?: number
  /** for 'score': required score */
  points?: number
}

/** ObstacleKind = 'crate' | 'crystal' | 'stone'; hp tuned for missile damage. */
export type ObstacleKind = 'crate' | 'crystal' | 'stone'

/** Missile damage per kind so hits-to-kill stays predictable (1 / 2 / 2). */
export const MISSILE_DMG: Record<ObstacleKind, number> = {
  crate: 20,
  crystal: 15,
  stone: 17,
}

export const BOMB_DMG = 45
export const BOMB_SPLASH_DMG = 26

export interface ObstacleDef {
  x: number
  z: number
  /** full width (x), height (y), depth (z) */
  w: number
  h: number
  d: number
  hp: number
  kind: ObstacleKind
  /** optional yaw rotation in radians */
  rot?: number
}

export interface SpawnDef {
  tier: number
  x: number
  z: number
}

/**
 * Keeps feeding the tray with fresh items so levels stay long, lively
 * and never dead-end. A new item drops every `interval` seconds until
 * `count` items have spawned (only while the tray has room).
 */
export interface AutoSpawnDef {
  tier: number
  count: number
  interval: number
  /** never spawn if the tray already holds this many items (default 9) */
  maxOnTray?: number
}

export interface LevelDef {
  name: string
  trayW: number
  trayD: number
  spawns: SpawnDef[]
  /** timed item drops during play (levels stay long & always solvable) */
  autoSpawn?: AutoSpawnDef
  obstacles: ObstacleDef[]
  /** guided missiles available */
  shots: number
  goal: LevelGoal
  /** short Persian how-to-play hint shown on the pre-level briefing card */
  guide: string
  /** score thresholds for 1/2/3 stars */
  starScores: [number, number, number]
}

export const OBSTACLE_STYLE: Record<ObstacleKind, { color: string; name: string }> = {
  crate: { color: '#c98d5a', name: 'جعبه' },
  crystal: { color: '#5ec9d8', name: 'بلور' },
  stone: { color: '#9aa8a0', name: 'سنگ' },
}
