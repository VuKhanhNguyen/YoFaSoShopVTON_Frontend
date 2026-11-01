import { pushToast } from "@/lib/feedback";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Printer, ScanBarcode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { applyScan, scanProgress, verifyScan, type WhOrder } from "@/lib/warehouse";
import { vnd } from "@/lib/pos";

/** Mã vạch 1D mô phỏng (Code128 giả lập) vẽ bằng CSS từ chuỗi mã. */
function CssBarcode({ code, className = "" }: { code: string; className?: string }) {
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < code.length * 3; i++) {
      const c = code.charCodeAt(i % code.length);
      out.push(((c * (i + 7)) % 4) + 1);
    }
    return out;
  }, [code]);
  return (
    <div className={`flex h-12 items-stretch gap-px ${className}`} aria-label={`Mã vạch ${code}`} role="img">
      {bars.map((w, i) => (
        <span key={i} className="bg-primary" style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

/** UC_WH_02 — Trạm đóng gói: đối soát barcode 100% & in tem vận đơn A6. */
export function PackingStation({ orders }: { orders: WhOrder[] }) {
  const packable = orders.filter((o) => o.status === "CHO_XAC_NHAN" || o.status === "DANG_DONG_GOI");
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<WhOrder | null>(null);
  const [scanned, setScanned] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);
  const [showWaybill, setShowWaybill] = useState(false);
  const [done, setDone] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => { if (order) scanRef.current?.focus(); }, [order]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [flash]);

  const openOrder = () => {
    const id = orderId.trim().toUpperCase().replace(/^#/, "");
    const found = packable.find((o) => o.id === id || o.id.endsWith(id));
    if (!found) {
      setError(`Không tìm thấy đơn ${orderId} cần đóng gói`);
      return;
    }
    setError("");
    setOrder(found);
    setScanned({});
    setDone(false);
  };

  const progress = order ? scanProgress(order.lines, scanned) : { done: 0, total: 0, complete: false };

  const scan = () => {
    if (!order || !code.trim()) return;
    const result = verifyScan(order.lines, scanned, code);
    if (result.kind === "ok") {
      setScanned((s) => applyScan(s, result.line));
      setError("");
    } else if (result.kind === "line-complete") {
      setError(`Món ${result.line.ten} (Size ${result.line.size}) đã quét đủ ${result.line.qty}/${result.line.qty}`);
      setFlash(true);
    } else if (result.kind === "wrong-variant") {
      pushToast({ tone: "error", title: `❌ SAI MÃ SKU! Kiện hàng yêu cầu ${result.expected.ten} Size ${result.expected.size} nhưng bạn vừa quét ${result.scanned}!` });
      setError(`LỖI SAI SIZE/MÀU! Đơn yêu cầu ${result.expected.ten} Size ${result.expected.size} (${result.expected.mau}), bạn đang quét ${result.scanned}. Vui lòng đổi lại!`);
      setFlash(true);
    } else {
      setError(`Mã ${result.scanned} không thuộc đơn hàng này!`);
      setFlash(true);
    }
    setCode("");
    scanRef.current?.focus();
  };

  const finish = () => {
    if (!progress.complete) return;
    setShowWaybill(true);
  };

  const printWaybill = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  return (
    <div className="space-y-4">
      {flash && <div aria-hidden className="pointer-events-none fixed inset-0 z-50 animate-pulse bg-destructive/25" />}

      {/* Mở đơn hàng */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bước 1 — Quét / nhập mã đơn hàng</p>
        <div className="mt-2 flex gap-2">
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && openOrder()}
            placeholder="VD: DH00000001"
            className="h-12 flex-1 rounded-md border-2 border-primary bg-background px-4 font-mono text-sm outline-none"
          />
          <Button className="h-12 px-6 font-bold" onClick={openOrder}>Mở đơn</Button>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Đơn đang chờ: {packable.map((o) => `#${o.id}`).join(" · ")}
        </p>
      </div>

      {order && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold">TRẠM ĐÓNG GÓI SỐ 01 — Đơn hàng <span className="font-mono">#{order.id}</span></h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Người nhận: <b className="text-foreground">{order.receiver}</b> ({order.phone}) — {order.address} — Thu hộ COD:{" "}
              <b className="font-mono text-foreground">{order.cod > 0 ? vnd(order.cod) : "0 đ (đã thanh toán)"}</b>
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bước 2 — Đối soát barcode từng món (100%)</p>
            <div className="relative mt-2">
              <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                ref={scanRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && scan()}
                placeholder="Quét mã barcode thẻ bài sản phẩm…"
                className="h-12 w-full rounded-md border-2 border-primary bg-muted pl-11 pr-4 font-mono text-sm outline-none focus:bg-surface"
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <ul className="mt-4 space-y-2">
              {order.lines.map((l) => {
                const got = Math.min(l.qty, scanned[l.barcode] ?? 0);
                const full = got >= l.qty;
                return (
                  <li key={l.barcode} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {l.ten} (Size {l.size} · {l.mau})
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">Barcode: {l.barcode}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold ${full ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>
                        {full ? `ĐÃ QUÉT ${got}/${l.qty}` : `CHỜ QUÉT ${got}/${l.qty}`}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${full ? "bg-success" : "animate-pulse bg-warning"}`}
                        style={{ width: `${(got / l.qty) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              variant={progress.complete ? "success" : "secondary"}
              disabled={!progress.complete}
              onClick={finish}
              className="mt-4 h-14 w-full gap-2 text-base font-bold"
            >
              <CheckCircle2 className="h-5 w-5" />
              HOÀN TẤT ĐÓNG HỘP &amp; IN TEM VẬN ĐƠN A6 (ENTER) — {progress.done}/{progress.total}
            </Button>
          </div>
        </div>
      )}

      {/* Waybill A6 modal */}
      <Dialog open={showWaybill} onOpenChange={setShowWaybill}>
        <DialogContent className="max-w-md">
          <DialogTitle>Tem vận đơn A6 (100×150mm)</DialogTitle>
          <DialogDescription>Xem trước tem dán nhiệt — mô phỏng, chưa gửi lệnh in thật.</DialogDescription>
          {order && <Waybill order={order} />}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setShowWaybill(false)}>Đóng</Button>
            <Button
              onClick={() => {
                printWaybill();
                setDone(true);
              }}
            >
              <Printer className="h-4 w-4" /> In tem A6
            </Button>
          </div>
          {done && <p className="text-sm font-semibold text-success">Đã gửi lệnh in mô phỏng — kiện hàng sẵn sàng bàn giao shipper.</p>}
        </DialogContent>
      </Dialog>

      {/* Portal in tem A6 */}
      {showWaybill && order &&
        createPortal(
          <div className="print-sheet waybill-sheet">
            <Waybill order={order} />
          </div>,
          document.body,
        )}
    </div>
  );
}

function Waybill({ order }: { order: WhOrder }) {
  const waybillCode = `YFS${order.id}`;
  return (
    <article className="waybill mx-auto rounded-md border-2 border-primary bg-surface p-3 text-foreground">
      <div className="flex items-center justify-between border-b-2 border-primary pb-2">
        <span className="font-editorial text-lg font-semibold">YoFaSo Shop</span>
        <span className="rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">HÀNG THỜI TRANG</span>
      </div>
      <div className="border-b border-border py-2">
        <CssBarcode code={waybillCode} className="justify-center" />
        <p className="mt-1 text-center font-mono text-sm font-bold tracking-widest">{waybillCode}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border py-2 text-[11px] leading-relaxed">
        <div>
          <p><b>Người gửi:</b> YoFaSo Shop — 02 Thanh Sơn, Hải Châu, Đà Nẵng</p>
          <p className="mt-1"><b>Người nhận:</b> {order.receiver} — {order.phone}</p>
          <p><b>Địa chỉ:</b> {order.address}</p>
          <p className="mt-1"><b>Nội dung:</b> {order.lines.map((l) => `${l.ten} (${l.size}) ×${l.qty}`).join("; ")}</p>
        </div>
        <QRCodeSVG value={`https://yofaso.vn/track/${waybillCode}`} size={64} />
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-[11px] font-bold uppercase">Tiền thu hộ COD</span>
        <span className="rounded-md border-2 border-primary px-3 py-1 font-mono text-lg font-bold">
          {order.cod > 0 ? vnd(order.cod) : "0 đ"}
        </span>
      </div>
      <p className="border-t border-dashed border-border pt-2 text-center text-[10px] font-semibold">
        Cho xem hàng, không cho thử (Thời trang YoFaSo Shop)
      </p>
    </article>
  );
}
