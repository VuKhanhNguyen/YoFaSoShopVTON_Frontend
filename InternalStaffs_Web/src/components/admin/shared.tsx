import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmModal } from "@/components/feedback";
export function PageHeading({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail: string; children?: ReactNode }) { return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="max-w-3xl"><p className="mb-2 text-xs font-semibold uppercase text-accent-hover">{eyebrow}</p><h1 className="font-editorial text-3xl leading-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{detail}</p></div>{children}</div>; }
export function Metric({ label, value, note, positive = false }: { label: string; value: string; note: string; positive?: boolean }) { return <div className="min-w-0 rounded-md border border-border bg-surface p-5"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-3 break-words font-mono text-2xl font-bold">{value}</p><p className={`mt-2 text-xs ${positive ? "text-success" : "text-muted-foreground"}`}>{note}</p></div>; }
export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info"; className?: string }) { const classes = { neutral: "bg-surface-muted text-muted-foreground", success: "bg-success-subtle text-success", warning: "bg-warning-subtle text-warning", danger: "bg-danger-subtle text-destructive", info: "bg-info-subtle text-info" }; return <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${classes[tone]} ${className}`}>{children}</span>; }
export function SubTabs<T extends string>({ tabs, active, setActive }: { tabs: { key: T; label: string }[]; active: T; setActive: (key: T) => void }) { return <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-2">{tabs.map(t => <Button role="tab" aria-selected={active === t.key} key={t.key} variant={active === t.key ? "default" : "ghost"} onClick={() => setActive(t.key)}>{t.label}</Button>)}</div>; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-xs font-semibold text-muted-foreground">{label}{children}</label>; }
export function Confirm({ title, detail, confirm, close, danger = false, requireReason = false, confirmLabel }: { title: string; detail: ReactNode; confirm: (reason: string) => void; close: () => void; danger?: boolean; requireReason?: boolean; confirmLabel?: string }) { return <DestructiveConfirmModal open title={title} tone={danger ? "danger" : "obsidian"} requireReason={requireReason} confirmLabel={confirmLabel ?? (danger ? "Xác nhận" : "Xác nhận phê duyệt")} onConfirm={confirm} onClose={close}>{detail}</DestructiveConfirmModal>; }
export const inputClass = "h-10 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  unit = "dòng",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (p: number) => void;
  unit?: string;
}) {
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-xs">
      <div className="text-muted-foreground">
        Hiển thị <strong>{start}</strong>–<strong>{end}</strong> trong số <strong>{totalItems}</strong> {unit}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Trước</span>
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | string)[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              typeof item === "string" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={page === item ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs ${
                    page === item ? "font-bold text-white shadow-sm" : ""
                  }`}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              )
            )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            <span>Sau</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}