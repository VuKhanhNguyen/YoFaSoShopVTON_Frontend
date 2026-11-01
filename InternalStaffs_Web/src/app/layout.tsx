import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { DesktopToastStack, ServerOfflineBanner } from "@/components/feedback";

export const metadata: Metadata = {
  title: "YoFaSo Shop — Cổng Vận hành Nội bộ & POS Đa kênh",
  description:
    "Hệ thống vận hành bán hàng, thu ngân POS, quản lý kho bãi, giao vận shipper và dashboard quản trị chủ shop YoFaSo Omnichannel VTON Platform.",
  icons: { icon: "/brand/YoFaSo_logo.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-accent selection:text-primary">
        <AuthProvider>
          <ServerOfflineBanner />
          {children}
          <DesktopToastStack />
        </AuthProvider>
      </body>
    </html>
  );
}
