/**
 * بوم چین (STACK & SMASH) - Global game store (Zustand).
 * Holds screens, player progress (coins/stars/inventory), settings and
 * the live in-level HUD state pushed by the 3D engine.
 *
 * Persistence: localStorage (instant) + POST /api/progress (server sync).
 */
import { create } from 'zustand'
import { LEVELS } from '@/game/levels'

export type Screen = 'menu' | 'levels' | 'game' | 'settings' | 'shop' | 'ranks'
export type GameStatus = 'briefing' | 'playing' | 'paused' | 'won' | 'lost'

export interface Settings {
  haptics: boolean
  shadows: boolean
  /** Success chime when two balls merge. */
  sound: boolean
}

export interface Inventory {
  extraShot: number
  bombShot: number
  skins: string[]
  skin: string
}

export interface ShopItemDef {
  id: 'extraShot' | 'bombShot'
  name: string
  desc: string
  price: number
}

export interface SkinDef {
  id: string
  name: string
  price: number
  color: string
}

export const SHOP_ITEMS: ShopItemDef[] = [
  { id: 'extraShot', name: 'موشک اضافه', desc: 'یک موشک بیشتر در هر مرحله', price: 30 },
  { id: 'bombShot', name: 'موشک بمبی', desc: 'انفجار بزرگ‌تر و قوی‌تر', price: 55 },
]

/** Simulated in-app coin packages (4 tiers, Toman prices). */
export interface CoinPack {
  id: string
  name: string
  coins: number
  priceToman: number
  tag?: string
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'pack_s', name: 'بسته‌ی کوچک', coins: 500, priceToman: 9000 },
  { id: 'pack_m', name: 'بسته‌ی متوسط', coins: 3000, priceToman: 49000, tag: '+۱۰٪ جایزه' },
  { id: 'pack_l', name: 'بسته‌ی بزرگ', coins: 8500, priceToman: 129000, tag: '+۲۰٪ جایزه' },
  { id: 'pack_xl', name: 'بسته‌ی ویژه', coins: 18000, priceToman: 249000, tag: 'بهترین ارزش' },
]

/** Price of buying one extra missile instantly during a level. */
export const COINS_PER_SHOT = 12

export const BALL_SKINS: SkinDef[] = [
  { id: 'classic', name: 'نارنجی', price: 0, color: '#f97316' },
  { id: 'gold', name: 'طلایی', price: 150, color: '#fbbf24' },
  { id: 'neon', name: 'نئون', price: 120, color: '#f472b6' },
]

const SAVE_KEY = 'ss_save_v1'
const PID_KEY = 'ss_pid_v1'

/** Max display-name length (code points). */
export const NAME_MAX = 20

export const DEFAULT_INVENTORY: Inventory = {
  extraShot: 1,
  bombShot: 0,
  skins: ['classic'],
  skin: 'classic',
}

export const DEFAULT_SETTINGS: Settings = {
  haptics: true,
  shadows: true,
  sound: true,
}

interface SaveData {
  name: string
  coins: number
  stars: Record<number, number>
  bestScores: Record<number, number>
  items: Inventory
  settings: Settings
}

interface GameStore extends SaveData {
  hydrated: boolean
  screen: Screen
  // live level state (pushed by engine callbacks)
  currentLevel: number
  runNonce: number
  status: GameStatus
  score: number
  combo: number
  shots: number
  bombArmed: boolean
  ballActive: boolean
  goalCurrent: number
  goalTarget: number
  loseReason: string | null
  resultStars: number
  earnedCoins: number

  // navigation / flow
  setScreen: (s: Screen) => void
  startLevel: (index: number) => void
  restartLevel: () => void
  nextLevel: () => void
  quitToMenu: () => void
  pause: () => void
  resume: () => void

  // engine -> store updates
  addScore: (delta: number) => void
  setCombo: (c: number) => void
  setShots: (n: number) => void
  setGoalProgress: (current: number, target: number) => void
  setBombArmed: (armed: boolean) => void
  setBallActive: (active: boolean) => void
  finishWin: (finalScore: number) => void
  finishLose: (reason: string) => void

  // economy
  buyItem: (id: ShopItemDef['id']) => boolean
  buySkin: (id: string) => boolean
  equipSkin: (id: string) => void
  useExtraShot: () => boolean
  consumeBomb: () => void
  buyShotNow: () => boolean
  buyCoinPack: (id: string) => boolean

  // settings / data
  setName: (name: string) => void
  toggleSetting: (key: keyof Settings) => void
  resetProgress: () => void
  hydrate: () => Promise<void>
}

// ---------------------------------------------------------------- persistence

