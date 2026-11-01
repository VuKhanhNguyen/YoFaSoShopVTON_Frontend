"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, WifiOff, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canConfirm, dismissToast, subscribeToasts, type PortalToast } from "@/lib/feedback";

const toneStyle = {
  success: { icon: CheckCircle2, text: "text-success", bar: "bg-success" },
  warning: { icon: AlertTriangle, text: "text-warning", bar: "bg-warning" },
  error: { icon: XCircle, text: "text-destructive", bar: "bg-destructive" },
  info: { icon: Info, text: "text-info", bar: "bg-info" },
};

function ToastCard({ t, paused }: { t: PortalToast; paused: boolean }) {
  const [left, setLeft] = useState(t.duration);
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const base = left;
    const iv = setInterval(() => {
      const r = base - (Date.now() - start);
      setLeft(r);
      if (r <= 0) dismissToast(t.id);
    }, 50);
    return () => clearInterval(iv);
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = toneStyle[t.tone] ?? toneStyle.info;
  const Icon = s.icon;

  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      className="relative w-[380px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[12px] border border-border bg-surface p-4 pr-10 shadow-floating-toast"
    >
      <div className="flex gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.text}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
          {t.detail && <p className="mt-1 text-xs text-muted-foreground">{t.detail}</p>}
          {t.action && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                t.action?.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </Button>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Đóng thông báo"
        className="absolute right-1 top-1 h-8 w-8"
        onClick={() => dismissToast(t.id)}
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-muted">
        <div className={`h-full ${s.bar}`} style={{ width: `${Math.max(0, (left / t.duration) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Top-right 3D stacked toasts; expands on hover/focus. */
export function DesktopToastStack() {
  const [toasts, setToasts] = useState<PortalToast[]>([]);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => subscribeToasts(setToasts), []);
  if (!toasts.length) return null;

  return (
    <section
      aria-label="Thông báo"
      className="fixed right-6 top-6 z-[9999]"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
    >
      <div className="relative w-[380px] max-w-[calc(100vw-48px)]" style={{ height: expanded ? toasts.length * 132 : 132 }}>
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className="absolute right-0 top-0 transition-all duration-300 ease-out"
            style={{
              zIndex: 100 - i,
              transform: expanded ? `translateY(${i * 132}px)` : `translateY(${i * 10}px) scale(${1 - i * 0.05})`,
              opacity: !expanded && i > 2 ? 0 : 1,
              pointerEvents: !expanded && i > 0 ? "none" : "auto",
            }}
          >
            <ToastCard t={t} paused={expanded} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Center destructive confirmation; optional mandatory reason. Escape closes, Enter confirms. */
export function DestructiveConfirmModal({
  open,
  title,
  children,
  confirmLabel = "Xác nhận",
  tone = "obsidian",
  requireReason = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  tone?: "obsidian" | "danger";
  requireReason?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const ok = canConfirm(requireReason, reason);

  useEffect(() => {
    if (open) {
      setReason("");
      setTimeout(() => ref.current?.querySelector<HTMLElement>("textarea,button[data-confirm]")?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;
  const submit = () => {
    if (ok) onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName !== "BUTTON") {
          e.preventDefault();
          submit();
        }
      }}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dcm-title"
        className="w-full max-w-[520px] rounded-xl border border-border bg-surface p-6 shadow-modal"
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive bg-danger-subtle">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 id="dcm-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
        {requireReason && (
          <label className="mt-4 grid gap-2 text-xs font-semibold text-muted-foreground">
            Lý do hủy / giải trình (bắt buộc, tối thiểu 5 ký tự)
            <textarea
              className="h-24 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
          <Button
            data-confirm
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={!ok}
            className="h-auto whitespace-normal py-2.5"
            onClick={submit}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Sticky banner shown when the browser goes offline, or when simulated via `forceOffline`. */
export function ServerOfflineBanner({ forceOffline = false }: { forceOffline?: boolean }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && !forceOffline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[9500] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Mất kết nối Cổng Backend Spring Boot / CSDL MySQL. Mọi giao dịch POS đang tạm thời chuyển sang chế độ lưu trữ cục bộ (Offline Cache). Vui lòng không đóng trình duyệt!
    </div>
  );
}
