# بوم چین (Boom Chin)

بازی موبایلی «مرتب‌سازی + ادغام + فیزیک» — بچین، ادغام کن، بشکن!

- بیش از **۱۰۰ مرحله** با سه درجه سختی (۱–۲۹ آسان، ۳۰–۵۹ متوسط، ۶۰+ سخت)
- سیستم ادغام ۵ سطحی + انفجار ستاره‌ای در بالاترین سطح
- موشک هدیت‌شونده برای شکستن موانع چوبی / بلوری / سنگی با واکنش‌های زنجیره‌ای
- **صدای موفقیت** سنتزشده (Web Audio) هنگام ادغام دو توپ — بدون فایل صوتی
- لرزش (Haptics)، ذرات، موج انفجار و افکت‌های سه‌بعدی (Three.js + cannon-es)
- سکه، فروشگاه ۴ بسته‌ای (۹٬۰۰۰ تا ۲۴۹٬۰۰۰ تومان)، اسکین توپ، موشک اضافه و بمبی
- **نام بازیکن + جدول رقابت** (Leaderboard) با ذخیره‌ی پیشرفت روی سرور
- PWA — روی گوشی اندروید قابل نصب است (Add to Home Screen)

## فناوری‌ها

| لایه | ابزار |
|---|---|
| فریم‌ورک | Next.js 16 (App Router) + TypeScript |
| بازی | Three.js (رندر) + cannon-es (فیزیک) |
| UI | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| State | Zustand + localStorage |
| دیتابیس | Prisma + SQLite (محلی) / **Turso** (تولید) |

## اجرای محلی

```bash
bun install                # نصب وابستگی‌ها
bun run db:push            # ساخت دیتابیس SQLite محلی (db/custom.db)
bun run dev                # http://localhost:3000
```

## ساختار مهم پروژه

```
src/
  app/                  # صفحه اصلی، API routes (progress, leaderboard)
  components/game/      # GameShell، منو، مراحل، فروشگاه، جدول رقابت، تنظیمات
  game/                 # engine.ts (موتور سه‌بعدی)، levels.ts (۱۰۰+ مرحله)،
                        # effects.ts (ذرات و افکت)، audio.ts (صدای موفقیت)
  lib/                  # store.ts (Zustand)، db.ts (Prisma/Turso)
prisma/schema.prisma    # مدل PlayerProgress
public/                 # آیکون‌ها + manifest.json (PWA)
```

---

## استقرار: GitHub + Turso + Vercel (یک‌بار برای همیشه)

کل استقرار ۳ گام دارد و **نیازی به نصب Turso CLI یا اجرای migration نیست** —
جدول‌های دیتابیس روی اولین درخواست به‌صورت خودکار ساخته می‌شوند.

### گام ۱ — GitHub (با GitHub Desktop)

**آماده‌سازی:** فایل `boom-chin.zip` را دانلود و Extract کنید — پوشه‌ی `boom-chin` از قبل مخزن Git آماده دارد.

