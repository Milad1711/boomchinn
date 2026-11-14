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
 */
export const TIERS: TierDef[] = [
  { name: 'سنگ‌ریزه', shape: 'sphere', color: '#5eead4', r: 0.38, mass: 1.0, score: 0 },
  { name: 'مکعب مرجانی', shape: 'box', color: '#ff8f6b', s: 0.8, mass: 1.6, score: 40 },
  { name: 'بشکه‌ی آفتابی', shape: 'cylinder', color: '#fbbf24', r: 0.5, h: 0.88, mass: 2.4, score: 90 },
  { name: 'بلور بنفش', shape: 'ico', color: '#b18cfe', r: 0.72, mass: 3.4, score: 180, glow: 0.25 },
  { name: 'ستاره‌ی درخشان', shape: 'gem', color: '#f472b6', s: 1.22, mass: 5.0, score: 400, glow: 0.55 },
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

export type ObstacleKind = 'crate' | 'crystal' | 'stone'

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

export interface LevelDef {
  name: string
  trayW: number
  trayD: number
  spawns: SpawnDef[]
  obstacles: ObstacleDef[]
  /** cannon balls available */
  shots: number
  goal: LevelGoal
  /** score thresholds for 1/2/3 stars */
  starScores: [number, number, number]
}

export const OBSTACLE_STYLE: Record<ObstacleKind, { color: string; name: string }> = {
  crate: { color: '#d9b38c', name: 'جعبه' },
  crystal: { color: '#8fe8dc', name: 'بلور' },
  stone: { color: '#9aa8a0', name: 'سنگ' },
}
