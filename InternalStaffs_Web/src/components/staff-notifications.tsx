"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Package, AlertTriangle, Receipt, Truck, ClipboardCheck, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import {
  NOTIFICATIONS,
  filterByTab,
  markAllRead,
  markRead,
  unreadCount,
  visibleForRole,
  type NotifTab,
  type NotifType,
  type StaffNotification,
} from "@/lib/notifications";

const TYPE_ICON: Record<NotifType, typeof Package> = {
  CANH_BAO_TON_KHO: AlertTriangle,
  DON_HANG_MOI: Package,
  YEU_CAU_DUYET_CA: ClipboardCheck,
  YEU_CAU_DUYET_KIEM_KE: ClipboardCheck,
  VIETQR_THANH_CONG: QrCode,
  CHUYEN_GIAO_MOI: Truck,
};

const TABS: { k: NotifTab; l: string }[] = [
  { k: "all", l: "Tất cả" },
  { k: "stock", l: "Tồn kho" },
  { k: "orders", l: "Đơn hàng" },
  { k: "approvals", l: "Phê duyệt" },
];

export function StaffNotificationPopover({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>("all");
  const [items, setItems] = useState<StaffNotification[]>(NOTIFICATIONS);
  const rootRef = useRef<HTMLDivElement>(null);

  const visible = visibleForRole(items, role);
  const list = filterByTab(visible, tab);
  const unread = unreadCount(visible);
  const hasUrgent = visible.some((n) => !n.read && n.urgent);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

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
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 flex max-h-[560px] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-modal">
          {/* Sticky header + tabs */}
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Thông báo Vận hành</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-hover">
                    {unread} chưa đọc
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => setItems((ds) => markAllRead(ds))}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đánh dấu tất cả đã đọc
              </Button>
            </div>
            <div className="flex gap-1 px-3 pb-2">
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

          {/* Scrollable feed */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">Không có thông báo nào trong mục này.</p>
            )}
            {list.map((n) => {
              const Icon = TYPE_ICON[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setItems((ds) => markRead(ds, n.id))}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted ${
                    n.read ? "bg-surface" : "bg-accent-subtle"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      n.urgent && !n.read ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-sm leading-snug ${n.read ? "font-medium" : "font-bold text-foreground"}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success" aria-label="Chưa đọc" />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                    <span className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-text-muted">{n.time}</span>
                      {n.action && (
                        <span className="rounded-md border border-accent px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
                          {n.action}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-4 py-2.5 text-center">
            <span className="cursor-pointer text-xs font-semibold text-accent-hover hover:underline">
              Xem tất cả lịch sử thông báo hệ thống →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

void Receipt;
