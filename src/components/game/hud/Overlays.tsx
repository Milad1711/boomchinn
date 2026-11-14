'use client'

/**
 * Full-screen game overlays (briefing / pause / win / lose).
 * GameShell conditionally mounts them; each one simply renders its content.
 */
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  Coins,
  House,
  LayoutGrid,
  Lightbulb,
  Music,
  Play,
  RotateCcw,
  Star,
  Target,
  Volume2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useGameStore } from '@/lib/store'
import { LEVELS, goalText } from '@/game/levels'
import { faNum } from '@/lib/format'

const PRIMARY_BTN =
  'flex w-full h-14 items-center justify-center gap-2 rounded-3xl border-b-[6px] border-emerald-700 bg-emerald-500 text-lg font-black text-white shadow-lg transition-all hover:bg-emerald-600 active:translate-y-1.5 active:border-b-0'

const SECONDARY_BTN =
  'flex w-full h-12 items-center justify-center gap-2 rounded-3xl border-b-4 border-teal-200 bg-white/85 font-extrabold text-teal-900 shadow transition-all hover:bg-white active:translate-y-1 active:border-b-0'

const GHOST_BTN =
  'flex w-full items-center justify-center gap-1.5 py-2 text-sm font-bold text-teal-700 transition-colors hover:text-teal-900 hover:underline'

function OverlayShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-teal-950/40 p-4 backdrop-blur-[3px]">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white/95 p-6 text-center shadow-2xl sm:p-8"
      >
        {children}
      </motion.div>
    </div>
  )
}

export function BriefingOverlay() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const resume = useGameStore((s) => s.resume)
  const quitToMenu = useGameStore((s) => s.quitToMenu)

  const level = LEVELS[currentLevel] ?? LEVELS[0]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-teal-950/45 p-4 backdrop-blur-[3px]">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white/95 p-6 text-center shadow-2xl sm:p-8"
        role="dialog"
        aria-label={`راهنمای مرحله‌ی ${faNum(currentLevel + 1)}`}
      >
        <p className="rounded-full bg-teal-100 px-4 py-1 text-sm font-black text-teal-700">
          مرحله‌ی {faNum(currentLevel + 1)}
        </p>
        <h2 className="-mt-1 text-2xl font-black text-teal-900">{level.name}</h2>

        <div className="flex w-full items-center gap-2.5 rounded-2xl bg-teal-50 px-4 py-3 text-start">
          <Target className="h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
          <p className="text-sm font-extrabold leading-5 text-teal-900">هدف: {goalText(level.goal)}</p>
        </div>

        <div className="flex w-full items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-start ring-1 ring-amber-100">
          <Lightbulb className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="text-[13px] font-bold leading-5 text-teal-900">{level.guide}</p>
        </div>

        <button type="button" aria-label="شروع مرحله" onClick={() => resume()} className={PRIMARY_BTN}>
          <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          شروع!
        </button>
        <button type="button" aria-label="بازگشت به فهرست مراحل" onClick={() => quitToMenu()} className={GHOST_BTN}>
          <House className="h-4 w-4" aria-hidden="true" />
          فهرست مراحل
        </button>
      </motion.div>
    </div>
  )
}

export function PauseOverlay() {
  const resume = useGameStore((s) => s.resume)
  const restartLevel = useGameStore((s) => s.restartLevel)
  const quitToMenu = useGameStore((s) => s.quitToMenu)
  const sfx = useGameStore((s) => s.settings.sfx)
  const music = useGameStore((s) => s.settings.music)
  const toggleSetting = useGameStore((s) => s.toggleSetting)

  return (
    <OverlayShell>
      <h2 className="text-3xl font-black text-teal-900">توقف</h2>

      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl bg-teal-50 px-3 py-2">
          <Volume2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <Switch checked={sfx} onCheckedChange={() => toggleSetting('sfx')} aria-label="جلوه‌های صوتی" className="h-6 w-10 data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-teal-200" />
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-teal-50 px-3 py-2">
          <Music className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <Switch checked={music} onCheckedChange={() => toggleSetting('music')} aria-label="موسیقی" className="h-6 w-10 data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-teal-200" />
        </div>
      </div>

      <button type="button" aria-label="ادامه بازی" onClick={() => resume()} className={PRIMARY_BTN}>
        <Play className="h-5 w-5 fill-current" aria-hidden="true" />
        ادامه
      </button>
      <button type="button" aria-label="شروع دوباره مرحله" onClick={() => restartLevel()} className={SECONDARY_BTN}>
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
        شروع دوباره
      </button>
      <button type="button" aria-label="بازگشت به منوی اصلی" onClick={() => quitToMenu()} className={GHOST_BTN}>
        <House className="h-4 w-4" aria-hidden="true" />
        منوی اصلی
      </button>
    </OverlayShell>
  )
}

