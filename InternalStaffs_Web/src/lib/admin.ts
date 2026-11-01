export type AdminOrderStatus = "CHO_XAC_NHAN" | "DANG_DONG_GOI" | "DANG_GIAO_HANG" | "HOAN_TAT" | "DA_HUY";

export interface AdminOrder {
  id: string;
  date: string;
  channel: "ONLINE_APP" | "TAI_QUAY_POS";
  customer: string;
  phone: string;
  address: string;
  shipper: string;
  status: AdminOrderStatus;
  paid: boolean;
  lines: { name: string; qty: number; price: number }[];
  discount: number;
  history: string[];
}

export function adminOrderTotal(order: Pick<AdminOrder, "lines" | "discount">) {
  return Math.max(0, order.lines.reduce((sum, line) => sum + line.qty * line.price, 0) - order.discount);
}

export const ADMIN_ORDERS: AdminOrder[] = [
  {
    id: "DH00000001",
    date: "2026-10-19T09:12",
    channel: "ONLINE_APP",
    customer: "Trần Thu Hà",
    phone: "0912345789",
    address: "45 Lê Duẩn, Hải Châu, Đà Nẵng",
    shipper: "Lê Văn Hải",
    status: "CHO_XAC_NHAN",
    paid: true,
    lines: [{ name: "Áo Sơ Mi Lụa Trắng · M", qty: 2, price: 450000 }],
    discount: 20000,
    history: ["09:12 · Đặt hàng trên App", "09:13 · Xác nhận VietQR"],
  },
  {
    id: "POS1042",
    date: "2026-10-19T10:04",
    channel: "TAI_QUAY_POS",
    customer: "Nguyễn Mai Anh",
    phone: "0905123478",
    address: "Tại quầy YoFaSo",
    shipper: "—",
    status: "HOAN_TAT",
    paid: true,
    lines: [{ name: "Đầm lụa Slip · S", qty: 1, price: 890000 }],
    discount: 50000,
    history: ["10:04 · Thu ngân tạo hóa đơn", "10:05 · Thanh toán tiền mặt"],
  },
  {
    id: "DH00000003",
    date: "2026-10-18T14:28",
    channel: "ONLINE_APP",
    customer: "Lê Ngọc Linh",
    phone: "0905765432",
    address: "12 Nguyễn Văn Linh, Đà Nẵng",
    shipper: "Lê Văn Hải",
    status: "DANG_GIAO_HANG",
    paid: false,
    lines: [{ name: "Quần âu Tailored · M", qty: 1, price: 590000 }],
    discount: 0,
    history: ["18/10 · Đóng gói", "19/10 · Bàn giao shipper · COD"],
  },
  {
    id: "DH00000004",
    date: "2026-10-17T11:36",
    channel: "ONLINE_APP",
    customer: "Phạm Thảo Vy",
    phone: "0935123123",
    address: "88 Trần Phú, Đà Nẵng",
    shipper: "Chưa phân công",
    status: "DANG_DONG_GOI",
    paid: true,
    lines: [{ name: "Chân váy chữ A · S", qty: 1, price: 480000 }],
    discount: 0,
    history: ["17/10 · Đã nhận thanh toán", "19/10 · Đang đối soát barcode"],
  },
  {
    id: "POS1041",
    date: "2026-10-12T10:15",
    channel: "TAI_QUAY_POS",
    customer: "Khách tại quầy",
    phone: "—",
    address: "Tại quầy",
    shipper: "—",
    status: "DA_HUY",
    paid: false,
    lines: [{ name: "Áo Blazer đen · L", qty: 1, price: 1290000 }],
    discount: 0,
    history: ["12/10 · Hủy đơn: Khách đổi ý"],
  },
];

export type VoucherKind = "PERCENT" | "FIXED" | "SHIPPING";
export interface AdminVoucher {
  code: string;
  name: string;
  kind: VoucherKind;
  value: number;
  minimum: number;
  cap: number;
  quantity: number;
  used: number;
  expires: string;
}

