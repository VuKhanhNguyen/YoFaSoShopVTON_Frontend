import type { BienThe } from "@/lib/pos";

/** Phân hệ kho YoFaSo — dữ liệu mô phỏng đồng bộ DonHang / ChiTietDonHang / BienDongKho. */

export type WhStatus = "CHO_XAC_NHAN" | "DANG_DONG_GOI" | "CHO_SHIPPER" | "DANG_GIAO_HANG" | "DA_HUY";

export interface Shelf {
  day: "A" | "B" | "C" | "D";
  ke: string;
  tang: number;
}

export interface WhLine {
  sku: string;
  barcode: string;
  ten: string;
  size: string;
  mau: string;
  shelf: Shelf;
  qty: number;
}

export interface WhOrder {
  id: string;
  placedAt: string;
  shipper: string;
  payment: "VIETQR" | "COD";
  cod: number;
  receiver: string;
  phone: string;
  address: string;
  status: WhStatus;
  cancelReason?: string;
  lines: WhLine[];
}

const SHELF = {
  A01: { day: "A", ke: "A-01", tang: 2 } as Shelf,
  A02: { day: "A", ke: "A-02", tang: 1 } as Shelf,
  B03: { day: "B", ke: "B-03", tang: 1 } as Shelf,
  C02: { day: "C", ke: "C-02", tang: 1 } as Shelf,
  D01: { day: "D", ke: "D-01", tang: 3 } as Shelf,
};

export const WH_ORDERS: WhOrder[] = [
  {
    id: "DH00000001",
    placedAt: "08:12 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "COD",
    cod: 880_000,
    receiver: "Trần Thu Hà",
    phone: "0912.***.789",
    address: "48 Cao Thắng, Hải Châu, Đà Nẵng",
    status: "CHO_XAC_NHAN",
    lines: [
      { sku: "SM01-TRANG-M", barcode: "SKU-SM01-TRANG-M", ten: "Áo Sơ Mi Lụa Trắng", size: "M", mau: "Trắng", shelf: SHELF.A01, qty: 1 },
      { sku: "QT02-DEN-L", barcode: "SKU-QT02-DEN-L", ten: "Quần Tây Suông Đen", size: "L", mau: "Đen", shelf: SHELF.B03, qty: 1 },
    ],
  },
  {
    id: "DH00000002",
    placedAt: "08:40 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "VIETQR",
    cod: 0,
    receiver: "Phạm Quốc Bảo",
    phone: "0905.***.112",
    address: "12 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng",
    status: "CHO_XAC_NHAN",
    lines: [
      { sku: "OX01-XANH-L", barcode: "SKU-OX01-XANH-L", ten: "Áo Sơ Mi Oxford Xanh", size: "L", mau: "Xanh", shelf: SHELF.A02, qty: 2 },
    ],
  },
  {
    id: "DH00000003",
    placedAt: "09:05 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "VIETQR",
    cod: 0,
    receiver: "Lê Thu Trang",
    phone: "0932.***.456",
    address: "205 Hai Bà Trưng, Cẩm Lệ, Đà Nẵng",
    status: "DANG_DONG_GOI",
    lines: [
      { sku: "DM01-HOA-S", barcode: "SKU-DM01-HOA-S", ten: "Đầm Liền Hoa Nhí", size: "S", mau: "Hoa", shelf: SHELF.D01, qty: 1 },
    ],
  },
  {
    id: "DH00000004",
    placedAt: "09:31 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "COD",
    cod: 425_000,
    receiver: "Ngô Bảo Châu",
    phone: "0987.***.220",
    address: "77 Phan Châu Trinh, Hải Châu, Đà Nẵng",
    status: "CHO_XAC_NHAN",
    lines: [
      { sku: "SM01-TRANG-M", barcode: "SKU-SM01-TRANG-M", ten: "Áo Sơ Mi Lụa Trắng", size: "M", mau: "Trắng", shelf: SHELF.A01, qty: 1 },
    ],
  },
  {
    id: "DH00000005",
    placedAt: "09:48 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "VIETQR",
    cod: 0,
    receiver: "Vũ Ngọc Mai",
    phone: "0918.***.335",
    address: "15 Lê Duẩn, Hải Châu, Đà Nẵng",
    status: "DA_HUY",
    cancelReason: "Khách hàng vừa hủy đơn — dừng nhặt đồ ngay",
    lines: [
      { sku: "CV02-DEN-M", barcode: "SKU-CV02-DEN-M", ten: "Chân Váy Xếp Ly Midi", size: "M", mau: "Đen", shelf: SHELF.C02, qty: 1 },
    ],
  },
  {
    id: "DH00000006",
    placedAt: "10:02 · 19/10",
    shipper: "Shipper nội bộ",
    payment: "COD",
    cod: 590_000,
    receiver: "Đặng Hữu Phúc",
    phone: "0903.***.818",
    address: "30 Trần Phú, Hải Châu, Đà Nẵng",
    status: "CHO_SHIPPER",
    lines: [
      { sku: "QT02-DEN-L", barcode: "SKU-QT02-DEN-L", ten: "Quần Tây Suông Đen", size: "L", mau: "Đen", shelf: SHELF.B03, qty: 1 },
    ],
  },
];

