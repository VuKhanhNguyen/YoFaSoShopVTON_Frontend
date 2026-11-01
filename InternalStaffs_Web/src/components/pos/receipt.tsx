import { QRCodeSVG } from "qrcode.react";
import { thanhTien, vnd } from "@/lib/pos";
import { cashChange, orderDue, type Order } from "@/lib/pos-workflows";

export function Receipt({ order }: { order: Order }) {
  const due = orderDue(order);
  return (
    <article className="receipt mx-auto bg-surface p-4 font-mono text-xs text-foreground border border-border rounded-lg shadow-xs">
      <header className="space-y-1 text-center">
        <h2 className="text-lg font-bold">YOFASO SHOP</h2>
        <p className="text-[11px] text-muted-foreground">THỜI TRANG THÔNG MINH & VTON</p>
        <p>48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng</p>
        <p>Hotline: 0905.123.456</p>
        <p className="pt-2 font-bold text-accent-hover">#POS-2026-{order.id}</p>
      </header>
      <div className="my-3 border-y border-dashed border-border py-2 text-[11px]">
        <p>Thu ngân: NV-02 (Nguyễn Thị Lan)</p>
        <p>{new Date(order.created).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dashed border-border">
            <th className="text-left pb-1">Tên hàng / SL × Giá</th>
            <th className="text-right pb-1">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((d) => (
            <tr key={d.maQuanLy}>
              <td className="py-2">
                {d.ten} ({d.size})
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
          <dd className="text-destructive font-bold">-{vnd(order.discount)}</dd>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
          <dt>TỔNG CỘNG</dt>
          <dd className="text-accent-hover">{vnd(due)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Phương thức</dt>
          <dd>{order.method === "CASH" ? "Tiền mặt" : order.method === "QR" ? "VietQR Napas247" : "Thẻ POS"}</dd>
        </div>
        {order.method === "CASH" && (
          <>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Khách đưa</dt>
              <dd>{vnd(order.tendered)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tiền thối lại</dt>
              <dd className="font-bold text-success">{vnd(cashChange(due, order.tendered))}</dd>
            </div>
          </>
        )}
      </dl>
      <footer className="mt-5 space-y-2 text-center">
        <QRCodeSVG value={`YOFASO:RECEIPT:POS-2026-${order.id}`} size={96} className="mx-auto" />
        <p className="text-[10px] text-muted-foreground">
          Quét mã để xem lại ảnh thử đồ VTON
          <br /> & Đổi trả trong 7 ngày
        </p>
        <p className="text-[11px] font-semibold">Cảm ơn quý khách!</p>
        <p className="text-[10px] text-accent-hover font-mono">HÓA ĐƠN BÁN LẺ K80</p>
      </footer>
    </article>
  );
}
