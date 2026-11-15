'use client'

/**
 * Settings screen — player name, haptics/shadows toggles + reset progress.
 */
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Copy, KeyRound, Pencil, ShieldCheck, SunMedium, Trash2, UserRound, Vibrate, Volume2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { useGameStore, getPlayerId, type Settings } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import NameDialog from './NameDialog'

interface SettingRow {
  key: keyof Settings
  label: string
  icon: LucideIcon
  tint: string
}

const ROWS: SettingRow[] = [
  { key: 'sound', label: 'صدای موفقیت (ادغام توپ‌ها)', icon: Volume2, tint: 'bg-teal-100 text-teal-600' },
  { key: 'haptics', label: 'لرزش', icon: Vibrate, tint: 'bg-amber-100 text-amber-600' },
  { key: 'shadows', label: 'سایه‌ها (کیفیت گرافیک)', icon: SunMedium, tint: 'bg-pink-100 text-pink-500' },
]

export default function SettingsScreen() {
  const settings = useGameStore((s) => s.settings)
  const name = useGameStore((s) => s.name)
  const adminDevice = useGameStore((s) => s.adminDevice)
  const toggleSetting = useGameStore((s) => s.toggleSetting)
  const resetProgress = useGameStore((s) => s.resetProgress)
  const setScreen = useGameStore((s) => s.setScreen)
  const { toast } = useToast()
  const [nameOpen, setNameOpen] = useState(false)
  const [deviceId] = useState(() => getPlayerId())

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#d9f7ea] via-[#a8ecd9] to-[#7fe0d4]">
      {/* Header */}
      <header
        className="flex shrink-0 items-center gap-3 px-4"
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
        <h1 className="text-3xl font-black text-teal-900">تنظیمات</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto game-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          {/* Player identity card */}
          <section
            aria-label="نام بازیکن"
            className="w-full rounded-3xl bg-white p-6 shadow-md"
          >
            <p className="mb-3 text-xs font-black text-teal-500">رقابت</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-2xl bg-teal-100 p-2 text-teal-700">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate font-extrabold text-teal-900">{name || 'بی‌نام'}</span>
                  <span className="block text-[11px] font-bold text-teal-700/70">نام تو در جدول رقابت</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="تغییر نام بازیکن"
                onClick={() => setNameOpen(true)}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-teal-700 active:scale-95"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                ویرایش
              </button>
            </div>
          </section>

          {/* Toggles card */}
          <section
            aria-label="تنظیمات بازی"
            className="w-full space-y-5 rounded-3xl bg-white p-6 shadow-md"
          >
            {ROWS.map((row) => {
              const Icon = row.icon
              return (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`shrink-0 rounded-2xl p-2 ${row.tint}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="truncate font-extrabold text-teal-900">{row.label}</span>
                  </div>
                  <Switch
                    checked={settings[row.key]}
                    onCheckedChange={() => toggleSetting(row.key)}
                    aria-label={row.label}
                    className="h-6 w-10 data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-teal-200"
                  />
                </div>
              )
            })}
          </section>

          {/* Device id + admin card */}
          <section
            aria-label="شناسه دستگاه و مدیریت"
            className="w-full space-y-3 rounded-3xl bg-white p-6 shadow-md"
          >
            <p className="text-xs font-black text-teal-500">شناسه دستگاه</p>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-2xl bg-teal-50 px-3 py-2.5 text-left font-mono text-xs text-teal-800"
              >
                {deviceId}
              </code>
              <button
                type="button"
                aria-label="کپی شناسه دستگاه"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(deviceId)
                    toast({ title: 'شناسه دستگاه کپی شد' })
                  } catch {
                    toast({ title: 'کپی ناموفق بود', variant: 'destructive' })
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm transition-all hover:bg-teal-700 active:scale-95"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-[11px] font-bold leading-5 text-teal-700/60">
              این شناسه هویت دستگاه شما در جدول رقابت است. برای ورود به پنل مدیریت، شناسه‌ی مدیر
              لازم است.
            </p>
            <button
              type="button"
              aria-label={adminDevice ? 'ورود به پنل مدیریت' : 'ورود مدیر'}
              onClick={() => setScreen('admin')}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-3xl border-b-4 font-black text-white shadow-lg transition-all active:translate-y-1 active:border-b-0 ${
                adminDevice
                  ? 'border-teal-700 bg-teal-600 hover:bg-teal-700'
                  : 'border-teal-800/60 bg-teal-800 hover:bg-teal-900'
              }`}
            >
              {adminDevice ? (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              )}
              {adminDevice ? 'پنل مدیریت' : 'ورود مدیر'}
            </button>
          </section>

          {/* Danger zone */}
          <section
            aria-label="محدوده‌ی خطر"
            className="w-full rounded-3xl bg-white p-6 shadow-md"
          >
            <p className="mb-3 text-xs font-black text-red-500">محدوده‌ی خطر</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label="پاک کردن پیشرفت"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-3xl border-b-4 border-red-700 bg-red-500 font-black text-white shadow-lg transition-all hover:bg-red-600 active:translate-y-1 active:border-b-0"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                  پاک کردن پیشرفت
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm rounded-3xl border-teal-100 p-6">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black text-teal-900">مطمئنی؟</AlertDialogTitle>
                  <AlertDialogDescription className="font-bold text-teal-700">
                    همه‌ی سکه‌ها، ستاره‌ها و خریدهای تو پاک می‌شوند.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11 rounded-2xl border-teal-100 bg-teal-50 font-extrabold text-teal-800 hover:bg-teal-100">
                    انصراف
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="h-11 rounded-2xl bg-red-500 font-black text-white hover:bg-red-600"
                    onClick={() => {
                      resetProgress()
                      toast({ title: 'پیشرفت پاک شد' })
                    }}
                  >
                    پاک کن
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </div>
      </div>

      <NameDialog
        open={nameOpen}
        onOpenChange={setNameOpen}
        onSaved={() => toast({ title: 'نام بازیکن ذخیره شد' })}
      />
    </div>
  )
}
