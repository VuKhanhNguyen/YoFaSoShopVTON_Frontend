"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Package,
  RefreshCw,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import { api } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import {
  filterByTab,
  mapApiNotification,
  markAllRead,
  markRead,
  unreadCount,
  type ApiNotificationRow,
  type NotifTab,
  type NotifType,
  type StaffNotification,
} from "@/lib/notifications";

const TYPE_ICON: Record<NotifType, typeof Package> = {
  CANH_BAO_KHO: AlertTriangle,
  DON_HANG: Package,
  THU_DO_VTON: Sparkles,
  KHUYEN_MAI: Tag,
  HE_THONG: ClipboardCheck,
};

const TABS: { k: NotifTab; l: string }[] = [
  { k: "all", l: "Tất cả" },
  { k: "stock", l: "Tồn kho" },
  { k: "orders", l: "Đơn hàng" },
  { k: "approvals", l: "Hệ thống / Duyệt" },
];

export function StaffNotificationPopover({ role: _role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>("all");
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api<ApiNotificationRow[]>("/notifications?page=0&size=30");
      if (Array.isArray(data)) {
        setItems(data.map(mapApiNotification));
      }
    } catch {
      // Keep current list on transient error
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications(false);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications(true);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications(true);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, loadNotifications]);

  const list = filterByTab(items, tab);
  const unread = unreadCount(items);
  const hasUrgent = items.some((n) => !n.read && n.urgent);

  const handleMarkOne = async (n: StaffNotification) => {
    if (!n.read) {
      setItems((prev) => markRead(prev, n.id));
      try {
        await api(`/notifications/${encodeURIComponent(n.id)}/read`, "POST", {});
      } catch {
        void loadNotifications(true);
      }
    }
    if (n.link && n.link.startsWith("/") && !n.link.startsWith("/orders/")) {
      setOpen(false);
      router.push(n.link);
    }
  };

  const handleMarkAll = async () => {
    if (unread === 0) return;
    setItems((prev) => markAllRead(prev));
    try {
      await api("/notifications/read-all", "POST", {});
      pushToast({ tone: "success", title: "Đã đánh dấu tất cả thông báo là đã đọc" });
    } catch (err) {
      pushToast({
        tone: "error",
        title: err instanceof Error ? err.message : "Không thể cập nhật trạng thái thông báo.",
      });
      void loadNotifications(true);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={`Thông báo vận hành, ${unread} chưa đọc`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative h-9 w-9 rounded-full"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground ${
              hasUrgent ? "motion-safe:animate-pulse" : ""
            }`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 flex max-h-[560px] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-modal">
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Thông báo Vận hành</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-hover">
                    {unread} chưa đọc
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title="Làm mới thông báo"
                  onClick={() => void loadNotifications(false)}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  disabled={unread === 0}
                  onClick={() => void handleMarkAll()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Đọc tất cả
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {TABS.map((t) => (
                <Button
                  key={t.k}
                  variant={tab === t.k ? "default" : "ghost"}
                  aria-pressed={tab === t.k}
                  onClick={() => setTab(t.k)}
                  className="h-7 rounded-full px-3 text-xs"
                >
                  {t.l}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Đang đồng bộ thông báo từ máy chủ...</p>
            ) : list.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Chưa có thông báo nào trong mục này.
              </p>
            ) : (
              list.map((n) => {
                const Icon = TYPE_ICON[n.type] || ClipboardCheck;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleMarkOne(n)}
                    className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted ${
                      n.read ? "bg-surface" : "bg-accent-subtle"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        n.urgent && !n.read
                          ? "bg-warning-subtle text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`text-sm leading-snug ${
                            n.read ? "font-medium" : "font-bold text-foreground"
                          }`}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success"
                            aria-label="Chưa đọc"
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block break-words text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-text-muted">{n.time}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
            Đồng bộ thời gian thực từ bảng <code>ThongBao</code> (MySQL)
          </div>
        </div>
      )}
    </div>
  );
}
