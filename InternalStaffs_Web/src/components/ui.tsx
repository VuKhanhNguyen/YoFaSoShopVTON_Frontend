"use client";
import { useEffect, useRef, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { labels } from "@/lib/validation";
import { money, type Row } from "@/lib/models";
export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  retry?: () => void;
}) {
  if (loading)
    return (
      <div aria-label="Đang tải" className="skeleton-group">
        {[1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  if (error)
    return (
      <div role="alert" className="error-banner">
        {error}{" "}
        {retry && (
          <button className="secondary" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <h3>Chưa có dữ liệu</h3>
        <p>Nội dung sẽ hiển thị tại đây khi có cập nhật.</p>
      </div>
    );
  return null;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  useEffect(() => {
    ref.current?.showModal();
  }, [mounted]);
  if (!mounted) return null;
  // Portal tại body để chrome màn hình bị ẩn khi in mà không ẩn cả hóa đơn.
  return createPortal(
    <dialog ref={ref} onCancel={onClose} aria-labelledby={titleId}>
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="secondary"
          aria-label="Đóng hộp thoại"
          onClick={onClose}
        >
          Đóng
        </button>
      </header>
      {children}
    </dialog>, document.body
  );
}
const extra: Record<string, string> = {
  productId: "Mã sản phẩm",
  variantId: "Biến thể",
  userId: "Người dùng",
  orderId: "Mã đơn",
  sessionId: "Mã phiên",
  shiftId: "Mã ca",
  status: "Trạng thái",
  stock: "Tồn kho",
  unitPrice: "Đơn giá",
  productName: "Sản phẩm",
  orderLineId: "Dòng đơn",
  createdAt: "Ngày tạo",
  openedAt: "Mở ca",
  closedAt: "Đóng ca",
  openingCash: "Tiền đầu ca",
  countedCash: "Tiền kiểm đếm",
  collectAmount: "Thu hộ",
  paymentStatus: "Thanh toán",
  channel: "Kênh bán",
  total: "Tổng tiền",
  subtotal: "Tiền hàng",
  shippingFee: "Phí giao",
  discount: "Giảm giá",
  address: "Địa chỉ",
  reviewId: "Mã đánh giá",
  beforeStock: "Tồn trước",
  afterStock: "Tồn sau",
  movementId: "Mã biến động",
  roleId: "Mã quyền",
  label: "Tên hiển thị",
  name: "Tên",
  cashierId: "Thu ngân",
  membership: "Hạng thành viên",
  points: "Điểm",
  expectedCash: "Tiền dự kiến",
  cashSales: "Bán tiền mặt",
  grossSales: "Doanh thu gộp",
  orderCount: "Tổng đơn",
  completedCount: "Đơn hoàn tất",
  activeProducts: "Sản phẩm đang bán",
  notificationId: "Mã thông báo",
  title: "Tiêu đề",
  content: "Nội dung",
  read: "Đã đọc",
  body: "Nội dung",
  operationId: "Mã xử lý",
  resourceId: "Mã phiên",
  kind: "Loại tác vụ",
  simulated: "Mô phỏng",
  error: "Thông báo lỗi",
};
export const fieldLabel = (key: string) => labels[key] || extra[key] || key;
function value(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined) return "Chưa có";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "object")
    return Array.isArray(v) ? `${v.length} mục` : "Chi tiết";
  if (/price|amount|total|cash|sales|fee|discount/i.test(key))
    return <span className="mono">{money(v)}</span>;
  if (key === "status" || key === "paymentStatus")
    return <span className="badge">{String(v).replaceAll("_", " ")}</span>;
  return String(v);
}
export function Details({ row, omit = [] }: { row: Row; omit?: string[] }) {
  return (
    <dl className="details">
      {Object.entries(row)
        .filter(
          ([k, v]) =>
            !omit.includes(k) && (v === null || typeof v !== "object"),
        )
        .map(([k, v]) => (
          <div key={k}>
            <dt>{fieldLabel(k)}</dt>
            <dd>{value(k, v)}</dd>
          </div>
        ))}
    </dl>
  );
}
export function DataTable({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: string[];
  actions?: (row: Row) => ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((k) => (
              <th key={k}>{fieldLabel(k)}</th>
            ))}
            {actions && <th>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={String(
                row.orderId ||
                  row.productId ||
                  row.userId ||
                  row.shiftId ||
                  row.variantId ||
                  row.reviewId ||
                  row.notificationId ||
                  i,
              )}
            >
              {columns.map((k) => (
                <td key={k}>{value(k, row[k])}</td>
              ))}
              {actions && (
                <td>
                  <div className="table-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
