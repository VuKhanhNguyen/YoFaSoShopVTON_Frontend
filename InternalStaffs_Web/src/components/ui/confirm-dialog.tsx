"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmTone = "danger" | "warning" | "info" | "success" | "obsidian";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const toneConfig: Record<ConfirmTone, { icon: typeof AlertCircle; iconClass: string; bgClass: string; borderClass: string; buttonVariant: "destructive" | "default" }> = {
  danger: {
    icon: AlertCircle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/30",
    buttonVariant: "destructive",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/30",
    buttonVariant: "default",
  },
  info: {
    icon: Info,
    iconClass: "text-info",
    bgClass: "bg-info/10",
    borderClass: "border-info/30",
    buttonVariant: "default",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/30",
    buttonVariant: "default",
  },
  obsidian: {
    icon: AlertTriangle,
    iconClass: "text-accent-hover",
    bgClass: "bg-accent-subtle",
    borderClass: "border-accent/30",
    buttonVariant: "default",
  },
};

/**
 * Unified Confirmation Popup Template (Web & Enterprise Standard)
 * Hiển thị chính giữa màn hình với backdrop mờ, icon nhận diện theo tone và phím tắt ESC/Enter.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  tone = "danger",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cfg = toneConfig[tone] ?? toneConfig.danger;
  const Icon = cfg.icon;

  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !loading) {
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${cfg.borderClass} ${cfg.bgClass}`}>
            <Icon className={`h-6 w-6 ${cfg.iconClass}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-foreground">
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onClose}
            className="rounded-lg px-4"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={cfg.buttonVariant}
            disabled={loading}
            onClick={() => void onConfirm()}
            className="rounded-lg px-5 font-semibold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