export const ADMIN_VOUCHERS: AdminVoucher[] = [
  { code: "YOFASO10", name: "Giảm 10% đơn từ 500k", kind: "PERCENT", value: 10, minimum: 500000, cap: 100000, quantity: 100, used: 42, expires: "2026-10-31" },
  { code: "FREESHIP", name: "Miễn phí vận chuyển", kind: "SHIPPING", value: 30000, minimum: 0, cap: 30000, quantity: 200, used: 88, expires: "2026-10-31" },
];

export function voucherError(v: AdminVoucher, existing: AdminVoucher[] = []) {
  if (!/^[A-Z0-9_-]{3,30}$/.test(v.code) || !v.name.trim()) return "Nhập tên và mã voucher hợp lệ (3–30 ký tự).";
  if (existing.some((e) => e.code === v.code)) return "Mã voucher đã tồn tại.";
  if (
    ![v.value, v.minimum, v.cap, v.quantity].every(Number.isFinite) ||
    v.value <= 0 ||
    v.minimum < 0 ||
    v.cap <= 0 ||
    !Number.isInteger(v.quantity) ||
    v.quantity <= 0
  )
    return "Giá trị, mức giảm tối đa và số lượng phải hợp lệ.";
  if (v.kind === "PERCENT" && v.value > 100) return "Phần trăm giảm không vượt quá 100%.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.expires)) return "Chọn hạn sử dụng.";
  return null;
}

export function voucherDiscount(v: AdminVoucher, subtotal: number, day: string, shipping = 0) {
  if (subtotal < v.minimum || day > v.expires || v.used >= v.quantity) return 0;
  return Math.min(v.cap, v.kind === "SHIPPING" ? shipping : subtotal, v.kind === "PERCENT" ? Math.floor((subtotal * v.value) / 100) : v.value);
}

export interface AdminReview {
  id: string;
  lineId: string;
  verified: boolean;
  customer: string;
  product: string;
  stars: number;
  comment: string;
  status: "CHO_DUYET" | "HIEN_THI" | "DA_AN";
  reply: string;
}

export const ADMIN_REVIEWS: AdminReview[] = [
  {
    id: "DG001",
    lineId: "CTDH-0091",
    verified: true,
    customer: "Trần Thu Hà",
    product: "Áo Sơ Mi Lụa Trắng · Size M",
    stars: 5,
    comment: "Áo mặc vừa vặn y hệt như lúc thử bằng AI VTON trên app, vải mát mịn!",
    status: "CHO_DUYET",
    reply: "Cảm ơn bạn đã tin tưởng ủng hộ shop!",
  },
  {
    id: "DG002",
    lineId: "CTDH-0105",
    verified: true,
    customer: "Nguyễn Mai Anh",
    product: "Đầm lụa Slip · Size S",
    stars: 4,
    comment: "Màu đẹp, giao hàng nhanh. Shop tư vấn size rất chuẩn.",
    status: "HIEN_THI",
    reply: "YoFaSo cảm ơn bạn, mong được phục vụ bạn lần tới.",
  },
];

export function canReview(lineId: string, purchasedLineIds: string[], reviews: Pick<AdminReview, "lineId">[]) {
  return purchasedLineIds.includes(lineId) && !reviews.some((r) => r.lineId === lineId);
}

export function scoreClass(score: number) {
  if (score >= 85) return "RECOMMENDED";
  if (score >= 70) return "ACCEPTABLE";
  if (score >= 50) return "NEEDS_ADJUSTMENT";
  return "NOT_RECOMMENDED";
}

export const FUNNEL = [
  { label: "Xem sản phẩm", count: 10000, note: "100% lượt xem" },
  { label: "Ướm thử vào tôi", count: 1420, note: "14,2% lượt xem" },
  { label: "Nhận ảnh VTON & bảng điểm", count: 1385, note: "97,5% lượt thử" },
  { label: "Thử món gợi ý nâng điểm", count: 580, note: "41,8% nhận kết quả" },
  { label: "Chốt đơn mua combo", count: 406, note: "28,6% lượt thử" },
];

export interface RevenueDay {
  day: string;
  online: number;
  pos: number;
}

const WEIGHTS = Array.from({ length: 19 }, (_, i) => 7 + ((i * 7) % 11));
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);

