'use client'

/**
 * Level select screen — 105 levels grouped into three chapters
 * (easy / medium / hard), gated by stars from the previous level.
 */
import { useMemo } from 'react'
import { ArrowRight, Coins, Flag, Lock, Star } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { CHAPTERS, DIFFICULTY_LABEL, LEVELS, TOTAL_LEVELS } from '@/game/levels'
import { faNum } from '@/lib/format'

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent'

const CHAPTER_STYLE = {
  easy: {
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    card: 'border-emerald-100',
  },
  medium: {
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    card: 'border-amber-100',
  },
  hard: {
    badge: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-500',
    card: 'border-rose-100',
  },
} as const

export default function LevelSelect() {
  const coins = useGameStore((s) => s.coins)
  const stars = useGameStore((s) => s.stars)
  const setScreen = useGameStore((s) => s.setScreen)
  const startLevel = useGameStore((s) => s.startLevel)

  const totalEarned = useMemo(() => Object.values(stars).reduce((a, b) => a + b, 0), [stars])

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
        <div className="text-center">
          <h1 className="text-2xl font-black leading-7 text-teal-900">مراحل</h1>
          <p className="text-[11px] font-bold text-teal-700/80">
            {faNum(TOTAL_LEVELS)} مرحله — {faNum(totalEarned)} ستاره
          </p>
        </div>
        <div
          className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-sm font-extrabold text-teal-900 shadow-sm backdrop-blur"
          aria-label={`تعداد سکه‌ها: ${faNum(coins)}`}
        >
          <Coins className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span>{faNum(coins)}</span>
        </div>
      </header>

      {/* Scrollable chapters */}
      <div className={`flex-1 overflow-y-auto game-scroll ${SCROLLBAR}`}>
        <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          {CHAPTERS.map((chapter) => {
            const style = CHAPTER_STYLE[chapter.difficulty]
            const chapterLevels = LEVELS.slice(chapter.from - 1, chapter.to)
            const chapterStars = chapterLevels.reduce((sum, _lvl, i) => sum + (stars[chapter.from - 1 + i] ?? 0), 0)
            return (
              <section key={chapter.from} aria-labelledby={`chapter-${chapter.from}`}>
                {/* Chapter header */}
                <div className="mb-3 flex items-center gap-2.5">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${style.badge}`}>
                    <Flag className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id={`chapter-${chapter.from}`} className="text-base font-black text-teal-900">
                      {chapter.name}
                    </h2>
                    <p className="text-[11px] font-bold text-teal-700/80">
                      مرحله‌ی {faNum(chapter.from)} تا {faNum(chapter.to)} · درجه‌ی {DIFFICULTY_LABEL[chapter.difficulty]}
                    </p>
                  </div>
                  <span
                    className="flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-xs font-black text-amber-600 shadow-sm backdrop-blur"
                    aria-label={`ستاره‌های این فصل: ${faNum(chapterStars)}`}
                  >
                    <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                    {faNum(chapterStars)}
                  </span>
                </div>
                <div className={`mb-3 h-1.5 w-full rounded-full ${style.bar} opacity-40`} aria-hidden="true" />

                {/* Level cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {chapterLevels.map((level, i) => {
                    const idx = chapter.from - 1 + i
                    const unlocked = idx === 0 || (stars[idx - 1] ?? 0) > 0
                    const earned = stars[idx] ?? 0
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!unlocked}
                        aria-label={`مرحله‌ی ${faNum(idx + 1)}${unlocked ? '' : ' - قفل شده'}`}
                        onClick={() => startLevel(idx)}
                        className={`rounded-3xl border-b-4 bg-white p-4 text-right transition-all ${style.card} ${
                          unlocked
                            ? 'shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0.5 active:shadow-sm'
                            : 'cursor-not-allowed border-transparent opacity-60 shadow-sm'
                        }`}
                      >
                        <span className="block text-2xl font-black text-teal-900">{faNum(idx + 1)}</span>
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
              </section>
            )
          })}
          <p className="mt-2 text-center text-xs font-bold text-teal-800/60">
            برای باز کردن مرحله‌ی بعدی، مرحله‌ی قبلی را با حداقل یک ستاره تمام کن
          </p>
        </div>
      </div>
    </div>
  )
}
