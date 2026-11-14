/**
 * STACK & SMASH - Global game store (Zustand).
 * Holds screens, player progress (coins/stars/inventory), settings and
 * the live in-level HUD state pushed by the 3D engine.
 *
 * Persistence: localStorage (instant) + POST /api/progress (server sync).
 */
import { create } from 'zustand'
import { LEVELS } from '@/game/levels'

export type Screen = 'menu' | 'levels' | 'game' | 'settings' | 'shop'
export type GameStatus = 'playing' | 'paused' | 'won' | 'lost'

export interface Settings {
  sfx: boolean
  music: boolean
  haptics: boolean
  shadows: boolean
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
  { id: 'extraShot', name: 'شلیک اضافه', desc: 'یک توپ بیشتر در هر مرحله', price: 60 },
  { id: 'bombShot', name: 'شلیک بمبی', desc: 'انفجار بزرگ‌تر و قوی‌تر', price: 100 },
]

export const BALL_SKINS: SkinDef[] = [
  { id: 'classic', name: 'کلاسیک', price: 0, color: '#5eead4' },
  { id: 'gold', name: 'طلایی', price: 300, color: '#fbbf24' },
  { id: 'neon', name: 'نئون', price: 250, color: '#f472b6' },
]

const SAVE_KEY = 'ss_save_v1'
const PID_KEY = 'ss_pid_v1'

export const DEFAULT_INVENTORY: Inventory = {
  extraShot: 1,
  bombShot: 0,
  skins: ['classic'],
  skin: 'classic',
}

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  music: true,
  haptics: true,
  shadows: true,
}

interface SaveData {
  coins: number
  stars: Record<number, number>
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
  finishWin: (finalScore: number) => void
  finishLose: (reason: string) => void

  // economy
  buyItem: (id: ShopItemDef['id']) => boolean
  buySkin: (id: string) => boolean
  equipSkin: (id: string) => void
  useExtraShot: () => boolean
  consumeBomb: () => void

  // settings / data
  toggleSetting: (key: keyof Settings) => void
  resetProgress: () => void
  hydrate: () => Promise<void>
}

// ---------------------------------------------------------------- persistence

function getPlayerId(): string {
  if (typeof window === 'undefined') return 'server'
  let pid = window.localStorage.getItem(PID_KEY)
  if (!pid) {
    pid = crypto.randomUUID()
    window.localStorage.setItem(PID_KEY, pid)
  }
  return pid
}

function readLocalSave(): Partial<SaveData> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Partial<SaveData>
    return {
      coins: typeof data.coins === 'number' ? data.coins : undefined,
      stars: data.stars ?? undefined,
      items: data.items ?? undefined,
      settings: data.settings ?? undefined,
    }
  } catch {
    return {}
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function persist(get: () => GameStore) {
  const { coins, stars, items, settings } = get()
  const payload: SaveData = { coins, stars, items, settings }
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
  coins: 100,
  stars: {},
  items: DEFAULT_INVENTORY,
  settings: DEFAULT_SETTINGS,

  currentLevel: 0,
  runNonce: 0,
  status: 'playing',
  score: 0,
  combo: 0,
  shots: 0,
  bombArmed: false,
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
      status: 'playing',
      score: 0,
      combo: 0,
      shots: def.shots,
      bombArmed: false,
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
  resume: () => set((s) => (s.status === 'paused' ? { status: 'playing' } : {})),

  addScore: (delta) => set((s) => ({ score: s.score + delta })),
  setCombo: (c) => set({ combo: c }),
  setShots: (n) => set({ shots: n }),
  setGoalProgress: (current, target) => set({ goalCurrent: current, goalTarget: target }),
  setBombArmed: (armed) => set({ bombArmed: armed }),

  finishWin: (finalScore) => {
    const state = get()
    if (state.status === 'won') return
    const def = LEVELS[state.currentLevel]
    const stars = starsFor(finalScore, def.starScores)
    const earned = 12 * stars + Math.floor(finalScore / 50)
    const prev = state.stars[state.currentLevel] ?? 0
    set({
      status: 'won',
      score: finalScore,
      resultStars: stars,
      earnedCoins: earned,
      coins: state.coins + earned,
      stars: { ...state.stars, [state.currentLevel]: Math.max(prev, stars) },
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

  toggleSetting: (key) => {
    set({ settings: { ...get().settings, [key]: !get().settings[key] } })
    persist(get)
  },

  resetProgress: () => {
    set({
      coins: 100,
      stars: {},
      items: DEFAULT_INVENTORY,
      settings: DEFAULT_SETTINGS,
    })
    persist(get)
  },

  hydrate: async () => {
    const local = readLocalSave()
    // apply local save immediately (fast path)
    set({
      coins: local.coins ?? get().coins,
      stars: local.stars ?? get().stars,
      items: local.items ?? get().items,
      settings: { ...DEFAULT_SETTINGS, ...(local.settings ?? {}) },
    })
    try {
      const res = await fetch(`/api/progress?playerId=${encodeURIComponent(getPlayerId())}`)
      if (res.ok) {
        const data = (await res.json()) as
          | { found: false }
          | { found: true; coins: number; stars: Record<number, number>; items: Inventory; settings: Settings }
        if (data && data.found) {
          set({
            coins: data.coins,
            stars: data.stars ?? {},
            items: { ...DEFAULT_INVENTORY, ...data.items },
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
          })
          // mirror back to localStorage so both stay in sync
          try {
            window.localStorage.setItem(
              SAVE_KEY,
              JSON.stringify({ coins: data.coins, stars: data.stars, items: data.items, settings: data.settings })
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
