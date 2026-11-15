/**
 * کافه بازار — لایه‌ی خرید درون‌برنامه‌ای.
 *
 * وقتی بازی داخل برنامه‌ی اندروید رسمی (پوشه‌ی bazaar-android) اجرا شود،
 * سمت اندروید آبجکت `window.BoomChinAndroid` تزریق می‌شود و خریدها از طریق
 * پرداخت درون‌برنامه‌ای کافه بازار انجام می‌شود. خارج از برنامه (مرورگر/PWA)
 * همان خرید نمایشی قبلی استفاده می‌شود.
 *
 * شناسه‌ی محصولات (SKU) باید در پنل بازار (پرداخت درون‌برنامه‌ای) دقیقاً
 * با همین نام‌ها ساخته شوند.
 */

export type BazaarPurchaseState = 'success' | 'cancel' | 'fail'

export interface BazaarResult {
  state: BazaarPurchaseState
  sku?: string
  restored?: boolean
  message?: string
}

interface BazaarBridge {
  isBazaar(): boolean
  purchase(sku: string, payload?: string): void
}

declare global {
  interface Window {
    BoomChinAndroid?: BazaarBridge
    onBazaarResult?: (result: BazaarResult) => void
    onBazaarRestore?: (result: BazaarResult) => void
  }
}

/**
 * شناسه‌ی ۴ بسته‌ی سکه در کافه بازار
 * (قیمت‌ها در پنل بازار تعیین می‌شوند — مطابق COIN_PACKS در store.ts)
 */
export const BAZAAR_SKUS = ['pack_s', 'pack_m', 'pack_l', 'pack_xl'] as const

export type BazaarSku = (typeof BAZAAR_SKUS)[number]

/** وقتی بازی داخل برنامه‌ی بازار اجرا می‌شود true برمی‌گرداند. */
export function isInBazaarApp(): boolean {
  return getBazaarBridge() !== null
}

/** بریج بومی اندروید — یا null در مرورگر. */
export function getBazaarBridge(): BazaarBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = window.BoomChinAndroid
  if (
    bridge &&
    typeof bridge.isBazaar === 'function' &&
    typeof bridge.purchase === 'function' &&
    bridge.isBazaar()
  ) {
    return bridge
  }
  return null
}

/**
 * شروع خرید یک SKU از کافه بازار. نتیجه وقتی برمی‌گردد که سمت اندروید
 * جواب بدهد (موفق/لغو/خطا) یا ۵ دقیقه timeout شود.
 */
export function purchaseOnBazaar(sku: string): Promise<BazaarResult> {
  return new Promise((resolve) => {
    const bridge = getBazaarBridge()
    if (!bridge) {
      resolve({ state: 'fail', sku, message: 'bazaar-unavailable' })
      return
    }
    let done = false
    const finish = (result: BazaarResult) => {
      if (done) return
      done = true
      window.onBazaarResult = undefined
      clearTimeout(timer)
      resolve({ ...result, sku: result.sku ?? sku })
    }
    window.onBazaarResult = (result) => finish({ ...result, sku: result.sku ?? sku })
    const timer = setTimeout(() => finish({ state: 'fail', sku, message: 'timeout' }), 5 * 60 * 1000)
    try {
      bridge.purchase(sku, sku)
    } catch {
      finish({ state: 'fail', sku, message: 'bridge-error' })
    }
  })
}

/**
 * سمت اندروید ممکن است هر لحظه خریدهای «برگشتی» را اطلاع دهد (مثلاً اگر
 * برنامه وسط خرید بسته شده باشد). آن‌ها را به یک Event سراسری تبدیل می‌کنیم
 * تا store سکه‌ها را اعتبار کند.
 */
if (typeof window !== 'undefined') {
  window.onBazaarRestore = (result: BazaarResult) => {
    try {
      window.dispatchEvent(new CustomEvent<BazaarResult>('bazaar-restore', { detail: result }))
    } catch {
      /* ignore */
    }
  }
}
