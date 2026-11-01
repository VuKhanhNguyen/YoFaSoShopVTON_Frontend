"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Printer, ArrowLeftRight, Send } from "lucide-react";
import { pushToast } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt } from "./receipt";
import { canReturn, countCash, DENOMINATIONS, orderDue, shiftVariance, type Order } from "@/lib/pos-workflows";
import { type BienThe, vnd } from "@/lib/pos";

export function Operations({
  initialTab,
  orders,
  catalog,
  shiftStatus,
  onCloseShift,
  onExchange,
  onPrint,
}: {
  initialTab: "orders" | "shift";
  orders: Order[];
  catalog: BienThe[];
  shiftStatus: string;
  onCloseShift: (counts: Record<number, number>, note: string) => void;
  onExchange: (id: number, from: string, to: string) => string;
  onPrint: (order: Order) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  const order = orders.find((o) => o.id === selected);
  const cashRevenue = orders.filter((o) => o.method === "CASH").reduce((s, o) => s + orderDue(o), 0);
  const qrRevenue = orders.filter((o) => o.method === "QR").reduce((s, o) => s + orderDue(o), 0);
  const variance = shiftVariance(counts, 2000000, cashRevenue);
  const old = order?.lines.find((d) => d.maQuanLy === from);
  const alternatives = catalog.filter((p) => p.ten === old?.ten && p.maQuanLy !== from);

  const closeRef = useRef({ tab, counts, note, variance, shiftStatus, onCloseShift });
  closeRef.current = { tab, counts, note, variance, shiftStatus, onCloseShift };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const state = closeRef.current;
      if (e.key === "F12" && state.tab === "shift") {
        e.preventDefault();
        if (state.shiftStatus === "DANG_MO" && (state.variance === 0 || state.note.trim())) {
          state.onCloseShift(state.counts, state.note);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const target = alternatives.find((p) => p.maQuanLy === to);

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
        <Button variant={tab === "orders" ? "default" : "outline"} onClick={() => setTab("orders")}>
          Đơn hàng & Đổi trả
        </Button>
        <Button variant={tab === "shift" ? "default" : "outline"} onClick={() => setTab("shift")}>
          Kết ca & Kiểm két
        </Button>
      </nav>

      {tab === "orders" ? (
        <>
          <Input
            aria-label="Tìm hóa đơn"
            placeholder="Tìm số hóa đơn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11"
          />

          {orders.length === 0 && (
            <p className="py-10 text-center text-muted-foreground text-sm">Chưa có hóa đơn đã thanh toán trong ca.</p>
          )}

          <div className="max-h-52 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th className="p-3">Hóa đơn</th>
                  <th className="p-3">Thanh toán</th>
                  <th className="p-3 text-right">Tổng cộng</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((o) => String(o.id).includes(search))
                  .map((o) => (
                    <tr className="border-b border-border hover:bg-muted/50" key={o.id}>
                      <td className="p-3 font-mono font-bold">#{o.id}</td>
                      <td className="p-3">{o.method === "CASH" ? "Tiền mặt" : o.method === "QR" ? "VietQR" : "Thẻ POS"}</td>
                      <td className="p-3 text-right font-mono font-semibold text-accent-hover">{vnd(orderDue(o))}</td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelected(o.id);
                            setFrom("");
                            setTo("");
                            setMessage("");
                          }}
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {order && (
            <div className="grid gap-5 md:grid-cols-2 pt-4 border-t border-border">
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Hóa đơn #{order.id}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onPrint(order)} className="gap-2">
                    <Printer className="h-4 w-4" />
                    In lại hóa đơn
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canReturn(order.created, new Date())}
                    onClick={() => {
                      setFrom(order.lines[0]?.maQuanLy ?? "");
                      setTo("");
                    }}
                    className="gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Tiếp nhận đổi hàng
                  </Button>
                </div>

                {from && (
                  <section className="space-y-3 border-t border-border pt-4">
                    <label className="block space-y-1.5 text-sm">
                      Sản phẩm trả
                      <select
                        aria-label="Sản phẩm trả"
                        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setTo("");
                        }}
                      >
                        {order.lines.map((d) => (
                          <option value={d.maQuanLy} key={d.maQuanLy}>
                            {d.ten} · {d.size} / {d.mau}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1.5 text-sm">
                      Đổi sang biến thể khác
                      <select
                        aria-label="Biến thể đổi"
                        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      >
                        <option value="">Chọn size / màu</option>
                        {alternatives.map((p) => (
                          <option disabled={p.ton < 1} value={p.maQuanLy} key={p.maQuanLy}>
                            {p.size} / {p.mau} · Còn {p.ton} chiếc
                          </option>
                        ))}
                      </select>
                    </label>

                    {target && old && <p className="font-mono text-sm">Chênh lệch: {vnd(target.donGia - old.donGia)}</p>}
                    <p className="text-xs text-muted-foreground">Đổi 01 sản phẩm; hoàn tồn cũ và xuất tồn mới.</p>
                    <Button
                      disabled={!target || !old || target.donGia !== old.donGia}
                      onClick={() => {
                        setMessage(onExchange(order.id, from, to));
                        setFrom("");
                      }}
                    >
                      Xác nhận đổi hàng
                    </Button>
                    {target && old && target.donGia !== old.donGia && (
                      <p className="text-warning text-xs">Đổi khác giá cần xác nhận thu / hoàn tiền.</p>
                    )}
                  </section>
                )}

                {message && <p role="status" className="text-success text-sm font-semibold">{message}</p>}
                {order.exchanges.map((x, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    Đã đổi {x.from} → {x.to}
                  </p>
                ))}
              </div>
              <Receipt order={order} />
            </div>
          )}
        </>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (variance !== 0)
              pushToast({
                tone: "warning",
                title: `⚠️ Tiền mặt kiểm đếm cuối ca CA000001 bị lệch ${vnd(Math.abs(variance))} so với số liệu sổ sách POS!`,
                detail: "Đã gửi kèm giải trình cho chủ shop",
              });
            onCloseShift(counts, note);
          }}
        >
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-lg font-bold">Ca sáng · 08:00–15:30</h2>
            <span className="font-mono text-sm text-muted-foreground">Mã ca: CA000001 · NV-02 Lan</span>
          </div>

          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tiền mặt đầu ca</p>
              <p className="mt-1 font-mono font-bold text-lg">{vnd(2000000)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Doanh thu tiền mặt ({orders.filter((o) => o.method === "CASH").length} đơn)</p>
              <p className="mt-1 font-mono font-bold text-lg">{vnd(cashRevenue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Doanh thu VietQR ({orders.filter((o) => o.method === "QR").length} đơn)</p>
              <p className="mt-1 font-mono font-bold text-lg text-accent-hover">{vnd(qrRevenue)}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>Tiền mặt lý thuyết cần có trong két:</span>
            <b className="font-mono text-xl">{vnd(2000000 + cashRevenue)}</b>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left">
              <tr>
                <th className="p-3">Mệnh giá</th>
                <th className="p-3">Số tờ kiểm đếm</th>
                <th className="p-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINATIONS.map((d) => (
                <tr className="border-b border-border" key={d}>
                  <td className="p-3 font-mono">{vnd(d)}</td>
                  <td className="p-2">
                    <Input
                      aria-label={`Số tờ ${d / 1000}k`}
                      type="number"
                      min={0}
                      step={1}
                      disabled={shiftStatus !== "DANG_MO"}
                      className="w-24 font-mono h-9"
                      value={counts[d] || ""}
                      onChange={(e) =>
                        setCounts((c) => ({ ...c, [d]: Math.max(0, Math.floor(Number(e.target.value))) }))
                      }
                    />
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">{vnd(d * (counts[d] || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
            <span className="font-semibold">Tổng tiền thực đếm trong két:</span>
            <b className="font-mono text-2xl text-accent-hover">{vnd(countCash(counts))}</b>
          </div>

          <div
            role="status"
            className={`flex items-center gap-3 rounded-xl p-4 border ${
              variance === 0
                ? "bg-success-subtle text-success border-success/30"
                : "bg-danger-subtle text-destructive border-destructive/30"
            }`}
          >
            {variance === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="font-semibold text-sm">
              {variance === 0 ? "KHỚP HOÀN TOÀN DOANH THU" : "CHÊNH LỆCH KÉT TIỀN"} ·{" "}
              <span className="font-mono font-bold">{vnd(variance)}</span>
            </span>
          </div>

          <Input
            aria-label="Ghi chú bàn giao"
            placeholder="Ghi chú bàn giao / giải trình chênh lệch"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={shiftStatus !== "DANG_MO"}
            className="h-11"
          />

          <Button
            type="submit"
            className="h-12 w-full gap-2 font-bold"
            disabled={shiftStatus !== "DANG_MO" || (variance !== 0 && !note.trim())}
          >
            <Send className="h-4 w-4" />
            {shiftStatus === "DANG_MO" ? "Xác nhận kết ca & Gửi duyệt (F12)" : "ĐÃ ĐÓNG CA — CHỜ CHỦ SHOP DUYỆT"}
          </Button>
        </form>
      )}
    </div>
  );
}