/* ---------- UC_WH_01: Pick List tổng hợp tối ưu lộ trình kệ ---------- */

export interface PickItem {
  barcode: string;
  ten: string;
  size: string;
  mau: string;
  qty: number;
  orderIds: string[];
}

export interface PickGroup {
  shelf: Shelf;
  items: PickItem[];
}

/** Gom các đơn đã chọn thành phiếu nhặt hàng nhóm theo vị trí kệ, sắp xếp Dãy A → B → C → D. */
export function buildPickList(orders: WhOrder[]): PickGroup[] {
  const byShelf = new Map<string, PickGroup>();
  for (const order of orders) {
    if (order.status === "DA_HUY") continue;
    for (const line of order.lines) {
      const key = `${line.shelf.day}-${line.shelf.ke}-${line.shelf.tang}`;
      let group = byShelf.get(key);
      if (!group) {
        group = { shelf: line.shelf, items: [] };
        byShelf.set(key, group);
      }
      let item = group.items.find((i) => i.barcode === line.barcode);
      if (!item) {
        item = { barcode: line.barcode, ten: line.ten, size: line.size, mau: line.mau, qty: 0, orderIds: [] };
        group.items.push(item);
      }
      item.qty += line.qty;
      if (!item.orderIds.includes(order.id)) item.orderIds.push(order.id);
    }
  }
  return [...byShelf.values()].sort(
    (a, b) =>
      a.shelf.day.localeCompare(b.shelf.day) ||
      a.shelf.ke.localeCompare(b.shelf.ke) ||
      a.shelf.tang - b.shelf.tang,
  );
}

export function countItems(orders: WhOrder[]): number {
  return orders.filter((o) => o.status !== "DA_HUY").reduce((s, o) => s + o.lines.reduce((x, l) => x + l.qty, 0), 0);
}

/* ---------- UC_WH_02: Đối soát barcode tại trạm đóng gói ---------- */

export type ScanResult =
  | { kind: "ok"; line: WhLine; done: number; total: number }
  | { kind: "line-complete"; line: WhLine }
  | { kind: "wrong-variant"; scanned: string; expected: WhLine }
  | { kind: "unknown"; scanned: string };

/** Đối soát 1 lần quét barcode với danh sách món cần đóng gói. */
export function verifyScan(lines: WhLine[], scanned: Record<string, number>, barcode: string): ScanResult {
  const code = barcode.trim().toUpperCase();
  const line = lines.find((l) => l.barcode.toUpperCase() === code);
  if (!line) {
    // Quét nhầm biến thể khác của cùng mẫu (sai size/màu)
    const expected = lines.find((l) => {
      const prefix = l.barcode.split("-").slice(0, 2).join("-");
      return code.startsWith(prefix);
    });
    if (expected) return { kind: "wrong-variant", scanned: code, expected };
    return { kind: "unknown", scanned: code };
  }
  const done = scanned[line.barcode] ?? 0;
  if (done >= line.qty) return { kind: "line-complete", line };
  return { kind: "ok", line, done: done + 1, total: line.qty };
}

