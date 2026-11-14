'use client'

/**
 * In-game HUD — pause, score, goal progress, combo, shots, power buttons,
 * the shooting strip and the step-by-step tutorial + contextual tips.
 * The root is click-through; only controls receive pointer events.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bomb, ChevronDown, CirclePlus, Crosshair, Hand, Lightbulb, Pause, Sparkles, Target, X } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { engineRef } from '@/game/engineRef'
import { LEVELS, goalText } from '@/game/levels'
import { faNum } from '@/lib/format'

const TUT_KEY = 'ss_tut_v1'
const TIP_CLEAR_KEY = 'ss_tip_clear'
const TIP_SCORE_KEY = 'ss_tip_score'

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return true // private mode: never block the player with popups
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

const CARD_BASE =
  'pointer-events-none absolute rounded-2xl bg-white/92 px-4 py-3 text-start shadow-xl backdrop-blur'

/** Step 1/2 — teach dragging & merging. */
function MergeStepCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`${CARD_BASE} flex items-center gap-3`}
      style={{ top: '9.5rem', insetInlineStart: '0.75rem', maxWidth: '17rem' }}
      aria-live="polite"
    >
      <motion.span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Hand className="h-5 w-5" aria-hidden="true" />
      </motion.span>
      <div>
        <p className="text-[11px] font-black text-teal-500">آموزش — ۱ از ۲</p>
        <p className="text-sm font-extrabold leading-5 text-teal-900">
          دو شکل هم‌رنگ را با انگشت بکش و روی هم بگذار تا ادغام شوند!
        </p>
      </div>
    </motion.div>
  )
}

/** Step 2/2 — teach aiming & firing the cannon. */
function ShootStepCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`${CARD_BASE} flex flex-col items-center gap-1.5`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16.5%)', left: '50%', x: '-50%' }}
      aria-live="polite"
    >
      <p className="text-[11px] font-black text-amber-500">آموزش — ۲ از ۲</p>
      <p className="whitespace-nowrap text-sm font-extrabold text-teal-900">
        در نوار پایین بکش و رها کن تا توپ شلیک شود!
      </p>
      <motion.span
        className="text-amber-500"
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <ChevronDown className="h-5 w-5" />
      </motion.span>
    </motion.div>
  )
}

