package com.boomchin.game;

/**
 * تنظیمات برنامه‌ی اندروید «بوم چین».
 */
public final class Config {

    /** آدرس سایت بازی */
    public static final String SITE_URL = "https://boomchinn.vercel.app";

    /** دامنه‌ی سایت — لینک‌های داخلی در WebView باز می‌شوند، بقیه در مرورگر */
    public static final String SITE_HOST = "boomchinn.vercel.app";

    /**
     * کلید عمومی RSA پرداخت درون‌برنامه‌ای کافه بازار.
     *
     * محل گرفتن: پنل توسعه‌دهندگان بازار (developers.cafebazaar.ir) →
     * انتخاب برنامه → «پرداخت درون‌برنامه‌ای» → کپی کلید RSA
     *
     * کلید را دقیقاً بین دو کوتیشن بچسبان (همان رشته‌ی طولانی base64 که
     * با gAAAA شروع می‌شود). تا وقتی خالی باشد، خرید واقعی غیرفعال است و
     * بازی به‌صورت خودکار از خرید نمایشی استفاده می‌کند.
     */
    public static final String BAZAAR_RSA_KEY = "";

    /**
     * شناسه‌ی بسته‌های سکه در پنل بازار.
     * این ۴ محصول باید در بخش «پرداخت درون‌برنامه‌ای» پنل بازار دقیقاً
     * با همین شناسه‌ها ساخته شوند:
     *   pack_s  → بسته‌ی کوچک (۵۰۰ سکه)
     *   pack_m  → بسته‌ی متوسط (۳٬۰۰۰ سکه)
     *   pack_l  → بسته‌ی بزرگ (۸٬۵۰۰ سکه)
     *   pack_xl → بسته‌ی ویژه (۱۸٬۰۰۰ سکه)
     */
    public static final String[] PURCHASABLE_SKUS = { "pack_s", "pack_m", "pack_l", "pack_xl" };

    private Config() {
        // no instances
    }
}