1. [GitHub Desktop](https://desktop.github.com) را نصب کنید و با حساب GitHub خود **Sign in** کنید.
2. منوی **File → Add local repository…** را بزنید.
3. پوشه‌ی Extract شده (`boom-chin`) را انتخاب کنید → **Add repository**. (یک کامیت آماده می‌بیند — مشکلی نیست)
4. دکمه‌ی **Publish repository** (بالای صفحه) را بزنید.
   - **Name:** `boom-chin`
   - تیک **Keep this code private** را بر اساس میلت خاموش/روشن کنید.
   - **Publish** را بزنید — تمام! کد روی GitHub شماست.

**روش جایگزین (خط فرمان):**

```bash
git init
git add .
git commit -m "Boom Chin game"
git branch -M main
git remote add origin https://github.com/<username>/boom-chin.git
git push -u origin main
```

> فایل `.env` هرگز push نمی‌شود (در `.gitignore` است). فقط `.env.example` نمونه است.

### گام ۲ — ساخت دیتابیس Turso (فقط مرورگر، بدون نصب چیزی)

1. به [app.turso.tech](https://app.turso.tech) بروید و با **GitHub** وارد شوید (Sign up با GitHub).
2. **Create Database** را بزنید:
   - **Name:** `boomchin`
   - **Location:** نزدیک‌ترین منطقه، مثلاً `fra` (فرانکفورت) یا `arn` (استکهلم)
   - **Create** را بزنید.
3. در صفحه‌ی دیتابیس، **Database URL** را کپی کنید — شبیه
   `libsql://boomchin-<your-org>.turso.io` است. ← این همان `DATABASE_URL` است.
4. توکن بسازید: در صفحه‌ی دیتابیس بخش ساخت توکن
   (**Create Database Token / Tokens → Create token**) را باز کنید و توکن را کپی کنید.
   ← این همان `DATABASE_AUTH_TOKEN` است.

> اگر دکمه‌ی توکن را در سایت پیدا نکردید، این دو دستور هم همان کار را می‌کند
> (نیازمند WSL در ویندوز): `turso db show boomchin --url` و `turso db tokens create boomchin`

**ساخت جداول؟ لازم نیست!** اولین باری که بازی روی سایت زنده اجرا شود،
جدول‌ها خودکار ساخته می‌شوند.

### گام ۳ — Vercel

1. در [vercel.com](https://vercel.com) با GitHub وارد شوید → **Add New → Project** → ریپوی `boom-chin` را **Import** کنید.
2. در بخش **Environment Variables** این سه مقدار را اضافه کنید:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | آدرس `libsql://…` از گام ۲ |
   | `DATABASE_AUTH_TOKEN` | توکن از گام ۲ |
   | `ADMIN_PASSWORD` | رمز اولیه‌ی مدیر — بعد از اولین ورود، پنل خودش اجبار می‌کند عوضش کنید |

3. **Deploy** را بزنید — تمام! سایت زنده است.

> - کد `src/lib/db.ts` به‌طور خودکار تشخیص می‌دهد: اگر `DATABASE_URL` با `libsql://`
>   شروع شود از آداپتور رسمی Turso (`@prisma/adapter-libsql`) استفاده می‌کند،
>   وگرنه همان SQLite محلی را می‌خواند.
> - بعد از Deploy دیگر هیچ کاری لازم نیست — بازیکن‌ها روی همان آدرس Vercel بازی می‌کنند
>   و پیشرفت‌شان روی Turso ذخیره می‌شود.
> - هر تغییر آینده فقط با push شدن کد به GitHub، خودکار روی Vercel دوباره deploy می‌شود.

### به‌روزرسانی جداول در آینده (اختیاری)

جدول‌های جدید/ستون‌های جدید اگر روزی به `prisma/schema.prisma` اضافه شدند:

```bash
bun run db:sql                          # فایل migration.sql ساخته می‌شود
turso db shell boomchin < migration.sql # اعمال روی دیتابیس ابری (نیازمند WSL در ویندوز)
```

---

## پنل مدیریت (هدیه‌ی سکه)

بخش ادمین می‌تواند به هر بازیکن، هر مقدار سکه هدیه دهد.

### ورود (فقط با رمز — بدون شناسه دستگاه)

1. در بازی به **تنظیمات → ورود مدیر** بروید.
2. **رمز مدیر** را وارد کنید — مقدار اولیه همان متغیر `ADMIN_PASSWORD` است
   (محلی: فایل `.env` — روی Vercel: Settings → Environment Variables).
3. **اولین ورود:** پنل اجباری می‌کند رمز را عوض کنید — رمز جدید انتخاب کنید؛
   از آن به بعد همان رمز جدید در همه‌ی دستگاه‌ها کار می‌کند
   (رمز جدید هش‌شده (scrypt) در خود دیتابیس ذخیره می‌شود، نه در کد).
4. بعداً هم می‌توانید از آیکون کلید بالای پنل، رمز را دوباره عوض کنید.
5. هر درخواست سمت سرور دوباره اعتبارسنجی می‌شود.

### هدیه‌ی سکه (دو روش)

- **از لیست بازیکن‌ها:** جستجو بر اساس نام یا شناسه، سپس دکمه‌ی «هدیه» کنار هر بازیکن.
- **هدیه سریع با شناسه دستگاه:** شناسه‌ی دستگاه بازیکن را (که در تنظیمات بازیِ او نمایش داده می‌شود و کپی می‌شود) در کارت «هدیه سریع با شناسه دستگاه» بچسبانید، مقدار سکه را وارد کنید و «هدیه» بزنید.
- سکه‌ی هدیه به موجودی فعلی بازیکن **اضافه** می‌شود (حداکثر هر بار ۱۰٬۰۰۰٬۰۰۰)؛ ارقام فارسی هم پذیرفته می‌شود.
- بازیکن پس از ورود دوباره به بازی سکه را می‌بیند.

---

## نسخه اندروید + کافه بازار

پوشه‌ی `bazaar-android/` نسخه‌ی اندرویدی بازی (WebView) همراه با **پرداخت درون‌برنامه‌ای
کافه بازار** است. راهنمای کامل: `bazaar-android/README.md`

- پکیج: `com.boomchin.game` — نسخه ۱.۰
- ۴ محصول مصرفی در پنل بازار: `pack_s` ، `pack_m` ، `pack_l` ، `pack_xl`
- کلید RSA در `bazaar-android/app/src/com/boomchin/game/Config.java` جای‌گذاری می‌شود؛
  تا قبل از آن، داخل برنامه خریدها «نمایشی» می‌مانند.
- کلید امضا: `bazaar-android/keystore/boomchin.keystore` (رمز `boomchin1405`) — نگه‌داری شود!

---

## License

MIT
