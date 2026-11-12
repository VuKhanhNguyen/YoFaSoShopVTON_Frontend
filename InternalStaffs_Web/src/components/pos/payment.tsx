"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, QrCode, CheckCircle2, Printer, Loader2, Download, FileText } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt } from "./receipt";
import { cashChange, orderDue, type Method, type Order } from "@/lib/pos-workflows";
import { vnd } from "@/lib/pos";
import { exportReceiptPdf } from "@/lib/receipt-pdf";

export function Payment({
  draft,
  onComplete,
  onPrint,
  onClose,
}: {
  draft: Order;
  onComplete: (method: Method, tendered: number) => Promise<Order | null> | Order;
  onPrint: (order: Order) => void;
  onClose?: () => void;
}) {
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [received, setReceived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<Order | null>(null);
  const [downloading, setDownloading] = useState(false);
  const due = orderDue(draft);

  const handleAutoPrint = async (orderToPrint: Order) => {
    if (downloading) return;
    setDownloading(true);
    try {
      await exportReceiptPdf(orderToPrint);
      onClose?.();
    } catch (err) {
      console.error("Lỗi xuất PDF hóa đơn:", err);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (completed) {
        if ((e.ctrlKey && (e.key === "p" || e.key === "P")) || e.key === "Enter") {
          e.preventDefault();
          handleAutoPrint(completed);
        }
        return;
      }
      if (submitting) return;
      const modes: Record<string, Method> = { F1: "CASH", F2: "QR", F3: "CARD" };
      const selected = modes[e.key];
      if (selected) {
        e.preventDefault();
        setMethod(selected);
        setReceived(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, completed, downloading, onClose]);

  const cash = Number(tendered) || 0;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await onComplete(method, method === "CASH" ? cash : due);
      if (res) setCompleted(res);
    } catch {
      // Handled by caller toast
    } finally {
      setSubmitting(false);
    }
  };

  if (completed)
    return (
      <div className="space-y-4">
        <div role="status" className="flex items-center gap-2 rounded-md bg-success-subtle p-4 font-semibold text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            Đã lưu & thanh toán thành công ({completed.method === "CASH" ? "Tiền mặt" : completed.method === "QR" ? "VietQR chuyển khoản" : "Thẻ POS"}) · {vnd(orderDue(completed))}
          </span>
        </div>
        <Receipt order={completed} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            className="w-full gap-2 h-12 text-sm font-bold bg-primary hover:bg-primary/90 shadow-sm"
            onClick={() => handleAutoPrint(completed)}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            In hóa đơn (Ctrl + P)
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 h-12 text-sm font-semibold"
            onClick={() => onPrint(completed)}
          >
            <Download className="h-4 w-4" />
            Tải hóa đơn (Tự chọn chỗ lưu)
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onClose?.()}
        >
          Đóng cửa sổ
        </Button>
      </div>
    );

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      <nav className="flex flex-wrap gap-2 md:flex-col" aria-label="Phương thức thanh toán">
        {(
          [
            ["CASH", "Tiền mặt", "F1", Banknote],
            ["QR", "VietQR Napas247", "F2", QrCode],
            ["CARD", "Quẹt thẻ POS", "F3", CreditCard],
          ] as const
        ).map(([key, label, shortcut, Icon]) => (
          <Button
            key={key}
            variant={method === key ? "default" : "outline"}
            aria-pressed={method === key}
            className="h-12 justify-start gap-2"
            disabled={submitting}
            onClick={() => {
              setMethod(key);
              setReceived(false);
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
            <kbd className="ml-auto font-mono text-xs opacity-70">{shortcut}</kbd>
          </Button>
        ))}
      </nav>

      <section className="min-w-0 space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Số tiền cần thanh toán</p>
          <p className="mt-2 break-words font-mono text-3xl font-bold text-accent-hover">{vnd(due)}</p>
        </div>

        {method === "CASH" ? (
          <>
            <label className="block space-y-2 text-sm font-semibold">
              Tiền khách đưa
              <Input
                autoFocus
                aria-label="Tiền khách đưa"
                inputMode="numeric"
                value={tendered}
                disabled={submitting}
                onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))}
                className="h-14 font-mono text-2xl"
                placeholder="0"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[100000, 200000, 500000].map((n) => (
                <Button variant="outline" key={n} disabled={submitting} onClick={() => setTendered(String(n))}>
                  {n / 1000}k
                </Button>
              ))}
              <Button variant="accent" disabled={submitting} onClick={() => setTendered(String(due))}>
                Vừa đủ
              </Button>
              {[1000000, 2000000].map((n) => (
                <Button variant="outline" key={n} disabled={submitting} onClick={() => setTendered(String(n))}>
                  {n / 1000}k
                </Button>
              ))}
            </div>
            <div className="rounded-md bg-success-subtle p-4 text-success border border-success/30">
              <p className="text-xs font-semibold uppercase tracking-wider">TIỀN THỐI LẠI</p>
              <p className="mt-1 break-words font-mono text-3xl font-bold">{vnd(cashChange(due, cash))}</p>
            </div>
            {cash < due && <p className="text-sm text-destructive">Khách cần đưa thêm {vnd(due - cash)}</p>}
          </>
        ) : method === "QR" ? (
          <div className="space-y-3 text-center rounded-xl border border-border p-4 bg-surface">
            <div className="relative inline-block">
              <QRCodeSVG
                value={`DEMO|NAPAS247|MBBANK|0987654321|${due}|POS ${draft.id}`}
                size={220}
                className="mx-auto max-w-full rounded-md border border-border bg-surface p-3"
              />
              {!received && (
                <div className="absolute inset-0 rounded-md border-2 border-accent animate-ping pointer-events-none opacity-25" />
              )}
            </div>
            <p className="font-semibold text-base">
              MBBank · <span className="font-mono text-accent-hover font-bold">0987654321</span>
            </p>
            <p className="font-mono text-sm text-muted-foreground">Nội dung chuyển khoản: POS {draft.id}</p>
            <p className={received ? "text-success font-semibold" : "text-warning font-medium animate-pulse"}>
              {received ? "Đã nhận xác nhận thanh toán Webhook Napas247" : "Đang chờ khách quét mã VietQR..."}
            </p>
            <Button variant="outline" disabled={received || submitting} onClick={() => setReceived(true)} className="w-full">
              Mô phỏng nhận tiền thành công (Webhook)
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border p-5 bg-surface">
            <CreditCard className="h-10 w-10 text-accent-hover" />
            <p className="text-sm">Xác nhận quẹt thẻ Chip/NFC trên máy quẹt POS ngân hàng.</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={received}
                disabled={submitting}
                onChange={(e) => setReceived(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Đã nhận biên nhận giao dịch thẻ POS
            </label>
          </div>
        )}

        <Button
          className="h-14 w-full text-base font-bold gap-2"
          disabled={submitting || (method === "CASH" ? cash < due : !received)}
          onClick={handleConfirm}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang ghi vào cơ sở dữ liệu…
            </>
          ) : (
            "Xác nhận thanh toán"
          )}
        </Button>
      </section>
    </div>
  );
}