export function applyScan(scanned: Record<string, number>, line: WhLine): Record<string, number> {
  return { ...scanned, [line.barcode]: (scanned[line.barcode] ?? 0) + 1 };
}

export function scanProgress(lines: WhLine[], scanned: Record<string, number>): { done: number; total: number; complete: boolean } {
  const total = lines.reduce((s, l) => s + l.qty, 0);
  const done = lines.reduce((s, l) => s + Math.min(l.qty, scanned[l.barcode] ?? 0), 0);
  return { done, total, complete: total > 0 && done >= total };
}

/* ---------- UC_LOG: Bàn giao shipper & nhận hàng hoàn ---------- */

export interface ReturnCase {
  orderId: string;
  reason: string;
  receiver: string;
}

export const RETURN_CASES: Record<string, ReturnCase> = {
  DH00000007: { orderId: "DH00000007", reason: "Khách hẹn lại quá 3 lần không liên lạc được", receiver: "Trương Mỹ Linh" },
};

export function returnDecision(restock: boolean): { movement: "NHAP_KHO_HANG_HOAN" | "NHAP_KHO_HANG_LOI"; restoreStock: boolean } {
  return restock
    ? { movement: "NHAP_KHO_HANG_HOAN", restoreStock: true }
    : { movement: "NHAP_KHO_HANG_LOI", restoreStock: false };
}

/* ---------- UC_WH_AUDIT: Kiểm kê & báo cáo XNT ---------- */

export interface AuditItem {
  ke: string;
  sku: string;
  ten: string;
  size: string;
  mau: string;
  book: number;
}

export const AUDIT_ZONES: Record<string, { label: string; items: AuditItem[] }> = {
  A: {
    label: "DÃY KỆ A (ÁO TOPS)",
    items: [
      { ke: "A-01", sku: "SKU-SM01-TRANG-M", ten: "Áo Sơ Mi Lụa Trắng", size: "M", mau: "Trắng", book: 12 },
      { ke: "A-01", sku: "SKU-SM01-TRANG-L", ten: "Áo Sơ Mi Lụa Trắng", size: "L", mau: "Trắng", book: 9 },
      { ke: "A-02", sku: "SKU-PL02-DEN-L", ten: "Áo Polo Đen", size: "L", mau: "Đen", book: 8 },
      { ke: "A-02", sku: "SKU-OX01-XANH-L", ten: "Áo Sơ Mi Oxford Xanh", size: "L", mau: "Xanh", book: 15 },
    ],
  },
  B: {
    label: "DÃY KỆ B (QUẦN BOTTOMS)",
    items: [
      { ke: "B-03", sku: "SKU-QT02-DEN-L", ten: "Quần Tây Suông Đen", size: "L", mau: "Đen", book: 10 },
      { ke: "B-03", sku: "SKU-QT02-DEN-M", ten: "Quần Tây Suông Đen", size: "M", mau: "Đen", book: 7 },
    ],
  },
};

export function variance(book: number, counted: number): number {
  return counted - book;
}

export function auditSummary(items: AuditItem[], counts: Record<string, number>): {
  checked: number;
  matched: number;
  mismatched: number;
  totalDiff: number;
} {
  let checked = 0;
  let matched = 0;
  let mismatched = 0;
  let totalDiff = 0;
  for (const item of items) {
    const c = counts[item.sku];
    if (c === undefined || Number.isNaN(c)) continue;
    checked += 1;
    const diff = variance(item.book, c);
    if (diff === 0) matched += 1;
    else {
      mismatched += 1;
      totalDiff += diff;
    }
  }
  return { checked, matched, mismatched, totalDiff };
}

/** Báo cáo Xuất — Nhập — Tồn trong kỳ (mô phỏng). */
export const XNT = { tonDau: 520, nhapMoi: 150, xuatBan: 240, tonCuoi: 430 } as const;

export const LOW_STOCK_THRESHOLD = 5;

/** Danh sách biến thể chạm ngưỡng tồn an toàn. */
export function lowStock(products: BienThe[], threshold = LOW_STOCK_THRESHOLD): BienThe[] {
  return products.filter((p) => p.ton > 0 && p.ton <= threshold);
}
