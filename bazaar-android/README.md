# بوم چین — برنامه اندروید برای کافه بازار

این پوشه، نسخه‌ی اندرویدی بازی است: یک WebView سبک که سایت بازی را باز می‌کند و
**پرداخت درون‌برنامه‌ای کافه بازار** را به بازی وصل می‌کند. کد پرداخت، نمونه‌ی رسمی
خود بازار (TrivialDrive) است.

## ساختار

```
app/
  AndroidManifest.xml        ← پکیج: com.boomchin.game — نسخه: 1.0 (versionCode 1)
  src/com/boomchin/game/
    Config.java              ← ⭐ آدرس سایت + جای کلید RSA + شناسه‌ی محصولات
    MainActivity.java        ← WebView + پل خرید (JavascriptInterface)
  src/com/example/.../util/  ← کد رسمی پرداخت بازار (IabHelper و...)
  aidl/                      ← IInAppBillingService.aidl (رسمی بازار)
  res/                       ← آیکون و رنگ‌ها
  assets/error.html          ← صفحه‌ی «اتصال برقرار نیست»
keystore/boomchin.keystore   ← کلید امضا (خیلی مهم — گم نشود!)
listing/icon-512.png         ← آیکون ۵۱۲ برای صفحه‌ی برنامه در پنل بازار
```

## جاگذاری کلید RSA

1. وارد [developers.cafebazaar.ir](https://developers.cafebazaar.ir) شو → برنامه را ثبت کن (پکیج `com.boomchin.game`).
2. در بخش **«پرداخت درون‌برنامه‌ای»** کلید RSA برنامه را کپی کن (رشته‌ی طولانی base64).
3. فایل `app/src/com/boomchin/game/Config.java` را باز کن و داخل کوتیشن‌های
   `BAZAAR_RSA_KEY` بچسبان:

```java
public static final String BAZAAR_RSA_KEY = "کلید-RSA-اینجا";
```

4. دوباره APK بساز (یا برای من بفرست تا بسازم).

تا وقتی RSA خالی باشد: برنامه بدون خطا کار می‌کند ولی خریدها «نمایشی» می‌مانند.

## محصولات (SKU) که باید در پنل بازار بسازی

بخش «پرداخت درون‌برنامه‌ای → محصولات» → نوع: **مصرفی (Consumable)**:

| شناسه (کد محصول) | نام نمایشی | سکه | قیمت پیشنهادی |
|---|---|---|---|
| `pack_s` | بسته‌ی کوچک | ۵۰۰ | ۹٬۰۰۰ تومان |
| `pack_m` | بسته‌ی متوسط | ۳٬۰۰۰ | ۴۹٬۰۰۰ تومان |
| `pack_l` | بسته‌ی بزرگ | ۸٬۵۰۰ | ۱۲۹٬۰۰۰ تومان |
| `pack_xl` | بسته‌ی ویژه | ۱۸٬۰۰۰ | ۲۴۹٬۰۰۰ تومان |

شناسه‌ها باید **دقیقاً** همین باشند؛ بازی با همین نام‌ها خرید می‌زند.

## بیلد (برای توسعه‌دهنده)

نیازمند: JDK 17+ و Android build-tools 34 + platform android-34

```bash
aidl -p framework.aidl -o gen aidl/com/android/vending/billing/IInAppBillingService.aidl
aapt2 compile --dir res -o res.zip
aapt2 link -o app.unsigned.apk -I android.jar --manifest AndroidManifest.xml -A assets res.zip --java gen
javac -source 8 -target 8 -classpath android.jar -d obj $(find src gen -name '*.java')
d8 --release --lib android.jar --min-api 21 --output out $(find obj -name '*.class')
zip app.unsigned.apk out/classes.dex
zipalign -f 4 app.unsigned.apk app.aligned.apk
apksigner sign --ks keystore/boomchin.keystore --ks-pass pass:boomchin1405 --out BoomChin.apk app.aligned.apk
```

## امضا

- فایل: `keystore/boomchin.keystore` — رمز: `boomchin1405` — alias: `boomchin`
- **این فایل را نگه دار!** هر آپدیت جدید باید با همین امضا باشد وگرنه بازار قبول نمی‌کند.
- اگر رمز را عوض می‌کنی، قبل از اولین انتشار این کار را بکن.

## چک‌لیست انتشار در کافه بازار

1. در پنل بازار برنامه با پکیج `com.boomchin.game` ثبت شده باشد.
2. کلید RSA در `Config.java` جای‌گذاری شده باشد.
3. ۴ محصول بالا ساخته شده باشند.
4. APK نهایی ساخته و امضا شده باشد.
5. فایل‌های صفحه‌ی برنامه: آیکون ۵۱۲×۵۱۲ (`listing/icon-512.png`)، حداقل ۲ اسکرین‌شات از بازی، بنر اختیاری.
6. توضیحات و دسته‌بندی (بازی → پازل) را در پنل وارد کن.
7. فایل APK را آپلود و «ارسال برای بررسی» بزن.
