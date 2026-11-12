import { QRCodeSVG } from "qrcode.react";
import { thanhTien, vnd } from "@/lib/pos";
import { cashChange, orderDue, type Order } from "@/lib/pos-workflows";
import { vnLabel } from "@/lib/vietnamese-labels";

export function Receipt({ order }: { order: Order }) {
  const due = order.total ?? orderDue(order);
  const displayId = String(order.orderId || order.id || "").replace(/^#?POS-/, "");
  const orderDate = (() => {
    try {
      const d = new Date(order.created);
      return isNaN(d.getTime()) ? new Date().toLocaleString("vi-VN") : d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    } catch {
      return new Date().toLocaleString("vi-VN");
    }
  })();

  return (
    <article className="receipt mx-auto bg-surface p-4 font-mono text-xs text-foreground border border-border rounded-lg shadow-xs max-w-sm">
      <header className="space-y-1 text-center">
        <h2 className="text-lg font-bold">YOFASO SHOP</h2>
        <p className="text-[11px] text-muted-foreground">THỜI TRANG THÔNG MINH & VTON</p>
        <p>48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng</p>
        <p>Hotline: 0905.123.456</p>
        <p className="pt-2 font-bold text-accent-hover">
          {displayId.startsWith("DH") ? displayId : `#POS-${displayId}`}
        </p>
      </header>
      <div className="my-3 border-y border-dashed border-border py-2 text-[11px] space-y-0.5">
        <p>Thu ngân: <span className="font-semibold">{order.cashierId && order.cashierId !== "NV-REAL" ? order.cashierId : "Quầy Thu Ngân POS"}</span></p>
        {order.customerName && <p>Khách hàng: <span className="font-semibold">{order.customerName}</span></p>}
        <p>Kênh bán: <span className="font-semibold">{vnLabel(order.channel || "TAI_QUAY_POS")}</span></p>
        <p>Thời gian: {orderDate}</p>
        {order.status && <p>Trạng thái: <span className="font-bold">{vnLabel(order.status)}</span></p>}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dashed border-border">
            <th className="text-left pb-1">Tên hàng / SL × Giá</th>
            <th className="text-right pb-1">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {(order.lines || []).map((d, idx) => (
            <tr key={d.variantId || d.maQuanLy || idx} className="border-b border-border/40">
              <td className="py-2">
                <span className="font-semibold">{d.ten}</span> {d.size ? `(${d.size})` : ""} {d.mau ? `· ${d.mau}` : ""}
                <br />
                <span className="text-muted-foreground">{d.soLuong} × {vnd(d.donGia)}</span>
              </td>
              <td className="text-right align-bottom pb-2 font-bold">{vnd(thanhTien(d))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="space-y-1.5 border-t border-dashed border-border pt-3">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Giảm giá voucher/điểm</dt>
          <dd className="text-destructive font-bold">-{vnd(order.discount || 0)}</dd>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
          <dt>TỔNG CỘNG</dt>
          <dd className="text-accent-hover">{vnd(due)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Phương thức</dt>
          <dd>{order.method === "CASH" ? "Tiền mặt tại quầy" : order.method === "QR" ? "VietQR Napas247" : "Thẻ POS"}</dd>
        </div>
        {order.method === "CASH" && (
          <>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Khách đưa</dt>
              <dd>{vnd(order.tendered || due)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiền thối lại</dt>
              <dd className="font-bold text-success">{vnd(cashChange(due, order.tendered || due))}</dd>
            </div>
          </>
        )}
      </dl>
      <footer className="mt-5 space-y-2 text-center">
        <QRCodeSVG value={`YOFASO:RECEIPT:${displayId}`} size={96} className="mx-auto" />
        <p className="text-[10px] text-muted-foreground">
          Quét mã để xem lại ảnh thử đồ VTON
          <br /> & Đổi trả trong 7 ngày
        </p>
      </footer>
    </article>
  );
}
