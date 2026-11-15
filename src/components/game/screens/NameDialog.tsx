'use client'

/**
 * NameDialog — lets the player pick the display name used in competitions.
 * Shared by the leaderboard screen and the settings screen.
 */
import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NAME_MAX, sanitizeNameLocal, useGameStore } from '@/lib/store'

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional callback fired after a successful save. */
  onSaved?: () => void
  /** When true the player cannot close without choosing a name. */
  required?: boolean
}

export default function NameDialog({ open, onOpenChange, onSaved, required = false }: NameDialogProps) {
  const name = useGameStore((s) => s.name)
  const setName = useGameStore((s) => s.setName)
  const [value, setValue] = useState(name)
  const [prevOpen, setPrevOpen] = useState(open)

  // keep the field in sync with the saved name whenever it opens
  // (state adjustment during render — the React-recommended pattern)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setValue(name)
  }

  const clean = sanitizeNameLocal(value)
  const canSave = clean.length > 0

  const save = () => {
    if (!canSave) return
    setName(clean)
    onSaved?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (required ? false : onOpenChange(next))}>
      <DialogContent className="max-w-xs rounded-[1.75rem] p-6 sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <span className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600">
            <UserRound className="h-7 w-7" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl font-black text-teal-900">اسمت چیه؟</DialogTitle>
          <DialogDescription className="text-sm font-bold leading-6 text-teal-700">
            با این نام در جدول رقابت با بقیه‌ی بازیکن‌ها دیده می‌شوی.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="flex w-full flex-col gap-3"
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="مثلاً: علی قهرمان"
            aria-label="نام بازیکن"
            maxLength={NAME_MAX}
            autoFocus
            className="h-12 rounded-2xl border-teal-200 bg-teal-50/60 text-center text-base font-extrabold text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-teal-400"
          />
          <p className="text-center text-[11px] font-bold text-teal-700/70">
            {clean.length > 0 ? `${clean.length} از ${NAME_MAX}` : `حداکثر ${NAME_MAX} حرف`}
          </p>
          <Button
            type="submit"
            disabled={!canSave}
            className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-black text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            ثبت نام
          </Button>
          {!required && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 w-full rounded-2xl font-bold text-teal-700 hover:text-teal-900"
            >
              بعداً
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
