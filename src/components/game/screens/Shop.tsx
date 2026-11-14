'use client'

/**
 * Shop screen — helper items and ball skins, paid with coins.
 */
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Bomb, CirclePlus, Coins } from 'lucide-react'
import { BALL_SKINS, SHOP_ITEMS, useGameStore, type ShopItemDef, type SkinDef } from '@/lib/store'
import { faNum } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

const ITEM_ICONS: Record<ShopItemDef['id'], LucideIcon> = {
  extraShot: CirclePlus,
  bombShot: Bomb,
}

const SCROLLBAR =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-300/60 [&::-webkit-scrollbar-track]:bg-transparent'

export default function Shop() {
  const coins = useGameStore((s) => s.coins)
  const items = useGameStore((s) => s.items)
  const buyItem = useGameStore((s) => s.buyItem)
  const buySkin = useGameStore((s) => s.buySkin)
  const equipSkin = useGameStore((s) => s.equipSkin)
  const setScreen = useGameStore((s) => s.setScreen)
  const { toast } = useToast()

  const handleBuyItem = (item: ShopItemDef) => {
    const ok = buyItem(item.id)
    if (ok) toast({ title: 'خرید انجام شد!', description: item.name })
    else toast({ title: 'سکه کافی نداری!', variant: 'destructive' })
  }

  const handleBuySkin = (skin: SkinDef) => {
    const ok = buySkin(skin.id)
    if (ok) toast({ title: 'خرید انجام شد!', description: skin.name })
    else toast({ title: 'سکه کافی نداری!', variant: 'destructive' })
  }

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
        <h1 className="text-3xl font-black text-teal-900">فروشگاه</h1>
        <div
          className="pointer-events-none flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-sm font-extrabold text-teal-900 shadow-sm backdrop-blur"
          aria-label={`تعداد سکه‌ها: ${faNum(coins)}`}
        >
          <Coins className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span>{faNum(coins)}</span>
        </div>
      </header>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto game-scroll ${SCROLLBAR}`}>
        <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          {/* Helper items */}
          <section aria-labelledby="shop-items-title">
            <h2 id="shop-items-title" className="mb-3 text-lg font-black text-teal-900">
              آیتم‌های کمکی
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {SHOP_ITEMS.map((item) => {
                const Icon = ITEM_ICONS[item.id]
                const owned = items[item.id]
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-md">
                    <span className="shrink-0 rounded-2xl bg-emerald-100 p-3 text-emerald-600">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-teal-900">{item.name}</p>
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">
                          داری: {faNum(owned)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-teal-700">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={coins < item.price}
                      aria-label={`خرید ${item.name} به قیمت ${faNum(item.price)} سکه`}
                      onClick={() => handleBuyItem(item)}
                      className="flex h-11 shrink-0 items-center gap-1 rounded-2xl bg-amber-400 font-black text-amber-950 shadow-sm transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Coins className="h-4 w-4" aria-hidden="true" />
                      {faNum(item.price)}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Ball skins */}
          <section aria-labelledby="shop-skins-title">
            <h2 id="shop-skins-title" className="mb-3 text-lg font-black text-teal-900">
              ظاهر توپ
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {BALL_SKINS.map((skin) => {
                const equipped = items.skin === skin.id
                const owned = items.skins.includes(skin.id)
                return (
                  <div
                    key={skin.id}
                    className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-md"
                  >
                    <span
                      className="mx-auto h-10 w-10 rounded-full border-4 border-white shadow-inner"
                      style={{ background: skin.color }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-extrabold text-teal-900">{skin.name}</p>
                    {equipped ? (
                      <button
                        type="button"
                        disabled
                        aria-label={`${skin.name} در حال حاضر مجهز است`}
                        className="flex h-11 w-full cursor-default items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white"
                      >
                        مجهز
                      </button>
                    ) : owned ? (
                      <button
                        type="button"
                        aria-label={`انتخاب ${skin.name}`}
                        onClick={() => equipSkin(skin.id)}
                        className="flex h-11 w-full items-center justify-center rounded-2xl bg-teal-600 text-sm font-black text-white transition-colors hover:bg-teal-700"
                      >
                        انتخاب
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={coins < skin.price}
                        aria-label={`خرید ${skin.name} به قیمت ${faNum(skin.price)} سکه`}
                        onClick={() => handleBuySkin(skin)}
                        className="flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-amber-400 text-sm font-black text-amber-950 transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Coins className="h-4 w-4" aria-hidden="true" />
                        {faNum(skin.price)}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
