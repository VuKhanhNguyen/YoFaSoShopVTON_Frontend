"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";

/** Format thời gian UTC+7 theo mẫu: MON, 09/11/2004, 09:11:04 */
function formatUtc7Time(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  const day = (partMap.weekday || "MON").toUpperCase();
  const dd = partMap.day || "01";
  const mm = partMap.month || "01";
  const yyyy = partMap.year || "2026";
  const hh = partMap.hour || "00";
  const min = partMap.minute || "00";
  const ss = partMap.second || "00";

  return `${day}, ${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
}

/**
 * Footer chuẩn quản trị cho YoFaSo Admin Portal.
 * Hiển thị bản quyền và đồng hồ thời gian thực tế múi giờ UTC+7 (Asia/Ho_Chi_Minh).
 */
export function AdminFooter() {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(formatUtc7Time(new Date()));
    }, 1000);

    queueMicrotask(() => {
      setTimeStr(formatUtc7Time(new Date()));
    });

    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="mt-auto border-t border-border bg-surface/80 px-4 py-3 text-xs text-muted-foreground backdrop-blur-xs md:px-7 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-semibold text-foreground">YoFaSo Atelier</span>
          <span aria-hidden>·</span>
          <span>Hệ thống Quản trị Bán lẻ Thời trang Đa kênh & Thử đồ ảo AI v1.2.0</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground shadow-2xs"
            title="Thời gian thực tế hệ thống (UTC+7 / Asia/Ho_Chi_Minh)"
          >
            <Clock className="h-3.5 w-3.5 text-accent-hover" />
            {timeStr || "Đang đồng bộ thời gian..."}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-success-subtle px-1.5 py-0.5 text-[10px] font-bold text-success">
            <ShieldCheck className="h-3 w-3" />
            Hệ thống an toàn
          </span>
        </div>
      </div>
    </footer>
  );
}