/** Stable per-device player id (also the leaderboard identity). */
export function getPlayerId(): string {
  if (typeof window === 'undefined') return 'server'
  let pid = window.localStorage.getItem(PID_KEY)
  if (!pid) {
    pid = crypto.randomUUID()
    window.localStorage.setItem(PID_KEY, pid)
  }
  return pid
}

/** Clean a display name on the client (same rules as the server). */
export function sanitizeNameLocal(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .trim()
  return [...cleaned].slice(0, NAME_MAX).join('')
}

function readLocalSave(): Partial<SaveData> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Partial<SaveData>
    return {
      name: typeof data.name === 'string' ? data.name : undefined,
      coins: typeof data.coins === 'number' ? data.coins : undefined,
      stars: data.stars ?? undefined,
      bestScores: data.bestScores ?? undefined,
      items: data.items ?? undefined,
      settings: data.settings ?? undefined,
    }
  } catch {
    return {}
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function persist(get: () => GameStore) {
  const { name, coins, stars, bestScores, items, settings } = get()
  const payload: SaveData = { name, coins, stars, bestScores, items, settings }
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch {
    /* storage may be unavailable */
  }
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: getPlayerId(), ...payload }),
      keepalive: true,
    }).catch(() => undefined)
  }, 900)
}

function starsFor(score: number, thresholds: [number, number, number]): number {
  if (score >= thresholds[2]) return 3
  if (score >= thresholds[1]) return 2
  return 1
}

// ---------------------------------------------------------------------- store

