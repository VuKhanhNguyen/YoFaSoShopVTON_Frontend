import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const jakarta = localFont({
  src: [
    { path: "./fonts/Jakarta-Regular.ttf", weight: "400" },
    { path: "./fonts/Jakarta-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});
const editorial = localFont({
  src: "./fonts/Playfair-SemiBold.ttf",
  variable: "--font-editorial",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/JetBrains-Medium.ttf",
  variable: "--font-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: "YoFaSo Shop | Cổng nội bộ",
  description: "Không gian vận hành bán hàng, kho và giao nhận YoFaSo Shop",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/logo.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${jakarta.variable} ${editorial.variable} ${mono.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-link">
          Đến nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