export function WinOverlay() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const resultStars = useGameStore((s) => s.resultStars)
  const score = useGameStore((s) => s.score)
  const earnedCoins = useGameStore((s) => s.earnedCoins)
  const nextLevel = useGameStore((s) => s.nextLevel)
  const restartLevel = useGameStore((s) => s.restartLevel)
  const quitToMenu = useGameStore((s) => s.quitToMenu)
  const setScreen = useGameStore((s) => s.setScreen)

  const isLastLevel = currentLevel >= LEVELS.length - 1

  return (
    <OverlayShell>
      <h2 className="text-3xl font-black text-teal-900">آفرین!</h2>
      <p className="-mt-2 font-bold text-teal-700">مرحله‌ی {faNum(currentLevel + 1)} تمام شد</p>

      <div className="flex items-center justify-center gap-2" role="img" aria-label={`${faNum(resultStars)} ستاره از ۳`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15 + i * 0.25, type: 'spring', stiffness: 260, damping: 12 }}
          >
            <Star
              size={44}
              fill="currentColor"
              className={i < resultStars ? 'text-amber-400' : 'text-teal-200'}
              aria-hidden="true"
            />
          </motion.div>
        ))}
      </div>

      <p className="text-xl font-black text-teal-900">امتیاز: {faNum(score)}</p>

      <div className="flex items-center justify-center gap-1.5">
        <Coins className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <span dir="ltr" className="font-extrabold text-amber-600">
          +{faNum(earnedCoins)}
        </span>
        <span className="font-extrabold text-amber-600">سکه</span>
      </div>

      {isLastLevel ? (
        <button
          type="button"
          aria-label="رفتن به فهرست مراحل"
          onClick={() => setScreen('levels')}
          className={PRIMARY_BTN}
        >
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          فهرست مراحل
        </button>
      ) : (
        <button type="button" aria-label="رفتن به مرحله‌ی بعد" onClick={() => nextLevel()} className={PRIMARY_BTN}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          مرحله‌ی بعد
        </button>
      )}
      <button type="button" aria-label="انجام دوباره مرحله" onClick={() => restartLevel()} className={SECONDARY_BTN}>
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
        دوباره
      </button>
      <button type="button" aria-label="بازگشت به منوی اصلی" onClick={() => quitToMenu()} className={GHOST_BTN}>
        <House className="h-4 w-4" aria-hidden="true" />
        منوی اصلی
      </button>
    </OverlayShell>
  )
}

export function LoseOverlay() {
  const loseReason = useGameStore((s) => s.loseReason)
  const restartLevel = useGameStore((s) => s.restartLevel)
  const quitToMenu = useGameStore((s) => s.quitToMenu)

  return (
    <OverlayShell>
      <h2 className="text-3xl font-black text-rose-600">باختی!</h2>

      {loseReason ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">{loseReason}</p>
      ) : null}

      <p className="-mt-2 text-sm font-bold text-teal-700">اشکالی نداره، یه بار دیگه امتحان کن!</p>

      <button type="button" aria-label="تلاش دوباره" onClick={() => restartLevel()} className={PRIMARY_BTN}>
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
        تلاش دوباره
      </button>
      <button type="button" aria-label="بازگشت به منوی اصلی" onClick={() => quitToMenu()} className={GHOST_BTN}>
        <House className="h-4 w-4" aria-hidden="true" />
        منوی اصلی
      </button>
    </OverlayShell>
  )
}
