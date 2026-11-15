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
     * منبع: پنل توسعه‌دهندگان بازار → برنامه «بوم چین» → پرداخت درون‌برنامه‌ای.
     * تا وقتی این کلید تنظیم باشد، خرید واقعی بازار فعال است.
     */
    public static final String BAZAAR_RSA_KEY =
            "MIHNMA0GCSqGSIb3DQEBAQUAA4G7ADCBtwKBrwDAD/RufsTIAv4tPRtbc1RewBoYmN6BX2Kf3Pfw5zIc23EpzV9LcJY0hH5d4SIeRAQSwH1Cb/co0sOrQO7Msl427XAqn0e1Nm94lS51lSO0zy5JdlR7XvEuHHiZxXxMP9hcZD+fBn2FcsODlQcR+/ZjyNQ6DyE+TUeQzLJsbL0dypnKbMJIuaNNWOVq210OxpO8O9k1/0xWrYSWDtKu3joczcNPrtcE37zoQkxgFu8CAwEAAQ==";

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
