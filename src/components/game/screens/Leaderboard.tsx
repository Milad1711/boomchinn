'use client'

/**
 * Leaderboard (رقابت) — competition screen ranking every player by
 * total stars, then total best score. Includes a top-3 podium, the
 * full list and a sticky card showing the player's own rank.
 */
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Crown, RefreshCw, Star, Trophy, UserRound, Users } from 'lucide-react'
import { getPlayerId, totalStars, useGameStore } from '@/lib/store'
import { faNum } from '@/lib/format'
import NameDialog from './NameDialog'

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent'

interface LeaderRow {
  rank: number
  id: string
  name: string
  totalStars: number
  totalScore: number
  levels: number
}

interface LeaderboardData {
  top: LeaderRow[]
  me: LeaderRow | null
  total: number
}

const PODIUM_STYLE: Record<number, { ring: string; chip: string; height: string }> = {
  1: { ring: 'ring-amber-300 bg-amber-50', chip: 'bg-amber-400 text-amber-950', height: 'h-24' },
  2: { ring: 'ring-slate-200 bg-slate-50', chip: 'bg-slate-300 text-slate-800', height: 'h-20' },
  3: { ring: 'ring-orange-200 bg-orange-50', chip: 'bg-orange-300 text-orange-950', height: 'h-16' },
}

const RANK_CHIP: Record<number, string> = {
  1: 'bg-amber-400 text-amber-950',
  2: 'bg-slate-300 text-slate-800',
  3: 'bg-orange-300 text-orange-950',
}