export const REVENUE: RevenueDay[] = WEIGHTS.map((w, i) => ({
  day: `2026-10-${String(i + 1).padStart(2, "0")}`,
  online:
    i === 18
      ? 162300000 - WEIGHTS.slice(0, 18).reduce((s, n) => s + Math.floor((n / WSUM) * 162300000), 0)
      : Math.floor((w / WSUM) * 162300000),
  pos:
    i === 18
      ? 122200000 - WEIGHTS.slice(0, 18).reduce((s, n) => s + Math.floor((n / WSUM) * 122200000), 0)
      : Math.floor((w / WSUM) * 122200000),
}));

export const MONEY_FLOWS = [
  { id: "qr", label: "VietQR Online & Tại quầy", source: "Sao kê ngân hàng", expected: 185000000, actual: 185000000 },
  { id: "cash", label: "Tiền mặt két POS", source: "Biên bản kết ca thu ngân", expected: 68200000, actual: 68200000 },
  { id: "cod", label: "Tiền COD Shipper nộp", source: "Đơn hàng xuất kho & biên nhận", expected: 31300000, actual: 31300000 },
];

export function reconciliation(expected: number, actual: number) {
  const difference = actual - expected;
  return { difference, matched: difference === 0 };
}

export interface StudioVariant {
  size: string;
  color: string;
  barcode: string;
  price: number;
  stock: number;
  shelf: string;
}

export const STUDIO_VARIANTS: StudioVariant[] = [20, 35, 15].map((stock, i) => ({
  size: ["S", "M", "L"][i] ?? "M",
  color: "Trắng",
  barcode: `SKU-SM01-TRANG-${["S", "M", "L"][i]}`,
  price: 450000,
  stock,
  shelf: "A-01",
}));

export function validVariants(variants: StudioVariant[]) {
  return (
    variants.length > 0 &&
    new Set(variants.map((v) => v.barcode.trim().toUpperCase())).size === variants.length &&
    variants.every(
      (v) =>
        v.size.trim() &&
        v.color.trim() &&
        v.barcode.trim() &&
        v.shelf.trim() &&
        Number.isFinite(v.price) &&
        v.price > 0 &&
        Number.isInteger(v.stock) &&
        v.stock >= 0
    )
  );
}

export type StaffRole = "ROLE_STAFF_CASHIER" | "ROLE_STAFF_WAREHOUSE" | "ROLE_STAFF_SHIPPER";
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ROLE_STAFF_CASHIER: "Thu ngân POS",
  ROLE_STAFF_WAREHOUSE: "Kho / Điều phối",
  ROLE_STAFF_SHIPPER: "Giao vận nội bộ",
};

export interface AdminStaff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  locked: boolean;
}

export const ADMIN_STAFF: AdminStaff[] = [
  { id: "NV-02", name: "Nguyễn Thị Lan", email: "cashier@yofaso.vn", phone: "0905123402", role: "ROLE_STAFF_CASHIER", locked: false },
  { id: "NV-03", name: "Trần Minh Tuấn", email: "warehouse@yofaso.vn", phone: "0905123403", role: "ROLE_STAFF_WAREHOUSE", locked: false },
  { id: "NV-04", name: "Lê Văn Hải", email: "shipper@yofaso.vn", phone: "0905123404", role: "ROLE_STAFF_SHIPPER", locked: false },
];

export interface AuditEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  reason: string;
}

export const AUDIT_LOGS: AuditEntry[] = [
  { id: "LOG01", time: "12/10/2026 10:15", actor: "NV-02 · Thu ngân", action: "Hủy đơn hàng POS #1041", reason: "Khách đổi ý" },
  { id: "LOG02", time: "12/10/2026 08:30", actor: "Kho-01 · Thủ kho", action: "Xuất kho 12 kiện cho Shipper Hùng", reason: "Bàn giao theo tuyến" },
  { id: "LOG03", time: "11/10/2026 16:42", actor: "NV-01 · Chủ shop", action: "Sửa giá Áo Blazer: 1.250.000 → 1.290.000 đ", reason: "Cập nhật giá niêm yết" },
];

export function approveStock(current: number, delta: number, confirmed: boolean) {
  if (!confirmed || !Number.isInteger(delta) || current + delta < 0) return current;
  return current + delta;
}
