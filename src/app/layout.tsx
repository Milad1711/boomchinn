import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "بوم چین — بچین، ادغام کن، بشکن!",
  description:
    "بازی موبایلی معما و فیزیک: اشیای هم‌شکل را ادغام کن، با توپ مکانیکی موانع را بشکن و در بیش از ۱۰۰ مرحله ستاره جمع کن.",
  applicationName: "بوم چین",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#a8ecd9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
