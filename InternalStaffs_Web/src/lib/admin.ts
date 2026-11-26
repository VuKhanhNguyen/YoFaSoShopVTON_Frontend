export type AdminOrderStatus =
  | "CHO_XAC_NHAN"
  | "DANG_DONG_GOI"
  | "DANG_GIAO_HANG"
  | "HOAN_TAT"
  | "DA_HUY"
  | "TRA_HANG";

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
  paymentMethod?: string;
  lines: { name: string; qty: number; price: number }[];
  discount: number;
  history: string[];
}

export function adminOrderTotal(order: Pick<AdminOrder, "lines" | "discount">) {
  return Math.max(
    0,
    order.lines.reduce((sum, line) => sum + line.qty * line.price, 0) - order.discount
  );
}

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

export function voucherError(v: AdminVoucher, existing: AdminVoucher[] = []) {
  if (!/^[A-Z0-9_-]{3,30}$/.test(v.code) || !v.name.trim())
    return "Nhập tên và mã voucher hợp lệ (3–30 ký tự).";
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
  return Math.min(
    v.cap,
    v.kind === "SHIPPING" ? shipping : subtotal,
    v.kind === "PERCENT" ? Math.floor((subtotal * v.value) / 100) : v.value
  );
}

export interface AdminReview {
  id: string;
  lineId: string;
  orderId?: string;
  verified: boolean;
  customer: string;
  product: string;
  stars: number;
  comment: string;
  status: "CHO_DUYET" | "HIEN_THI" | "DA_AN";
  reply: string;
  photoUrl?: string | null;
  createdAt?: string;
}

export function canReview(
  lineId: string,
  purchasedLineIds: string[],
  reviews: Pick<AdminReview, "lineId">[]
) {
  return purchasedLineIds.includes(lineId) && !reviews.some((r) => r.lineId === lineId);
}

export function scoreClass(score: number) {
  if (score >= 85) return "RECOMMENDED";
  if (score >= 70) return "ACCEPTABLE";
  if (score >= 50) return "NEEDS_ADJUSTMENT";
  return "NOT_RECOMMENDED";
}

export interface RevenueDay {
  day: string;
  online: number;
  pos: number;
}

export function reconciliation(expected: number, actual: number) {
  const difference = actual - expected;
  return { difference, matched: difference === 0 };
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

export interface AuditEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  reason: string;
}