/** One-time contextual tip for special goal types. */
function TipCard({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="pointer-events-auto absolute flex items-center gap-2.5 rounded-2xl bg-amber-50/95 px-4 py-3 shadow-xl ring-1 ring-amber-200 backdrop-blur"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16.5%)', left: '50%', x: '-50%', maxWidth: '20rem' }}
      role="status"
    >
      <Lightbulb className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <p className="text-[13px] font-extrabold leading-5 text-teal-900">{text}</p>
      <button
        type="button"
        aria-label="بستن راهنما"
        onClick={onClose}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-teal-500 transition-colors hover:bg-amber-100 hover:text-teal-800"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

export default function Hud() {
  const score = useGameStore((s) => s.score)
  const combo = useGameStore((s) => s.combo)
  const shots = useGameStore((s) => s.shots)
  const ballActive = useGameStore((s) => s.ballActive)
  const goalCurrent = useGameStore((s) => s.goalCurrent)
  const goalTarget = useGameStore((s) => s.goalTarget)
  const bombArmed = useGameStore((s) => s.bombArmed)
  const inventory = useGameStore((s) => s.items)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const runNonce = useGameStore((s) => s.runNonce)
  const status = useGameStore((s) => s.status)
  const pause = useGameStore((s) => s.pause)

  const [tutStep, setTutStep] = useState<'merge' | 'shoot' | null>(null)
  const [tip, setTip] = useState<string | null>(null)

  const level = LEVELS[currentLevel] ?? LEVELS[0]
  const goalPercent = Math.min(100, goalTarget > 0 ? (goalCurrent / goalTarget) * 100 : 0)
  const bombCount = inventory.bombShot
  const shotsFired = level.shots - shots

  // start the interactive tutorial on level 1 (once per save, restarts on retry)
  useEffect(() => {
    setTutStep(null)
    if (currentLevel !== 0 || readFlag(TUT_KEY)) return
    const t = window.setTimeout(() => setTutStep('merge'), 700)
    return () => window.clearTimeout(t)
  }, [currentLevel, runNonce])

  // advance tutorial steps from real game events
  useEffect(() => {
    if (tutStep === 'merge' && score > 0) setTutStep('shoot')
  }, [score, tutStep])

  useEffect(() => {
    if (tutStep === 'shoot' && shotsFired > 0) {
      setTutStep(null)
      writeFlag(TUT_KEY)
    }
  }, [shotsFired, tutStep])

  // one-time contextual tips for clear / score levels
  useEffect(() => {
    setTip(null)
    if (status !== 'playing') return
    if (level.goal.type === 'clear' && !readFlag(TIP_CLEAR_KEY)) {
      writeFlag(TIP_CLEAR_KEY)
      setTip('شکل‌های چوبی و بلوری را نمی‌شود جابه‌جا کرد — با توپخانه نابودشان کن!')
    } else if (level.goal.type === 'score' && !readFlag(TIP_SCORE_KEY)) {
      writeFlag(TIP_SCORE_KEY)
      setTip('برای امتیاز بیشتر، ادغام‌ها را پشت‌سرهم انجام بده تا زنجیره بسازی!')
    }
  }, [currentLevel, level.goal.type, status])

  // auto-dismiss the tip
  useEffect(() => {
    if (!tip) return
    const t = window.setTimeout(() => setTip(null), 7000)
    return () => window.clearTimeout(t)
  }, [tip])

  const playing = status === 'playing'

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Top row */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        {/* Pause */}
        <button
          type="button"
          aria-label="توقف"
          onClick={() => pause()}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-teal-900 shadow-lg backdrop-blur transition-all hover:bg-white active:scale-95"
        >
          <Pause className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Center: score / combo / goal */}
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div className="flex h-10 items-center gap-1.5 rounded-full bg-white/85 px-4 font-black text-teal-900 shadow backdrop-blur">
            <Sparkles className="h-[18px] w-[18px] text-amber-500" aria-hidden="true" />
            <span>{faNum(score)}</span>
          </div>

          {combo >= 2 ? (
            <motion.div
              key={combo}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-amber-950 shadow"
            >
              زنجیره ×{faNum(combo)}
            </motion.div>
          ) : null}

          <div className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-teal-900 shadow-sm backdrop-blur">
            <Target className="h-3 w-3" aria-hidden="true" />
            <span className="max-w-[9rem] truncate">{goalText(level.goal)}</span>
            <span className="opacity-40" aria-hidden="true">
              |
            </span>
            <span dir="ltr" className="tabular-nums">
              {faNum(goalCurrent)}/{faNum(goalTarget)}
            </span>
          </div>

          <div
            className="h-1 w-32 overflow-hidden rounded-full bg-white/50"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(goalPercent)}
            aria-label="پیشرفت هدف مرحله"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${goalPercent}%` }} />
          </div>
        </div>

        {/* Shots */}
        <div
          className="flex h-10 items-center gap-1.5 rounded-full bg-white/85 px-4 font-black text-teal-900 shadow backdrop-blur"
          aria-label={`توپ‌های باقی‌مانده: ${faNum(shots)}`}
        >
          <Crosshair className="h-[18px] w-[18px] text-teal-600" aria-hidden="true" />
          <span>{faNum(shots)}</span>
        </div>
      </div>

      {/* Power buttons (inline-end bottom) */}
      <div
        className="absolute flex flex-col items-center gap-2"
        style={{ insetInlineEnd: '0.75rem', bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
      >
        <button
          type="button"
          aria-label="شلیک بمبی"
          aria-pressed={bombArmed}
          disabled={bombCount === 0 && !bombArmed}
          onClick={() => engineRef.current?.toggleBomb(bombCount > 0)}
          className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 ${
            bombArmed ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-300' : 'bg-white/85 text-teal-900 backdrop-blur'
          } ${bombCount === 0 ? 'opacity-40' : ''} disabled:cursor-not-allowed`}
        >
          <Bomb className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-black text-white">
            {faNum(bombCount)}
          </span>
        </button>

        <button
          type="button"
          aria-label="شلیک اضافه"
          onClick={() => {
            const ok = useGameStore.getState().useExtraShot()
            if (ok) engineRef.current?.grantShot()
          }}
          className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-white/85 text-teal-900 shadow-lg backdrop-blur transition-all active:scale-90 ${
            inventory.extraShot === 0 ? 'opacity-40' : ''
          }`}
        >
          <CirclePlus className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-black text-white">
            {faNum(inventory.extraShot)}
          </span>
        </button>
      </div>

      {/* Shooting strip (touch passes through to the canvas) */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] flex h-[15%] flex-col items-center border-t-2 border-dashed border-white/50 bg-gradient-to-t from-white/25 to-transparent pt-1.5">
          {shots > 0 ? (
            ballActive ? (
              <span className="rounded-full bg-white/45 px-3 py-0.5 text-[10px] font-bold text-teal-900/60">
                توپ در راه است…
              </span>
            ) : (
              <motion.span
                className="flex items-center gap-1 rounded-full bg-white/60 px-3.5 py-1 text-[11px] font-extrabold text-teal-900 shadow-sm"
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                بکش و رها کن تا شلیک شود
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </motion.span>
            )
          ) : (
            <span className="rounded-full bg-white/35 px-3 py-0.5 text-[10px] font-bold text-teal-900/45">
              توپی نمانده
            </span>
          )}
        </div>
      )}

      {/* Interactive tutorial (level 1, once per save) */}
      <AnimatePresence>
        {playing && tutStep === 'merge' && <MergeStepCard key="tut-merge" />}
        {playing && tutStep === 'shoot' && <ShootStepCard key="tut-shoot" />}
      </AnimatePresence>

      {/* Contextual tip */}
      <AnimatePresence>
        {playing && tip && <TipCard key={tip} text={tip} onClose={() => setTip(null)} />}
      </AnimatePresence>
    </div>
  )
}
