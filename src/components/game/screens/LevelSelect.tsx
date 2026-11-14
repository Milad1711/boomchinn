'use client'

/**
 * Level select screen — 10 level cards gated by stars from previous level.
 */
import { ArrowRight, Coins, Lock, Star } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { LEVELS } from '@/game/levels'
import { faNum } from '@/lib/format'

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent'

export default function LevelSelect() {
  const coins = useGameStore((s) => s.coins)
  const stars = useGameStore((s) => s.stars)
  const setScreen = useGameStore((s) => s.setScreen)
  const startLevel = useGameStore((s) => s.startLevel)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#d9f7ea] via-[#a8ecd9] to-[#7fe0d4]">
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)', paddingBottom: '0.75rem' }}
      >
        <button
          type="button"
          aria-label="بازگشت"
          onClick={() => setScreen('menu')}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-teal-900 shadow transition-all hover:bg-white active:scale-95"
        >
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-3xl font-black text-teal-900">مراحل</h1>
        <div
          className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-sm font-extrabold text-teal-900 shadow-sm backdrop-blur"
          aria-label={`تعداد سکه‌ها: ${faNum(coins)}`}
        >
          <Coins className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span>{faNum(coins)}</span>
        </div>
      </header>

      {/* Scrollable grid */}
      <div className={`flex-1 overflow-y-auto game-scroll ${SCROLLBAR}`}>
        <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {LEVELS.map((level, i) => {
              const unlocked = i === 0 || (stars[i - 1] ?? 0) > 0
              const earned = stars[i] ?? 0
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!unlocked}
                  aria-label={`مرحله‌ی ${faNum(i + 1)}${unlocked ? '' : ' - قفل شده'}`}
                  onClick={() => startLevel(i)}
                  className={`rounded-3xl border-b-4 bg-white p-4 text-right transition-all ${
                    unlocked
                      ? 'border-teal-100 shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0.5 active:shadow-sm'
                      : 'cursor-not-allowed border-transparent opacity-60 shadow-sm'
                  }`}
                >
                  <span className="block text-2xl font-black text-teal-900">{faNum(i + 1)}</span>
                  <p className="mt-1 truncate text-xs font-bold text-teal-700" title={level.name}>
                    {level.name}
                  </p>
                  <div className="mt-2 flex gap-0.5" aria-hidden="true">
                    {unlocked ? (
                      [0, 1, 2].map((s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${s < earned ? 'text-amber-400' : 'text-teal-200'}`}
                          fill="currentColor"
                        />
                      ))
                    ) : (
                      <Lock className="h-4 w-4 text-teal-400" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-5 text-center text-xs font-bold text-teal-800/60">
            برای باز کردن مرحله‌ی بعدی، مرحله‌ی قبلی را با حداقل یک ستاره تمام کن
          </p>
        </div>
      </div>
    </div>
  )
}
