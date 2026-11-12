"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Printer, ArrowLeftRight, RotateCcw, Loader2, RefreshCw } from "lucide-react";
import { pushToast } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt } from "./receipt";
import { api } from "@/lib/api";
import { canReturn, countCash, DENOMINATIONS, shiftVariance, type Order } from "@/lib/pos-workflows";
import { type BienThe, vnd } from "@/lib/pos";
import { vnLabel } from "@/lib/vietnamese-labels";

export function Operations({
  initialTab,
  orders: localOrders,
  catalog,
  shiftId: currentShiftId,
  shiftStatus,
  onCloseShift,
  onPrint,
  onOrderUpdated,
}: {
  initialTab: "orders" | "shift";
  orders: Order[];
  catalog: BienThe[];
  shiftId?: string;
  shiftStatus: string;
  onCloseShift: (counts: Record<number, number>, note: string) => void;
  onPrint: (order: Order) => void;
  onOrderUpdated?: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [returning, setReturning] = useState(false);

  // Shift state
  const [shiftData, setShiftData] = useState<{
    shiftId: string;
    openingCash: number;
    cashSales: number;
    expectedCash: number;
    status: string;
  } | null>(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api<any[]>("/staff/orders?limit=30");
      if (Array.isArray(res)) {
        setDbOrders(res);
      }
    } catch {
      // fallback to local orders
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchShiftDetails = async () => {
    if (!currentShiftId) return;
    setLoadingShift(true);
    try {
      const res = await api<any>(`/pos/shifts/${encodeURIComponent(currentShiftId)}`);
      if (res && res.shiftId) {
        setShiftData({
          shiftId: res.shiftId,
          openingCash: Number(res.openingCash) || 0,
          cashSales: Number(res.cashSales) || 0,
          expectedCash: Number(res.expectedCash) || 0,
          status: res.status || shiftStatus,
        });
      }
    } catch {
      // fallback
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    if (tab === "orders") {
      fetchOrders();
    } else {
      fetchShiftDetails();
    }
  }, [tab, currentShiftId]);

  const viewOrderDetail = async (orderSummary: any) => {
    const id = orderSummary.orderId || orderSummary.id;
    setLoadingDetail(true);
    try {
      const res = await api<any>(`/staff/orders/${encodeURIComponent(id)}`);
      if (res) {
        const orderObj: Order = {
          id: res.orderId || id,
          orderId: res.orderId || id,
          created: res.createdAt || res.created || new Date().toISOString(),
          customerName: res.recipientName || orderSummary.recipientName || "Khách tại quầy",
          customerPhone: res.phone || orderSummary.phone || "",
          cashierId: res.cashierId || orderSummary.cashierId || "Thu ngân",
          method: res.paymentMethod === "VIETQR_CHUYEN_KHOAN_ONLINE" ? "QR" : "CASH",
          discount: Number(res.discount) || 0,
          pointsUsed: 0,
          total: Number(res.total) || Number(orderSummary.total) || 0,
          status: res.status || orderSummary.status,
          channel: res.channel || "TAI_QUAY_POS",
          tendered: Number(res.total) || Number(orderSummary.total) || 0,
          lines: (res.items || []).map((it: any) => ({
            variantId: it.variantId,
            maQuanLy: it.sku || it.variantId,
            sku: it.sku || it.variantId,
            ten: it.productName || it.name || "Sản phẩm",
            size: it.size || "",
            mau: it.colorName || "",
            donGia: Number(it.price) || 0,
            soLuong: Number(it.quantity) || 1,
          })),
        };
        setSelectedOrder(orderObj);
      }
    } catch {
      // fallback
      const matchLocal = localOrders.find((o) => String(o.id) === String(id));
      if (matchLocal) setSelectedOrder(matchLocal);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleReturnOrder = async (orderId: string | number) => {
    if (!confirm(`Xác nhận nhận trả hàng và hoàn tồn kho cho đơn #${orderId}? Thao tác này sẽ ghi trực tiếp vào cơ sở dữ liệu.`)) {
      return;
    }
    setReturning(true);
    try {
      await api(`/staff/orders/${encodeURIComponent(orderId)}/receive-return`, "POST");
      pushToast({
        tone: "success",
        title: `Đã xử lý đổi trả thành công cho đơn #${orderId}`,
        detail: "Tồn kho đã được hoàn lại vào hệ thống và ghi nhận sổ cái kho",
      });
      fetchOrders();
      if (selectedOrder && (selectedOrder.id === orderId || selectedOrder.orderId === orderId)) {
        setSelectedOrder({ ...selectedOrder, status: "TRA_HANG" });
      }
      onOrderUpdated?.();
    } catch (err: any) {
      pushToast({
        tone: "error",
        title: "Không thể hoàn trả đơn hàng",
        detail: err.message || "Vui lòng thử lại sau",
      });
    } finally {
      setReturning(false);
    }
  };

  // Cash calculations
  const totalCounted = countCash(counts);
  const expectedCash = shiftData?.expectedCash ?? 2000000;
  const variance = totalCounted - expectedCash;

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variance !== 0 && !note.trim()) {
      alert("Tiền mặt kiểm đếm có chênh lệch so với kỳ vọng. Bắt buộc nhập ghi chú giải trình!");
      return;
    }
    onCloseShift(counts, note);
  };

  const displayList = dbOrders.length > 0 ? dbOrders : localOrders;
  const filteredOrders = displayList.filter((o) => {
    const code = String(o.orderId || o.id || "");
    const recipient = String(o.recipientName || o.customerName || "");
    return code.toLowerCase().includes(search.toLowerCase()) || recipient.toLowerCase().includes(search.toLowerCase());
  });

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
          <div className="flex gap-2">
            <Input
              aria-label="Tìm hóa đơn"
              placeholder="Tìm mã đơn hàng (DH...) hoặc tên khách hàng…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 flex-1"
            />
            <Button variant="outline" onClick={fetchOrders} disabled={loadingOrders} className="h-11 gap-1.5">
              <RefreshCw className={`h-4 w-4 ${loadingOrders ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang tải danh sách đơn hàng…
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground text-sm">Chưa có hóa đơn nào phù hợp.</p>
          ) : (
            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface-muted text-left sticky top-0">
                  <tr>
                    <th className="p-3">Mã đơn</th>
                    <th className="p-3">Khách hàng</th>
                    <th className="p-3">Kênh / Phương thức</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Tổng tiền</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const id = o.orderId || o.id;
                    const totalVal = Number(o.total) || 0;
                    const status = o.status || "HOAN_TAT";
                    const isReturned = status === "TRA_HANG";
                    return (
                      <tr className="border-b border-border hover:bg-muted/40 transition-colors" key={id}>
                        <td className="p-3 font-mono font-bold text-accent-hover">{id}</td>
                        <td className="p-3">{o.recipientName || o.customerName || "Khách tại quầy"}</td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {vnLabel(o.channel || "TAI_QUAY_POS")} · {vnLabel(o.paymentMethod || o.method || "TIEN_MAT_TAI_QUAY")}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isReturned
                                ? "bg-danger-subtle text-destructive"
                                : "bg-success-subtle text-success"
                            }`}
                          >
                            {isReturned ? "ĐÃ ĐỔI TRẢ" : "HOÀN TẤT"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">{vnd(totalVal)}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => viewOrderDetail(o)}
                          >
                            Chi tiết
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {loadingDetail && (
            <div className="py-6 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải chi tiết hóa đơn từ cơ sở dữ liệu…
            </div>
          )}

          {selectedOrder && !loadingDetail && (
            <div className="grid gap-5 md:grid-cols-2 pt-4 border-t border-border">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Hóa đơn #{selectedOrder.orderId || selectedOrder.id}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedOrder.status === "TRA_HANG" ? "bg-danger-subtle text-destructive" : "bg-success-subtle text-success"
                    }`}
                  >
                    {selectedOrder.status === "TRA_HANG" ? "ĐÃ ĐỔI TRẢ / HOÀN TIỀN" : "ĐÃ THANH TOÁN"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onPrint(selectedOrder)} className="gap-2 h-9 text-xs">
                    <Printer className="h-4 w-4" />
                    In / Tải hóa đơn (PDF)
                  </Button>

                  {selectedOrder.status !== "TRA_HANG" && (
                    <Button
                      variant="outline"
                      disabled={returning}
                      onClick={() => handleReturnOrder(selectedOrder.orderId || selectedOrder.id)}
                      className="gap-2 h-9 text-xs text-destructive hover:bg-danger-subtle hover:text-destructive"
                    >
                      {returning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Nhận đổi trả hàng tại quầy (Hoàn kho)
                    </Button>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3 text-xs bg-surface-muted">
                  <p className="font-semibold text-foreground">Sản phẩm trong hóa đơn:</p>
                  {(selectedOrder.lines || []).map((line, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-border/50">
                      <div>
                        <p className="font-semibold">{line.ten}</p>
                        <p className="font-mono text-muted-foreground">{line.sku} · Size: {line.size} · {line.mau}</p>
                      </div>
                      <div className="text-right font-mono">
                        <p>{line.soLuong} × {vnd(line.donGia)}</p>
                        <p className="font-bold text-accent-hover">{vnd(line.soLuong * line.donGia)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Receipt order={selectedOrder} />
            </div>
          )}
        </>
      ) : (
        <form className="space-y-5" onSubmit={handleCloseShiftSubmit}>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Kiểm két & Bàn giao ca thu ngân</h2>
              <p className="text-xs text-muted-foreground">Mã ca làm việc: <b className="font-mono text-foreground">{currentShiftId || "Chưa có"}</b></p>
            </div>
            <span className={`self-center font-mono text-xs font-bold px-3 py-1 rounded-full ${
              shiftStatus === "DANG_MO" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"
            }`}>
              {shiftStatus === "DANG_MO" ? "CA ĐANG MỞ" : "CHỜ DUYỆT BÀN GIAO"}
            </span>
          </div>

          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tiền mặt đầu ca</p>
              <p className="mt-1 font-mono font-bold text-lg">{vnd(shiftData?.openingCash ?? 2000000)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Doanh thu tiền mặt</p>
              <p className="mt-1 font-mono font-bold text-lg">{vnd(shiftData?.cashSales ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tổng kỳ vọng trong két</p>
              <p className="mt-1 font-mono font-bold text-lg text-accent-hover">{vnd(expectedCash)}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Kiểm đếm các mệnh giá tiền mặt thực tế:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DENOMINATIONS.map((d) => (
                <div key={d} className="rounded-lg border border-border p-2.5 bg-surface space-y-1">
                  <span className="text-xs font-mono font-bold text-muted-foreground">{d.toLocaleString("vi-VN")} đ</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={counts[d] || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCounts({ ...counts, [d]: isNaN(val) ? 0 : val });
                      }}
                      placeholder="0 tờ"
                      className="h-9 font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground">tờ</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 bg-surface-muted space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Tổng tiền thực tế kiểm đếm:</span>
              <span className="font-mono text-xl font-bold">{vnd(totalCounted)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>Chênh lệch két (Thực tế − Kỳ vọng):</span>
              <span className={`font-mono text-base font-bold ${
                variance === 0 ? "text-success" : "text-destructive"
              }`}>
                {variance > 0 ? `+${vnd(variance)} (Thừa)` : variance < 0 ? `-${vnd(Math.abs(variance))} (Thiếu)` : "Khớp 100% két"}
              </span>
            </div>
          </div>

          <label className="block space-y-1.5 text-xs font-semibold">
            Ghi chú bàn giao / Giải trình chênh lệch {variance !== 0 && <span className="text-destructive">*</span>}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú về tình hình ca làm việc, tiền mặt bàn giao…"
              rows={3}
              className="w-full rounded-md border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
            />
          </label>

          <Button
            type="submit"
            disabled={shiftStatus !== "DANG_MO"}
            className="h-12 w-full text-base font-bold"
          >
            Xác nhận nộp báo cáo kết ca (F12)
          </Button>
        </form>
      )}
    </div>
  );
}