export const useGameStore = create<GameStore>((set, get) => ({
  hydrated: false,
  screen: 'menu',
  name: '',
  coins: 50,
  stars: {},
  bestScores: {},
  items: DEFAULT_INVENTORY,
  settings: DEFAULT_SETTINGS,

  currentLevel: 0,
  runNonce: 0,
  status: 'playing',
  score: 0,
  combo: 0,
  shots: 0,
  bombArmed: false,
  ballActive: false,
  goalCurrent: 0,
  goalTarget: 1,
  loseReason: null,
  resultStars: 0,
  earnedCoins: 0,

  setScreen: (s) => set({ screen: s }),

  startLevel: (index) => {
    const def = LEVELS[index]
    if (!def) return
    const goalTarget =
      def.goal.type === 'merge'
        ? def.goal.count ?? 1
        : def.goal.type === 'clear'
          ? def.obstacles.length
          : def.goal.points ?? 0
    set({
      screen: 'game',
      currentLevel: index,
      runNonce: get().runNonce + 1,
      status: 'briefing',
      score: 0,
      combo: 0,
      shots: def.shots,
      bombArmed: false,
      ballActive: false,
      goalCurrent: 0,
      goalTarget,
      loseReason: null,
      resultStars: 0,
      earnedCoins: 0,
    })
  },

  restartLevel: () => get().startLevel(get().currentLevel),

  nextLevel: () => {
    const next = get().currentLevel + 1
    if (next < LEVELS.length) get().startLevel(next)
    else set({ screen: 'levels' })
  },

  quitToMenu: () => set({ screen: 'menu', status: 'playing' }),

  pause: () => set((s) => (s.status === 'playing' ? { status: 'paused' } : {})),
  resume: () => set((s) => (s.status === 'paused' || s.status === 'briefing' ? { status: 'playing' } : {})),

  addScore: (delta) => set((s) => ({ score: s.score + delta })),
  setCombo: (c) => set({ combo: c }),
  setShots: (n) => set({ shots: n }),
  setGoalProgress: (current, target) => set({ goalCurrent: current, goalTarget: target }),
  setBombArmed: (armed) => set({ bombArmed: armed }),
  setBallActive: (active) => set({ ballActive: active }),

  finishWin: (finalScore) => {
    const state = get()
    if (state.status === 'won') return
    const def = LEVELS[state.currentLevel]
    const stars = starsFor(finalScore, def.starScores)
    // gentle economy: coins stay scarce so the shop matters
    const earned = 2 * stars + Math.floor(finalScore / 300)
    const prev = state.stars[state.currentLevel] ?? 0
    const prevBest = state.bestScores[state.currentLevel] ?? 0
    set({
      status: 'won',
      score: finalScore,
      resultStars: stars,
      earnedCoins: earned,
      coins: state.coins + earned,
      stars: { ...state.stars, [state.currentLevel]: Math.max(prev, stars) },
      // competition: keep each level's best score for the leaderboard
      bestScores:
        finalScore > prevBest
          ? { ...state.bestScores, [state.currentLevel]: finalScore }
          : state.bestScores,
    })
    persist(get)
  },

  finishLose: (reason) => {
    if (get().status !== 'playing') return
    set({ status: 'lost', loseReason: reason })
    persist(get)
  },

  buyItem: (id) => {
    const item = SHOP_ITEMS.find((i) => i.id === id)
    if (!item) return false
    const state = get()
    if (state.coins < item.price) return false
    set({
      coins: state.coins - item.price,
      items: { ...state.items, [id]: state.items[id] + 1 },
    })
    persist(get)
    return true
  },

  buySkin: (id) => {
    const skin = BALL_SKINS.find((s) => s.id === id)
    if (!skin) return false
    const state = get()
    if (state.items.skins.includes(id) || state.coins < skin.price) return false
    set({
      coins: state.coins - skin.price,
      items: { ...state.items, skins: [...state.items.skins, id], skin: id },
    })
    persist(get)
    return true
  },

  equipSkin: (id) => {
    if (!get().items.skins.includes(id)) return
    set({ items: { ...get().items, skin: id } })
    persist(get)
  },

  useExtraShot: () => {
    const state = get()
    if (state.items.extraShot <= 0) return false
    set({ items: { ...state.items, extraShot: state.items.extraShot - 1 }, shots: state.shots + 1 })
    persist(get)
    return true
  },

  consumeBomb: () => {
    const state = get()
    if (state.items.bombShot <= 0) return
    set({ items: { ...state.items, bombShot: state.items.bombShot - 1 } })
    persist(get)
  },

  /** Instantly buy one extra missile during a level (HUD button). */
  buyShotNow: () => {
    const state = get()
    if (state.coins < COINS_PER_SHOT) return false
    set({ coins: state.coins - COINS_PER_SHOT, shots: state.shots + 1 })
    persist(get)
    return true
  },

  /** Simulated in-app purchase of a coin package. */
  buyCoinPack: (id) => {
    const pack = COIN_PACKS.find((p) => p.id === id)
    if (!pack) return false
    set({ coins: get().coins + pack.coins })
    persist(get)
    return true
  },

  /** Save the player's display name (sanitized; used for the leaderboard). */
  setName: (raw) => {
    const name = sanitizeNameLocal(raw)
    set({ name })
    persist(get)
  },

  toggleSetting: (key) => {
    set({ settings: { ...get().settings, [key]: !get().settings[key] } })
    persist(get)
  },

  resetProgress: () => {
    set({
      coins: 50,
      stars: {},
      bestScores: {},
      items: DEFAULT_INVENTORY,
      settings: DEFAULT_SETTINGS,
    })
    // also forget tutorial / contextual tips so they show again
    try {
      window.localStorage.removeItem('ss_tut_v1')
      window.localStorage.removeItem('ss_tip_clear')
      window.localStorage.removeItem('ss_tip_score')
    } catch {
      /* ignore */
    }
    persist(get)
  },

  hydrate: async () => {
    const local = readLocalSave()
    // apply local save immediately (fast path)
    set({
      name: local.name ?? get().name,
      coins: local.coins ?? get().coins,
      stars: local.stars ?? get().stars,
      bestScores: local.bestScores ?? get().bestScores,
      items: local.items ?? get().items,
      settings: { ...DEFAULT_SETTINGS, ...(local.settings ?? {}) },
    })
    try {
      const res = await fetch(`/api/progress?playerId=${encodeURIComponent(getPlayerId())}`)
      if (res.ok) {
        const data = (await res.json()) as
          | { found: false }
          | {
              found: true
              name?: string
              coins: number
              stars: Record<number, number>
              bestScores: Record<number, number>
              items: Inventory
              settings: Settings
            }
        if (data && data.found) {
          set({
            name: data.name ?? get().name,
            coins: data.coins,
            stars: data.stars ?? {},
            bestScores: data.bestScores ?? {},
            items: { ...DEFAULT_INVENTORY, ...data.items },
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
          })
          // mirror back to localStorage so both stay in sync
          try {
            window.localStorage.setItem(
              SAVE_KEY,
              JSON.stringify({
                name: data.name ?? get().name,
                coins: data.coins,
                stars: data.stars,
                bestScores: data.bestScores,
                items: data.items,
                settings: data.settings,
              })
            )
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* offline: local save is enough */
    }
    set({ hydrated: true })
  },
}))

/** Combined stars across all levels (for menu display). */
export function totalStars(stars: Record<number, number>): number {
  return Object.values(stars).reduce((a, b) => a + b, 0)
}

/** Sum of every level's best score (competition metric). */
export function totalScore(scores: Record<number, number>): number {
  return Object.values(scores).reduce((a, b) => a + b, 0)
}