export default function Leaderboard() {
  const name = useGameStore((s) => s.name)
  const stars = useGameStore((s) => s.stars)
  const bestScores = useGameStore((s) => s.bestScores)
  const setScreen = useGameStore((s) => s.setScreen)

  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/leaderboard?playerId=${encodeURIComponent(getPlayerId())}&limit=50`)
      if (!res.ok) throw new Error('bad status')
      setData((await res.json()) as LeaderboardData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const myStars = totalStars(stars)
  const myScore = Object.values(bestScores).reduce((a, b) => a + b, 0)

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
          <h1 className="text-2xl font-black leading-7 text-teal-900">رقابت</h1>
          <p className="text-[11px] font-bold text-teal-700/80">
            {data ? `${faNum(data.total)} بازیکن` : 'جدول امتیازات'}
          </p>
        </div>
        <button
          type="button"
          aria-label="به‌روزرسانی جدول"
          onClick={() => void load()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-teal-900 shadow transition-all hover:bg-white active:scale-95"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </header>

      {/* Name banner (only when unnamed) */}
      {!name && (
        <div className="mx-4 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setNameOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-amber-50/95 px-4 py-3 text-start shadow-md ring-1 ring-amber-200 transition-all hover:bg-amber-100"
          >
            <UserRound className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="flex-1 text-[13px] font-extrabold leading-5 text-teal-900">
              برای رقابت با بقیه اول اسمت را ثبت کن
            </span>
            <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
              ثبت اسم
            </span>
          </button>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto game-scroll ${SCROLLBAR}`}>
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-[calc(env(safe-area-inset-bottom)+9rem)] pt-1">
          {loading && !data ? (
            <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری جدول رقابت">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-3xl bg-white/60" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-md">
              <Trophy className="mx-auto h-10 w-10 text-teal-300" aria-hidden="true" />
              <p className="mt-2 font-extrabold text-teal-900">جدول بارگذاری نشد!</p>
              <p className="mb-3 mt-1 text-xs font-bold text-teal-700">اتصال اینترنت را بررسی کن.</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mx-auto flex h-11 items-center gap-2 rounded-2xl bg-teal-600 px-5 font-black text-white transition-colors hover:bg-teal-700"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                تلاش دوباره
              </button>
            </div>
          ) : data && data.top.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-md">
              <Users className="mx-auto h-10 w-10 text-teal-300" aria-hidden="true" />
              <p className="mt-2 font-extrabold text-teal-900">هنوز کسی رقابت نکرده!</p>
              <p className="mt-1 text-xs font-bold text-teal-700">اولین نفری باش که مرحله می‌گیرد.</p>
            </div>
          ) : data ? (
            <>
              {/* Podium — top 3 */}
              <section aria-label="سه نفر اول" className="flex items-end justify-center gap-3 pt-2">
                {[2, 1, 3].map((place) => {
                  const row = data.top.find((r) => r.rank === place)
                  if (!row) return <div key={place} className="w-1/3" />
                  const style = PODIUM_STYLE[place]
                  return (
                    <motion.div
                      key={place}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * place, type: 'spring', stiffness: 240, damping: 20 }}
                      className={`flex w-1/3 min-w-0 flex-col items-center gap-1.5 rounded-3xl bg-white/85 p-3 shadow-md ring-1 ${style.ring}`}
                    >
                      {place === 1 ? (
                        <Crown className="h-6 w-6 text-amber-400" fill="currentColor" aria-hidden="true" />
                      ) : null}
                      <span
                        className={`flex ${style.height} w-full items-center justify-center rounded-2xl text-center text-[13px] leading-tight font-black break-words text-teal-900`}
                      >
                        <span className="line-clamp-2 px-1">{row.name || 'بی‌نام'}</span>
                      </span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${style.chip}`}>
                        {faNum(place)}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs font-extrabold text-amber-600"
                        aria-label={`${faNum(row.totalStars)} ستاره`}
                      >
                        <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                        {faNum(row.totalStars)}
                      </span>
                    </motion.div>
                  )
                })}
              </section>

              {/* Full list */}
              <section aria-label="همه‌ی رتبه‌ها" className="space-y-2">
                {data.top.map((row) => {
                  const isMe = row.id === getPlayerId()
                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 rounded-3xl px-4 py-3 shadow-sm ${
                        isMe ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400' : 'bg-white text-teal-900'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isMe ? 'bg-white/20 text-white' : (RANK_CHIP[row.rank] ?? 'bg-teal-100 text-teal-700')
                        }`}
                      >
                        {faNum(row.rank)}
                      </span>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          isMe ? 'bg-white/20' : 'bg-teal-50 text-teal-600'
                        }`}
                        aria-hidden="true"
                      >
                        {[...(row.name || '؟')][0] ?? '؟'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">
                          {row.name || 'بی‌نام'}
                          {isMe ? <span className="ms-1.5 text-[10px] font-black opacity-75">(تو)</span> : null}
                        </p>
                        <p className={`text-[11px] font-bold ${isMe ? 'text-white/80' : 'text-teal-700/70'}`}>
                          {faNum(row.levels)} مرحله
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span
                          className={`flex items-center gap-1 text-sm font-black ${
                            isMe ? 'text-amber-200' : 'text-amber-600'
                          }`}
                        >
                          <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                          {faNum(row.totalStars)}
                        </span>
                        <span className={`text-[10px] font-bold ${isMe ? 'text-white/75' : 'text-teal-600/70'}`}>
                          {faNum(row.totalScore)} امتیاز
                        </span>
                      </div>
                    </div>
                  )
                })}
              </section>

              <p className="text-center text-xs font-bold text-teal-800/60">
                رتبه‌بندی بر اساس مجموع ستاره‌ها و امتیازهای بهترین بازی‌هاست
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Sticky my-rank card */}
      {data?.me && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl bg-teal-900/92 px-4 py-3 text-white shadow-xl backdrop-blur">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-amber-950">
              {faNum(data.me.rank)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">رتبه‌ی تو: {data.me.name || 'بی‌نام'}</p>
              <p className="text-[11px] font-bold text-white/75">
                از {faNum(data.total)} بازیکن
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-black text-amber-300">
              <Star className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              {faNum(data.me.totalStars)}
            </span>
          </div>
        </div>
      )}
      {/* local fallback card when the server has no row for us yet */}
      {!data?.me && !loading && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl bg-teal-900/92 px-4 py-3 text-white shadow-xl backdrop-blur">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-black">
              <Trophy className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-extrabold">
              {name ? 'با بردن مرحله‌ها وارد جدول رقابت شو' : 'برای ورود به جدول، اسمت را ثبت کن'}
            </p>
            <span className="flex shrink-0 items-center gap-1 text-sm font-black text-amber-300">
              <Star className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              {faNum(myStars)}
            </span>
            <span className="sr-only">{faNum(myScore)} امتیاز</span>
          </div>
        </div>
      )}

      <NameDialog open={nameOpen} onOpenChange={setNameOpen} onSaved={() => void load()} />
    </div>
  )
}
