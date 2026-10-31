"use client";
import Link from "next/link";
import { useResource } from "@/hooks/use-resource";
import { money, type Row } from "@/lib/models";
import { can, useStaff } from "./StaffShell";
import { State } from "./ui";
export function Dashboard() {
  const user = useStaff(),
    admin = can(user, "SHOP_ADMIN"),
    state = useResource<Row>(admin ? "/admin/reports/summary" : null);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YoFaSo Shop</p>
          <h1>Xin chào, {user.fullName}</h1>
          <p className="muted">Sẵn sàng cho một ngày làm việc chỉn chu.</p>
        </div>
        <span className="date-label">
          {new Date().toLocaleDateString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            dateStyle: "long",
          })}
        </span>
      </div>
      {admin ? (
        <>
          <State {...state} retry={state.reload} />
          {state.data && (
            <section className="metrics" aria-label="Tổng quan kinh doanh">
              {[
                {
                  key: "grossSales",
                  label: "Doanh thu gộp đơn hoàn tất",
                  money: true,
                },
                { key: "orderCount", label: "Đơn hàng" },
                { key: "completedCount", label: "Đơn hoàn tất" },
                { key: "activeProducts", label: "Sản phẩm đang kinh doanh" },
              ].map((m) => (
                <div key={m.key}>
                  <p>{m.label}</p>
                  <strong className="mono">
                    {m.money
                      ? money(state.data![m.key])
                      : String(state.data![m.key])}
                  </strong>
                </div>
              ))}
            </section>
          )}
          <aside className="info-note">
            Báo cáo hiện là snapshot. Doanh thu gộp chưa trừ giảm giá và không
            thay thế báo cáo kế toán.
          </aside>
        </>
      ) : (
        <section className="welcome-panel">
          <h2>Không gian làm việc của bạn</h2>
          <p>Các công cụ bên dưới phù hợp với quyền hiện tại của tài khoản.</p>
        </section>
      )}
      <div className="quick-links">
        {can(user, "SHOP_ADMIN", "STAFF_CASHIER") && (
          <Link href="/workspace/pos">
            <h2>Mở quầy bán hàng</h2>
            <p>Quét SKU, tạo hóa đơn và nhận thanh toán tiền mặt.</p>
            <span>Bắt đầu bán hàng →</span>
          </Link>
        )}
        {can(user, "SHOP_ADMIN", "STAFF_WAREHOUSE") && (
          <Link href="/workspace/warehouse">
            <h2>Chuẩn bị đơn giao</h2>
            <p>Gom hàng theo kệ, đóng gói và phân công giao hàng.</p>
            <span>Vào kho →</span>
          </Link>
        )}
        {can(user, "STAFF_SHIPPER") && (
          <Link href="/workspace/deliveries">
            <h2>Đơn được phân công</h2>
            <p>Xem địa chỉ, gọi khách và cập nhật kết quả giao.</p>
            <span>Xem điểm giao →</span>
          </Link>
        )}
        {admin && (
          <Link href="/workspace/studio">
            <h2>Chuẩn bị bộ sưu tập mới</h2>
            <p>Phân tích ảnh sản phẩm và duyệt dữ liệu cho phòng thử đồ.</p>
            <span>Vào Studio →</span>
          </Link>
        )}
      </div>
    </>
  );
}
