"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, QrCode, CheckCircle2, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt } from "./receipt";
import { cashChange, orderDue, type Method, type Order } from "@/lib/pos-workflows";
import { vnd } from "@/lib/pos";

export function Payment({
  draft,
  onComplete,
  onPrint,
}: {
  draft: Order;
  onComplete: (method: Method, tendered: number) => Order;
  onPrint: (order: Order) => void;
}) {
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [received, setReceived] = useState(false);
  const [completed, setCompleted] = useState<Order | null>(null);
  const due = orderDue(draft);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, []);

  const cash = Number(tendered) || 0;

  if (completed)
    return (
      <div className="space-y-4">
        <div role="status" className="flex items-center gap-2 rounded-md bg-success-subtle p-4 font-semibold text-success">
          <CheckCircle2 className="h-5 w-5" />
          Đã thanh toán thành công · {vnd(orderDue(completed))}
        </div>
        <Receipt order={completed} />
        <Button className="w-full gap-2 h-12" onClick={() => onPrint(completed)}>
          <Printer className="h-4 w-4" />
          In hóa đơn K80
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
                onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))}
                className="h-14 font-mono text-2xl"
                placeholder="0"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[100000, 200000, 500000].map((n) => (
                <Button variant="outline" key={n} onClick={() => setTendered(String(n))}>
                  {n / 1000}k
                </Button>
              ))}
              <Button variant="accent" onClick={() => setTendered(String(due))}>
                Vừa đủ
              </Button>
              {[1000000, 2000000].map((n) => (
                <Button variant="outline" key={n} onClick={() => setTendered(String(n))}>
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
            <Button variant="outline" disabled={received} onClick={() => setReceived(true)} className="w-full">
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
                onChange={(e) => setReceived(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Đã nhận biên nhận giao dịch thẻ POS
            </label>
          </div>
        )}

        <Button
          className="h-14 w-full text-base font-bold"
          disabled={method === "CASH" ? cash < due : !received}
          onClick={() => setCompleted(onComplete(method, method === "CASH" ? cash : due))}
        >
          Xác nhận hoàn tất thanh toán
        </Button>
      </section>
    </div>
  );
}
