import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StaffNotificationProvider } from "@/lib/notification-context";
import { DesktopToastStack, ServerOfflineBanner } from "@/components/feedback";

const fontSans = localFont({
  src: [
    { path: "./fonts/Jakarta-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Jakarta-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Jakarta-SemiBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-local-sans",
  display: "swap",
});

const fontEditorial = localFont({
  src: [{ path: "./fonts/Playfair-SemiBold.ttf", weight: "600", style: "normal" }],
  variable: "--font-local-editorial",
  display: "swap",
});

const fontMono = localFont({
  src: [{ path: "./fonts/JetBrains-Medium.ttf", weight: "500", style: "normal" }],
  variable: "--font-local-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YoFaSo Shop — Cổng Vận hành Nội bộ & POS Đa kênh",
  description:
    "Hệ thống vận hành bán hàng, thu ngân POS, quản lý kho bãi, giao vận shipper và dashboard quản trị chủ shop YoFaSo Omnichannel VTON Platform.",
  icons: { icon: "/brand/YoFaSo_logo.ico" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "YoFaSo Staff",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1C1917",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontEditorial.variable} ${fontMono.variable}`}
    >
      <head>
        {/* shortcut: xoa thuoc tinh bis_skin_checked do browser extension (Urban VPN) bom vao DOM truoc khi React hydrate, tat extension hoac mo an danh neu can test moi truong sach tuyet doi */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=function(){document.querySelectorAll('[bis_skin_checked]').forEach(function(e){e.removeAttribute('bis_skin_checked')})};c();var o=new MutationObserver(function(m){for(var i=0;i<m.length;i++){if(m[i].attributeName==='bis_skin_checked'&&m[i].target.removeAttribute){m[i].target.removeAttribute('bis_skin_checked')}}});o.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['bis_skin_checked']});window.addEventListener('DOMContentLoaded',c);setTimeout(function(){o.disconnect()},3000)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-accent selection:text-primary" suppressHydrationWarning>
        <AuthProvider>
          <StaffNotificationProvider>
            <ServerOfflineBanner />
            {children}
            <DesktopToastStack />
          </StaffNotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
