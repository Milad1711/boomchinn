'use client'

/**
 * Main menu screen — logo, title, primary navigation.
 */
import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Coins, Play, Settings, Shapes, ShoppingBag, Star } from 'lucide-react'
import { totalStars, useGameStore } from '@/lib/store'
import { TIERS } from '@/game/types'
import { faNum } from '@/lib/format'

interface FloatingShape {
  color: string
  size: number
  top?: string
  bottom?: string
  start?: string
  end?: string
  duration: number
  opacity: number
  radius: string
}

/* Decorative floating blobs painted with the merge-tier palette. */
const FLOATING_SHAPES: FloatingShape[] = [
  { color: TIERS[0].color, size: 110, top: '9%', start: '5%', duration: 7, opacity: 0.45, radius: 'rounded-full' },
  { color: TIERS[1].color, size: 64, top: '20%', end: '9%', duration: 8.5, opacity: 0.5, radius: 'rounded-3xl' },
  { color: TIERS[2].color, size: 44, top: '46%', start: '11%', duration: 6, opacity: 0.4, radius: 'rounded-full' },
  { color: TIERS[3].color, size: 82, bottom: '17%', end: '7%', duration: 9, opacity: 0.45, radius: 'rounded-[1.4rem]' },
  { color: TIERS[4].color, size: 56, bottom: '27%', start: '15%', duration: 7.5, opacity: 0.5, radius: 'rounded-2xl' },
  { color: TIERS[0].color, size: 34, top: '63%', end: '17%', duration: 5.5, opacity: 0.35, radius: 'rounded-full' },
]

export default function MainMenu() {
  const coins = useGameStore((s) => s.coins)
  const stars = useGameStore((s) => s.stars)
  const setScreen = useGameStore((s) => s.setScreen)
  const [logoOk, setLogoOk] = useState(true)

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#d9f7ea] via-[#a8ecd9] to-[#7fe0d4]">
      {/* Floating decorative shapes */}
      {FLOATING_SHAPES.map((shape, i) => (
        <motion.div
          key={i}
          aria-hidden="true"
          className={`pointer-events-none absolute ${shape.radius}`}
          style={{
            backgroundColor: shape.color,
            opacity: shape.opacity,
            width: shape.size,
            height: shape.size,
            top: shape.top,
            bottom: shape.bottom,
            insetInlineStart: shape.start,
            insetInlineEnd: shape.end,
          }}
          animate={{ y: [0, -26, 0], rotate: [0, 10, 0] }}
          transition={{ duration: shape.duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
        />
      ))}

      {/* Top corner chips */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <div className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 font-extrabold text-teal-900 shadow-sm backdrop-blur">
          <Coins className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <span>{faNum(coins)}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 font-extrabold text-teal-900 shadow-sm backdrop-blur">
          <Star className="h-5 w-5 text-amber-400" fill="currentColor" aria-hidden="true" />
          <span>{faNum(totalStars(stars))}</span>
        </div>
      </div>

      {/* Center content */}
      <main className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6">
        <div className="drop-shadow-[0_18px_20px_rgba(13,148,136,0.25)]">
          {logoOk ? (
            <Image
              src="/logo-boomchin.png"
              width={240}
              height={240}
              alt="لوگوی بازی"
              priority
              className="rounded-[2.5rem]"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-white/70 shadow-inner">
              <Shapes className="h-16 w-16 text-teal-600" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-5xl font-black tracking-wide text-teal-900 drop-shadow-sm sm:text-6xl">بوم چین</h1>
          <p className="mt-1 text-lg font-bold text-teal-800/80">بچین، ادغام کن، بشکن!</p>
        </div>

        <nav aria-label="منوی اصلی" className="mx-auto w-full max-w-xs space-y-4 pt-2">
          <button
            type="button"
            aria-label="شروع بازی"
            onClick={() => setScreen('levels')}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-3xl border-b-[6px] border-emerald-700 bg-emerald-500 text-xl font-black text-white shadow-lg transition-all hover:bg-emerald-600 active:translate-y-1.5 active:border-b-0"
          >
            <Play className="h-6 w-6 fill-current" aria-hidden="true" />
            شروع بازی
          </button>
          <button
            type="button"
            aria-label="فروشگاه"
            onClick={() => setScreen('shop')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl border-b-4 border-teal-200 bg-white/85 font-extrabold text-teal-900 shadow transition-all hover:bg-white active:translate-y-0.5 active:border-b-0"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            فروشگاه
          </button>
          <button
            type="button"
            aria-label="تنظیمات"
            onClick={() => setScreen('settings')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl border-b-4 border-teal-200 bg-white/85 font-extrabold text-teal-900 shadow transition-all hover:bg-white active:translate-y-0.5 active:border-b-0"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            تنظیمات
          </button>
        </nav>
      </main>

      {/* Footnote */}
      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-center text-xs font-bold text-teal-800/60">
        نسخه ۲.۰.۰ — بیش از ۱۰۰ مرحله — ساخته‌شده با Three.js
      </p>
    </div>
  )
}
