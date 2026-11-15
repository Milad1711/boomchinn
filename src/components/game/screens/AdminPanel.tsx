'use client'

/**
 * Admin panel — credential gated screen.
 * Login: paste the admin device id OR the admin password (server-validated on every call).
 * Powers: browse/search every player, gift coins from the list, or quick-gift
 * any amount to any device id directly.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Coins,
  Gift,
  Hash,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Star,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useGameStore } from '@/lib/store'
import { faNum } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent'

interface AdminUser {
  id: string
  name: string
  coins: number
  totalStars: number
  createdAt: string
  updatedAt: string
}

interface AdminData {
  stats: { players: number; coins: number }
  users: AdminUser[]
}

/** Quick chip amounts offered in the gift dialog. */
const QUICK_AMOUNTS = [100, 500, 1000, 10000, 100000]

/** Convert Persian/Arabic digits to Latin and parse an integer (null if invalid). */
function parseAmount(raw: string): number | null {
  const latin = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٬\s]/g, '')
  if (!/^\d+$/.test(latin)) return null
  const n = Number(latin)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Short display form of a device id: first 8 chars + … */
function shortId(id: string): string {
  return `${id.slice(0, 8)}…`
}

export default function AdminPanel() {
  const adminDevice = useGameStore((s) => s.adminDevice)
  const setAdminDevice = useGameStore((s) => s.setAdminDevice)
  const clearAdminDevice = useGameStore((s) => s.clearAdminDevice)
  const setScreen = useGameStore((s) => s.setScreen)
  const { toast } = useToast()

  const [deviceInput, setDeviceInput] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  // gift dialog state
  const [giftUser, setGiftUser] = useState<AdminUser | null>(null)
  const [giftRaw, setGiftRaw] = useState('')
  const [gifting, setGifting] = useState(false)

  // quick gift by device-id state
  const [quickId, setQuickId] = useState('')
  const [quickRaw, setQuickRaw] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)

  const giftAmount = parseAmount(giftRaw)
  const quickAmount = parseAmount(quickRaw)

  /** Fetch users. 'unauthorized' means the device id was rejected by the server. */
  const load = useCallback(
    async (device: string, q = '') => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, {
          headers: { 'x-admin-device': device },
        })
        if (res.status === 401) return 'unauthorized' as const
        if (!res.ok) throw new Error('bad status')
        setData((await res.json()) as AdminData)
        return 'ok' as const
      } catch {
        toast({ title: 'خطا در دریافت اطلاعات', variant: 'destructive' })
        return 'error' as const
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  /**
   * Single load effect: (re)fetches when the session changes, and debounces
   * free-text search. A rejected id clears the session back to the login form.
   */
  useEffect(() => {
    if (!adminDevice) {
      setData(null)
      return
    }
    let cancelled = false
    const t = setTimeout(
      async () => {
        const res = await load(adminDevice, query)
        if (cancelled) return
        if (res === 'unauthorized') {
          clearAdminDevice()
          toast({ title: 'شناسه یا رمز مدیر معتبر نیست', variant: 'destructive' })
        }
      },
      query ? 300 : 0
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [adminDevice, query, load, clearAdminDevice, toast])

  const signIn = () => {
    const device = deviceInput.trim()
    if (!device) return
    // the load effect validates it; on failure we are sent back here
    setAdminDevice(device)
  }

  const sendGift = async () => {
    if (!adminDevice || !giftUser || !giftAmount) return
    setGifting(true)
    try {
      const res = await fetch('/api/admin/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-device': adminDevice },
        body: JSON.stringify({ playerId: giftUser.id, coins: giftAmount }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok: true; player: { coins: number }; gifted: number }
        | { ok?: false; error?: string }
        | null
      if (res.ok && json && 'ok' in json && json.ok) {
        // reflect the new balance immediately in the list
        setData((d) =>
          d
            ? {
                ...d,
                stats: { ...d.stats, coins: d.stats.coins + json.gifted },
                users: d.users.map((u) =>
                  u.id === giftUser.id ? { ...u, coins: json.player.coins } : u
                ),
              }
            : d
        )
        toast({
          title: `هدیه ارسال شد — ${faNum(json.gifted)} سکه به «${giftUser.name || 'بی‌نام'}»`,
        })
        setGiftUser(null)
        setGiftRaw('')
      } else {
        toast({
          title: (json && 'error' in json && json.error) || 'ارسال هدیه ناموفق بود',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'ارتباط با سرور برقرار نشد', variant: 'destructive' })
    } finally {
      setGifting(false)
    }
  }

  const filteredCount = useMemo(() => data?.users.length ?? 0, [data])

  /** Quick gift: send coins straight to a pasted device id. */
  const sendQuickGift = async () => {
    if (!adminDevice || !quickAmount) return
    const targetId = quickId.trim()
    if (!targetId || targetId.length > 64) {
      toast({ title: 'شناسه دستگاه را کامل وارد کنید', variant: 'destructive' })
      return
    }
    setQuickBusy(true)
    try {
      const res = await fetch('/api/admin/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-device': adminDevice },
        body: JSON.stringify({ playerId: targetId, coins: quickAmount }),
      })
      if (res.status === 404) {
        toast({ title: 'بازیکنی با این شناسه پیدا نشد', variant: 'destructive' })
        return
      }
      if (res.status === 401) {
        clearAdminDevice()
        toast({ title: 'جلسه مدیر منقضی شد — دوباره وارد شوید', variant: 'destructive' })
        return
      }
      const json = (await res.json().catch(() => null)) as
        | { ok: true; player: { id: string; name: string; coins: number }; gifted: number }
        | { ok?: false; error?: string }
        | null
      if (res.ok && json && 'ok' in json && json.ok) {
        toast({
          title: `${faNum(json.gifted)} سکه به «${json.player.name || 'بی‌نام'}» هدیه داده شد — موجودی جدید: ${faNum(json.player.coins)}`,
        })
        setQuickId('')
        setQuickRaw('')
        void load(adminDevice, query) // refresh list/stats
      } else {
        toast({
          title: (json && 'error' in json && json.error) || 'ارسال هدیه ناموفق بود',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'ارتباط با سرور برقرار نشد', variant: 'destructive' })
    } finally {
      setQuickBusy(false)
    }
  }

  // ------------------------------------------------------------ login screen
  if (!adminDevice) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#d9f7ea] via-[#a8ecd9] to-[#7fe0d4]">
        <Header onBack={() => setScreen('settings')} title="پنل مدیریت" />
        <div className="flex flex-1 items-center justify-center px-4 pb-10">
          <section
            aria-label="ورود مدیر"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-md"
          >
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <span className="rounded-3xl bg-teal-100 p-4 text-teal-700">
                <KeyRound className="h-8 w-8" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-black text-teal-900">ورود مدیر</h2>
              <p className="text-sm font-bold leading-6 text-teal-700/80">
                شناسه‌ی دستگاه مدیر یا رمز مدیر را وارد کنید تا به پنل دسترسی پیدا کنید.
              </p>
            </div>
            <Input
              dir="ltr"
              value={deviceInput}
              onChange={(e) => setDeviceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
              placeholder="شناسه دستگاه یا رمز مدیر"
              aria-label="شناسه دستگاه یا رمز مدیر"
              className="h-12 rounded-2xl border-teal-100 bg-teal-50/60 text-left font-mono text-sm text-teal-900 placeholder:font-sans placeholder:text-teal-700/40 focus-visible:ring-teal-400"
            />
            <button
              type="button"
              onClick={signIn}
              disabled={!deviceInput.trim()}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-3xl border-b-4 border-teal-700 bg-teal-600 font-black text-white shadow-lg transition-all hover:bg-teal-700 active:translate-y-1 active:border-b-0 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              )}
              ورود
            </button>
          </section>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------ admin screen
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#d9f7ea] via-[#a8ecd9] to-[#7fe0d4]">
      <Header
        onBack={() => setScreen('settings')}
        title="پنل مدیریت"
        action={
          <button
            type="button"
            aria-label="خروج از پنل مدیریت"
            onClick={() => {
              clearAdminDevice()
              setDeviceInput('')
              toast({ title: 'از پنل مدیریت خارج شدید' })
            }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-red-500 shadow transition-all hover:bg-white active:scale-95"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        }
      />

      <div
        className={`flex-1 overflow-y-auto ${SCROLLBAR}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-2">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users} label="بازیکن‌ها" value={faNum(data?.stats.players ?? 0)} />
            <StatCard icon={Coins} label="مجموع سکه‌ها" value={faNum(data?.stats.coins ?? 0)} />
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی نام یا شناسه…"
              aria-label="جستجوی بازیکن"
              className="h-12 rounded-2xl border-teal-100 bg-white ps-10 font-bold text-teal-900 shadow-sm placeholder:text-teal-700/40 focus-visible:ring-teal-400"
            />
          </div>

          {/* Quick gift by device id */}
          <section
            aria-label="هدیه سریع با شناسه دستگاه"
            className="w-full rounded-3xl bg-white p-4 shadow-md"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="rounded-xl bg-amber-100 p-1.5 text-amber-600">
                <Hash className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-black text-teal-500">هدیه سریع با شناسه دستگاه</p>
            </div>
            <div className="space-y-2.5">
              <Input
                dir="ltr"
                value={quickId}
                onChange={(e) => setQuickId(e.target.value)}
                placeholder="شناسه دستگاه بازیکن (کپی از تنظیمات بازی او)"
                aria-label="شناسه دستگاه بازیکن"
                className="h-11 rounded-2xl border-teal-100 bg-teal-50/60 text-left font-mono text-xs text-teal-900 placeholder:font-sans placeholder:text-teal-700/40 focus-visible:ring-teal-400"
              />
              <div className="flex gap-2.5">
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  value={quickRaw}
                  onChange={(e) => setQuickRaw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && quickAmount && void sendQuickGift()}
                  placeholder="مثلاً 10000"
                  aria-label="مقدار سکه برای هدیه سریع"
                  className="h-11 flex-1 rounded-2xl border-teal-100 bg-teal-50/60 text-center font-black text-teal-900 placeholder:font-bold placeholder:text-teal-700/40 focus-visible:ring-teal-400"
                />
                <button
                  type="button"
                  onClick={() => void sendQuickGift()}
                  disabled={!quickAmount || !quickId.trim() || quickBusy}
                  aria-label="ارسال هدیه سریع"
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border-b-[3px] border-amber-600 bg-amber-400 px-4 text-sm font-black text-amber-950 shadow transition-all hover:bg-amber-300 active:translate-y-0.5 active:border-b-0 disabled:opacity-50"
                >
                  {quickBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Gift className="h-4 w-4" aria-hidden="true" />
                  )}
                  هدیه
                </button>
              </div>
              <p className="text-center text-[11px] font-bold text-teal-700/60" aria-live="polite">
                {quickAmount
                  ? `${faNum(quickAmount)} سکه به موجودی بازیکن اضافه می‌شود`
                  : 'مقدار سکه را وارد کنید'}
              </p>
            </div>
          </section>

          {/* User list */}
          <section aria-label="لیست بازیکن‌ها" className="w-full rounded-3xl bg-white p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-black text-teal-500">
                بازیکن‌ها {query ? `(${faNum(filteredCount)} نتیجه)` : ''}
              </p>
              <button
                type="button"
                aria-label="به‌روزرسانی لیست"
                onClick={() => void load(adminDevice, query)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-teal-600 transition hover:bg-teal-50 active:scale-90"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>

            {loading && !data ? (
              <div className="flex h-40 items-center justify-center text-teal-600">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              </div>
            ) : filteredCount === 0 ? (
              <p className="py-10 text-center text-sm font-bold text-teal-700/60">
                بازیکنی پیدا نشد.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pe-1">
                {data?.users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2.5 rounded-2xl bg-teal-50/70 p-3"
                  >
                    <span className="shrink-0 rounded-xl bg-white p-2 text-teal-600 shadow-sm">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-teal-900">
                        {u.name || 'بی‌نام'}
                      </span>
                      <span
                        dir="ltr"
                        className="block text-left font-mono text-[10px] text-teal-700/60"
                      >
                        {shortId(u.id)}
                      </span>
                    </div>
                    <div className="shrink-0 text-end">
                      <span className="flex items-center justify-end gap-1 text-sm font-black text-amber-600">
                        <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                        {faNum(u.coins)}
                      </span>
                      <span className="flex items-center justify-end gap-1 text-[11px] font-bold text-teal-700/70">
                        <Star className="h-3 w-3" fill="currentColor" aria-hidden="true" />
                        {faNum(u.totalStars)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`هدیه سکه به ${u.name || 'بی‌نام'}`}
                      onClick={() => {
                        setGiftUser(u)
                        setGiftRaw('')
                      }}
                      className="flex h-10 shrink-0 items-center gap-1 rounded-2xl border-b-[3px] border-amber-600 bg-amber-400 px-3 text-xs font-black text-amber-950 shadow transition-all hover:bg-amber-300 active:translate-y-0.5 active:border-b-0"
                    >
                      <Gift className="h-4 w-4" aria-hidden="true" />
                      هدیه
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="px-2 text-center text-[11px] font-bold leading-5 text-teal-700/60">
            سکه‌ی هدیه به موجودی بازیکن اضافه می‌شود؛ بازیکن پس از ورود دوباره به بازی آن را
            می‌بیند.
          </p>
        </div>
      </div>

      {/* Gift dialog */}
      <Dialog
        open={giftUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGiftUser(null)
            setGiftRaw('')
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl border-teal-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-teal-900">
              هدیه سکه به «{giftUser?.name || 'بی‌نام'}»
            </DialogTitle>
            <DialogDescription className="font-bold text-teal-700">
              هر مقدار سکه‌ای که بخواهید به موجودی این بازیکن اضافه کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              dir="ltr"
              inputMode="numeric"
              autoFocus
              value={giftRaw}
              onChange={(e) => setGiftRaw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && giftAmount && void sendGift()}
              placeholder="مثلاً 10000"
              aria-label="مقدار سکه"
              className="h-12 rounded-2xl border-teal-100 bg-teal-50/60 text-center text-lg font-black tracking-wider text-teal-900 placeholder:font-bold placeholder:text-teal-700/40 focus-visible:ring-teal-400"
            />
            <p className="text-center text-sm font-black text-amber-600" aria-live="polite">
              {giftAmount ? `${faNum(giftAmount)} سکه` : 'مقدار معتبر وارد کنید'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setGiftRaw(String(a))}
                  className="rounded-full bg-teal-50 px-3.5 py-1.5 text-xs font-black text-teal-700 transition hover:bg-teal-100 active:scale-95"
                >
                  {faNum(a)}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setGiftUser(null)
                setGiftRaw('')
              }}
              className="h-11 flex-1 rounded-2xl border border-teal-100 bg-teal-50 font-extrabold text-teal-800 transition hover:bg-teal-100 active:scale-95"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => void sendGift()}
              disabled={!giftAmount || gifting}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border-b-4 border-amber-600 bg-amber-400 font-black text-amber-950 shadow transition-all hover:bg-amber-300 active:translate-y-0.5 active:border-b-0 disabled:opacity-50"
            >
              {gifting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Gift className="h-5 w-5" aria-hidden="true" />
              )}
              هدیه سکه
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Shared screen header. */
function Header({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <header
      className="flex shrink-0 items-center gap-3 px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)', paddingBottom: '0.75rem' }}
    >
      <button
        type="button"
        aria-label="بازگشت"
        onClick={onBack}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-teal-900 shadow transition-all hover:bg-white active:scale-95"
      >
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
      <h1 className="flex-1 text-2xl font-black text-teal-900">{title}</h1>
      {action}
    </header>
  )
}

/** Small stat tile for the top row. */
function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-md">
      <span className="shrink-0 rounded-2xl bg-teal-100 p-2.5 text-teal-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <span className="block truncate text-[11px] font-bold text-teal-700/70">{label}</span>
        <span className="block text-lg font-black text-teal-900">{value}</span>
      </div>
    </div>
  )
}
