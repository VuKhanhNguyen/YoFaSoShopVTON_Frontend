import type { Role } from "@/lib/auth";

export type NotifType =
  | "CANH_BAO_TON_KHO"
  | "DON_HANG_MOI"
  | "YEU_CAU_DUYET_CA"
  | "YEU_CAU_DUYET_KIEM_KE"
  | "VIETQR_THANH_CONG"
  | "CHUYEN_GIAO_MOI";

export type NotifTab = "all" | "stock" | "orders" | "approvals";

export interface StaffNotification {
  id: string;
  type: NotifType;
  tab: Exclude<NotifTab, "all">;
  roles: Role[];
  title: string;
  body: string;
  time: string;
  action?: string;
  read: boolean;
  urgent?: boolean;
}

/** Mock đồng bộ bảng ThongBao — 6 loại thông báo vận hành. */
export const NOTIFICATIONS: StaffNotification[] = [
  {
    id: "TB-001",
    type: "CANH_BAO_TON_KHO",
    tab: "stock",
    roles: ["ROLE_SHOP_ADMIN", "ROLE_STAFF_WAREHOUSE"],
    title: "Cảnh báo tồn kho tối thiểu: Áo sơ mi lụa trắng (Size M)",
    body: "Số lượng khả dụng chỉ còn 3 chiếc (ngưỡng an toàn là 5). Cần bổ sung gấp từ xưởng!",
    time: "5 phút trước",
    action: "Xem vị trí Kệ A-02",
    read: false,
    urgent: true,
  },
  {
    id: "TB-002",
    type: "DON_HANG_MOI",
    tab: "orders",
    roles: ["ROLE_STAFF_WAREHOUSE", "ROLE_SHOP_ADMIN"],
    title: "Đơn online mới #DH-2026-8809 (VietQR Đã thanh toán)",
    body: "Khách hàng Trần Mai Anh vừa thanh toán 1.250.000 đ. 3 sản phẩm đang chờ đóng gói.",
    time: "12 phút trước",
    action: "In Phiếu Nhặt Hàng",
    read: false,
  },
  {
    id: "TB-003",
    type: "YEU_CAU_DUYET_CA",
    tab: "approvals",
    roles: ["ROLE_SHOP_ADMIN"],
    title: "Yêu cầu phê duyệt kết ca thu ngân (Ca sáng - NV Lan)",
    body: "Tổng tiền mặt thực tế: 14.450.000 đ. Khớp 100% doanh thu sổ sách (Chênh lệch: 0 đ).",
    time: "30 phút trước",
    action: "Phê duyệt ngay",
    read: false,
  },
  {
    id: "TB-004",
    type: "YEU_CAU_DUYET_KIEM_KE",
    tab: "approvals",
    roles: ["ROLE_SHOP_ADMIN"],
    title: "Biên bản kiểm kê định kỳ Kệ Dãy B (Thủ kho Tuấn)",
    body: "Phát hiện thừa 1 Áo Blazer đen và thiếu 1 Quần Tây xám. Đề xuất cân bằng tồn kho.",
    time: "1 giờ trước",
    action: "Xem biên bản giải trình",
    read: false,
  },
  {
    id: "TB-005",
    type: "VIETQR_THANH_CONG",
    tab: "orders",
    roles: ["ROLE_STAFF_CASHIER"],
    title: "Nhận tiền VietQR thành công: 850.000 đ",
    body: "Giao dịch Napas247 khớp hóa đơn #POS-1042. Tự động kích hoạt in hóa đơn K80.",
    time: "2 giờ trước",
    read: true,
  },
  {
    id: "TB-006",
    type: "CHUYEN_GIAO_MOI",
    tab: "orders",
    roles: ["ROLE_STAFF_SHIPPER"],
    title: "Tuyến giao hàng Quận 1: 5 kiện hàng đã sẵn sàng",
    body: "Kho vừa hoàn tất đóng gói. Vui lòng quét mã bàn giao để xuất phát.",
    time: "3 giờ trước",
    read: true,
  },
];

export function visibleForRole(list: StaffNotification[], role: Role): StaffNotification[] {
  return list.filter((n) => n.roles.includes(role));
}

export function filterByTab(list: StaffNotification[], tab: NotifTab): StaffNotification[] {
  return tab === "all" ? list : list.filter((n) => n.tab === tab);
}

export function markAllRead(list: StaffNotification[]): StaffNotification[] {
  return list.map((n) => ({ ...n, read: true }));
}

export function markRead(list: StaffNotification[], id: string): StaffNotification[] {
  return list.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function unreadCount(list: StaffNotification[]): number {
  return list.filter((n) => !n.read).length;
}
