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

## استقرار: GitHub + Turso + Vercel

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

### گام ۲ — ساخت دیتابیس Turso

```bash
# نصب CLI: https://docs.turso.tech/cli
turso auth signup          # یا login
turso db create boomchin   # ساخت دیتابیس
turso db show boomchin --url          # ← DATABASE_URL
turso db tokens create boomchin       # ← DATABASE_AUTH_TOKEN
```

ساخت جداول روی Turso (تولید SQL از روی Prisma schema):

```bash
bun install
bun run db:sql                          # فایل migration.sql ساخته می‌شود
turso db shell boomchin < migration.sql # اعمال روی دیتابیس ابری
```

### گام ۳ — Vercel

1. در [vercel.com](https://vercel.com) روی **Add New → Project** کلیک کنید و ریپوی GitHub را import کنید.
2. در بخش **Environment Variables** این دو مقدار را اضافه کنید:
   - `DATABASE_URL` = آدرس libsql از گام ۲
   - `DATABASE_AUTH_TOKEN` = توکن از گام ۲
3. **Deploy** — تمام! (`next build` به‌صورت خودکار اجرا می‌شود)

> کد `src/lib/db.ts` به‌طور خودکار تشخیص می‌دهد: اگر `DATABASE_URL` با `libsql://`
> شروع شود از آداپتور رسمی Turso (`@prisma/adapter-libsql`) استفاده می‌کند،
> وگرنه همان SQLite محلی را می‌خواند.

### به‌روزرسانی جداول در آینده

هر وقت `prisma/schema.prisma` را تغییر دادید:

```bash
bun run db:sql
turso db shell boomchin < migration.sql
```

---

## License

MIT
