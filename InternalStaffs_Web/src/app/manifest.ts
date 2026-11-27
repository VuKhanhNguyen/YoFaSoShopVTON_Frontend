import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YoFaSo Shop — Cổng Vận hành & Giao vận Nội bộ",
    short_name: "YoFaSo Staff",
    description:
      "Ứng dụng vận hành đa kênh YoFaSo Shop dành cho Quản trị viên, Thu ngân POS, Nhân viên Kho và Shipper Giao vận.",
    start_url: "/shipper/deliveries",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#FAFAF9",
    theme_color: "#1C1917",
    icons: [
      {
        src: "/brand/YoFaSo_logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/YoFaSo_logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
