'use client'

/**
 * In-game HUD — pause, score, goal progress, combo, shots, power buttons
 * and level-0 tutorial hints. The root is click-through; only controls
 * receive pointer events.
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bomb, CirclePlus, Crosshair, Pause, Sparkles, Target } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { engineRef } from '@/game/engineRef'
import { LEVELS, goalText } from '@/game/levels'
import { faNum } from '@/lib/format'

const HINTS = [
  { id: 0, text: 'اشیای هم‌رنگ را با انگشت روی هم بکش!', bottomRem: 9 },
  { id: 1, text: 'در نوار پایین بکش و رها کن تا توپ شلیک شود!', bottomRem: 2.5 },
]

export default function Hud() {
  const score = useGameStore((s) => s.score)
  const combo = useGameStore((s) => s.combo)
  const shots = useGameStore((s) => s.shots)
  const goalCurrent = useGameStore((s) => s.goalCurrent)
  const goalTarget = useGameStore((s) => s.goalTarget)
  const bombArmed = useGameStore((s) => s.bombArmed)
  const inventory = useGameStore((s) => s.items)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const status = useGameStore((s) => s.status)
  const pause = useGameStore((s) => s.pause)

  const [dismissedHints, setDismissedHints] = useState<number[]>([])

  const level = LEVELS[currentLevel] ?? LEVELS[0]
  const goalPercent = Math.min(100, goalTarget > 0 ? (goalCurrent / goalTarget) * 100 : 0)
  const showHints = currentLevel === 0 && status === 'playing'
  const bombCount = inventory.bombShot

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
          onClick={() => engineRef.current?.toggleBomb()}
          className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 ${
            bombArmed ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-300' : 'bg-white/85 text-teal-900 backdrop-blur'
          } ${bombCount === 0 && !bombArmed ? 'opacity-40' : ''}`}
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

      {/* Tutorial hints (level 1 only) */}
      <AnimatePresence>
        {showHints &&
          HINTS.filter((h) => !dismissedHints.includes(h.id)).map((hint) => (
            <motion.button
              key={hint.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setDismissedHints((d) => [...d, hint.id])}
              aria-label={`راهنما: ${hint.text} — برای بستن لمس کن`}
              className="pointer-events-auto absolute max-w-[11rem] cursor-pointer rounded-2xl bg-white/85 px-3 py-2 text-start text-xs font-bold text-teal-900 shadow-lg backdrop-blur"
              style={{ insetInlineStart: '0.75rem', bottom: `calc(env(safe-area-inset-bottom) + ${hint.bottomRem}rem)` }}
            >
              {hint.text}
            </motion.button>
          ))}
      </AnimatePresence>
    </div>
  )
}
