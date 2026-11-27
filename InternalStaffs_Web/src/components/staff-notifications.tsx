"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Package,
  RefreshCw,
  Sparkles,
  Tag,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Role } from "@/lib/auth";
import { useStaffNotifications } from "@/lib/notification-context";
import {
  NOTIF_TYPE_LABELS,
  filterByTab,
  resolveStaffNotificationLink,
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

export function StaffNotificationPopover({ role }: { role: Role }) {
  const router = useRouter();
  const {
    items,
    unreadCount,
    loading,
    sseConnected,
    webPushState,
    webPushBusy,
    soundEnabled,
    refresh,
    markRead,
    markAllRead,
    enableWebPush,
    disableWebPush,
    toggleSound,
  } = useStaffNotifications();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>("all");
  const [selected, setSelected] = useState<StaffNotification | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void refresh(true);
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
  }, [open, refresh]);

  const list = filterByTab(items, tab);
  const hasUrgent = items.some((n) => !n.read && n.urgent);

  const handleOpenDetail = (n: StaffNotification) => {
    if (!n.read) {
      void markRead(n.id);
    }
    setSelected({ ...n, read: true });
  };

  const resolvedSelectedLink = selected
    ? resolveStaffNotificationLink(selected.link, selected.type, role)
    : null;

  const handleNavigateFromDetail = () => {
    if (!resolvedSelectedLink) return;
    setSelected(null);
    setOpen(false);
    router.push(resolvedSelectedLink);
  };

  const SelectedIcon = selected ? TYPE_ICON[selected.type] || ClipboardCheck : ClipboardCheck;

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={`Thông báo vận hành, ${unreadCount} chưa đọc`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative h-9 w-9 rounded-full"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground ${
              hasUrgent ? "motion-safe:animate-pulse" : ""
            }`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 flex max-h-[580px] w-[430px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-modal">
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Thông báo Vận hành</h2>
                <span
                  title={
                    sseConnected
                      ? "Đang kết nối realtime SSE"
                      : "Đang chạy chế độ đồng bộ định kỳ"
                  }
                  className={`h-2 w-2 rounded-full ${
                    sseConnected ? "bg-success" : "bg-muted-foreground/40"
                  }`}
                />
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-hover">
                    {unreadCount} chưa đọc
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title={soundEnabled ? "Tắt âm báo" : "Bật âm báo"}
                  onClick={toggleSound}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title="Làm mới thông báo"
                  onClick={() => void refresh(false)}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  disabled={unreadCount === 0}
                  onClick={() => void markAllRead()}
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
              <p className="py-12 text-center text-sm text-muted-foreground">
                Đang đồng bộ thông báo từ máy chủ...
              </p>
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
                    onClick={() => handleOpenDetail(n)}
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
                      <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-text-muted">{n.time}</span>
                        <span className="text-[11px] font-medium text-accent-hover">
                          Xem chi tiết
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer: trạng thái SSE + nút bật/tắt Web Push VAPID */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  sseConnected ? "bg-success" : "bg-warning"
                }`}
              />
              {sseConnected ? "Realtime SSE đang hoạt động" : "Đồng bộ định kỳ"}
            </span>
            {webPushState === "enabled" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={webPushBusy}
                onClick={() => void disableWebPush()}
                className="h-6 gap-1 px-2 text-[11px] text-success hover:text-destructive"
              >
                <BellRing className="h-3 w-3" />
                Web Push: Bật
              </Button>
            ) : webPushState === "disabled" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={webPushBusy}
                onClick={() => void enableWebPush()}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <Bell className="h-3 w-3" />
                {webPushBusy ? "Đang bật..." : "Bật Web Push"}
              </Button>
            ) : webPushState === "denied" ? (
              <span className="flex items-center gap-1 text-destructive">
                <BellOff className="h-3 w-3" />
                Trình duyệt đang chặn Push
              </span>
            ) : webPushState === "unavailable" ? (
              <span title="Cấu hình WEB_PUSH_VAPID_PUBLIC_KEY & PRIVATE_KEY trên Backend để bật Push khi đóng tab">
                Push nền: Chưa cấu hình VAPID
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Dialog Chi tiết Thông báo */}
      <Dialog open={selected !== null} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      selected.urgent
                        ? "bg-warning-subtle text-warning"
                        : "bg-accent-subtle text-accent-hover"
                    }`}
                  >
                    <SelectedIcon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                      {NOTIF_TYPE_LABELS[selected.type] || "Thông báo"}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {selected.fullTime} ({selected.time})
                      </span>
                    </div>
                  </div>
                </div>
                <DialogTitle className="leading-snug">{selected.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Nội dung chi tiết thông báo vận hành YoFaSo
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border bg-muted/25 p-3.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {selected.body || "Thông báo này không có nội dung chi tiết bổ sung."}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Đóng
                </Button>
                {resolvedSelectedLink && (
                  <Button onClick={handleNavigateFromDetail} className="gap-1.5">
                    Đi tới xử lý
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
