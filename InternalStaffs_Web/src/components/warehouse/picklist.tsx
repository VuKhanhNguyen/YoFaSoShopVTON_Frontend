import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buildPickList, countItems, type WhOrder, type WhStatus } from "@/lib/warehouse";

const STATUS_LABEL: Record<WhStatus, { label: string; cls: string }> = {
  CHO_XAC_NHAN: { label: "Chờ nhặt hàng", cls: "bg-warning-subtle text-warning" },
  DANG_DONG_GOI: { label: "Đang đóng gói", cls: "bg-info-subtle text-info" },
  CHO_SHIPPER: { label: "Chờ shipper nhận", cls: "bg-accent-subtle text-accent-hover" },
  DANG_GIAO_HANG: { label: "Đang giao hàng", cls: "bg-success-subtle text-success" },
  DA_HUY: { label: "Đã hủy", cls: "bg-danger-subtle text-destructive" },
};

const DAY_LABEL: Record<string, string> = { A: "Dãy Kệ A (Áo Tops)", B: "Dãy Kệ B (Quần Bottoms)", C: "Dãy Kệ C (Váy)", D: "Dãy Kệ D (Đầm)" };

/** UC_WH_01 — Bảng điều phối đơn online & sinh Phiếu nhặt hàng theo cụm giá kệ. RBAC: ẩn 100% giá bán/doanh thu. */
export function PickListBoard({ orders, onPrint }: { orders: WhOrder[]; onPrint?: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showPick, setShowPick] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const active = orders.filter((o) => o.status !== "DA_HUY");
  const cancelled = orders.filter((o) => o.status === "DA_HUY");
  const chosen = active.filter((o) => selected.includes(o.id));
  const groups = useMemo(() => buildPickList(chosen), [chosen]);

  const toggle = (id: string) => setSelected((ds) => (ds.includes(id) ? ds.filter((x) => x !== id) : [...ds, id]));
  const togglePick = (key: string) => setPicked((ds) => (ds.includes(key) ? ds.filter((x) => x !== key) : [...ds, key]));

  return (
    <div className="space-y-4">
      {cancelled.length > 0 && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive bg-danger-subtle px-4 py-3 text-sm font-semibold text-destructive">
          <XCircle className="h-5 w-5 shrink-0" />
          {cancelled.map((o) => (
            <span key={o.id}>
              Đơn #{o.id} — {o.cancelReason}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3" aria-label="Chọn" />
              <th className="px-3 py-3">Mã đơn</th>
              <th className="px-3 py-3">Thời gian đặt</th>
              <th className="px-3 py-3 text-center">Số món</th>
              <th className="px-3 py-3">Vận chuyển</th>
              <th className="px-3 py-3">Thanh toán</th>
              <th className="px-3 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const st = STATUS_LABEL[o.status];
              const isCancelled = o.status === "DA_HUY";
              return (
                <tr key={o.id} className={`border-b border-border last:border-b-0 ${isCancelled ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Chọn đơn ${o.id}`}
                      disabled={isCancelled}
                      checked={selected.includes(o.id)}
                      onChange={() => toggle(o.id)}
                      className="h-6 w-6 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 py-3 font-mono font-bold">#{o.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{o.placedAt}</td>
                  <td className="px-3 py-3 text-center font-mono font-bold">{o.lines.reduce((s, l) => s + l.qty, 0)}</td>
                  <td className="px-3 py-3 text-xs">{o.shipper}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${o.payment === "VIETQR" ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning"}`}>
                      {o.payment === "VIETQR" ? "VietQR đã TT" : "COD"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch action bar */}
      {selected.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-surface px-4 py-3 shadow-modal">
          <span className="text-sm font-semibold">
            Đã chọn <span className="font-mono font-bold">{selected.length}</span> đơn hàng (gồm{" "}
            <span className="font-mono font-bold">{countItems(chosen)}</span> món đồ)
          </span>
          <Button className="ml-auto h-12 gap-2 px-6 text-sm font-bold" onClick={() => { setPicked([]); setShowPick(true); }}>
            <FileText className="h-5 w-5" />
            SINH PHIẾU NHẶT HÀNG TỔNG HỢP (PICK LIST)
          </Button>
        </div>
      )}

      {/* Pick list document modal */}
      <Dialog open={showPick} onOpenChange={setShowPick}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-lg">Phiếu Nhặt Hàng Tổng Hợp — Tối ưu lộ trình kệ</DialogTitle>
          <DialogDescription>
            {selected.length} đơn · {countItems(chosen)} món · Lộ trình: Dãy A → B → C → D (mô phỏng)
          </DialogDescription>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {groups.map((g) => (
              <section key={`${g.shelf.day}-${g.shelf.ke}-${g.shelf.tang}`} className="overflow-hidden rounded-lg border border-border">
                <h3 className="bg-muted px-3 py-2 text-sm font-bold">{DAY_LABEL[g.shelf.day] ?? `Dãy Kệ ${g.shelf.day}`}</h3>
                <ul>
                  {g.items.map((item) => {
                    const key = `${g.shelf.ke}-${item.barcode}`;
                    const done = picked.includes(key);
                    return (
                      <li key={key} className="flex items-center gap-3 border-t border-border px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Đã nhặt ${item.ten} size ${item.size}`}
                          checked={done}
                          onChange={() => togglePick(key)}
                          className="h-6 w-6 cursor-pointer accent-[var(--color-success)]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : ""}`}>
                            {item.ten} (Size {item.size})
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            Kệ {g.shelf.ke} / Tầng {g.shelf.tang} · Cho đơn {item.orderIds.map((id) => `#${id.slice(-2)}`).join(", ")}
                          </p>
                        </div>
                        <span className="rounded-md bg-accent-subtle px-2.5 py-1 font-mono text-sm font-bold text-accent-hover">
                          Cần lấy: {item.qty}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {groups.length === 0 && (
              <p className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" /> Không có món nào cần nhặt.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setShowPick(false)}>Đóng</Button>
            <Button onClick={() => { setShowPick(false); onPrint?.(); }}>
              <Printer className="h-4 w-4" /> In phiếu nhặt hàng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
