import type { BienThe } from "@/lib/pos";

/** Phân hệ kho YoFaSo — kiểu dữ liệu & hàm nghiệp vụ đồng bộ MySQL DonHang / ChiTietDonHang / BienDongKho. */

export type WhStatus = "CHO_XAC_NHAN" | "DANG_DONG_GOI" | "CHO_SHIPPER" | "DANG_GIAO_HANG" | "DA_HUY" | "TRA_HANG" | "HOAN_TAT";

export interface Shelf {
  day: string;
  ke: string;
  tang: number;
}

export function parseShelf(raw: unknown): Shelf {
  if (raw && typeof raw === "object" && "day" in raw && "ke" in raw) {
    return raw as Shelf;
  }
  if (typeof raw === "string" && raw.trim()) {
    const clean = raw.trim().toUpperCase();
    const m = clean.match(/(?:KE-)?([A-Z])[-_]?(\d+)?/);
    const day = m && m[1] ? m[1] : clean.charAt(0) || "A";
    const tang = m && m[2] ? (parseInt(m[2], 10) % 4) + 1 : 1;
    return { day, ke: clean, tang };
  }
  return { day: "A", ke: "KHO-01", tang: 1 };
}

export interface WhLine {
  sku: string;
  barcode: string;
  ten: string;
  size: string;
  mau: string;
  shelf: Shelf;
  qty: number;
  variantId?: string;
  unitPrice?: number;
}

export interface WhOrder {
  id: string;
  orderId?: string;
  returnPending?: boolean | number;
  paymentStatus?: string;
  channel?: string;
  placedAt: string;
  shipper: string;
  shipperId?: string;
  payment: "VIETQR" | "COD";
  cod: number;
  receiver: string;
  phone: string;
  address: string;
  status: WhStatus;
  cancelReason?: string;
  lines: WhLine[];
}

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
      const sh = parseShelf(line.shelf);
      const key = `${sh.day}-${sh.ke}-${sh.tang}`;
      let group = byShelf.get(key);
      if (!group) {
        group = { shelf: sh, items: [] };
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

/** Đối soát 1 lần quét barcode hoặc nhập mã SKU với danh sách món cần đóng gói. */
export function verifyScan(lines: WhLine[], scanned: Record<string, number>, barcode: string): ScanResult {
  const code = barcode.trim().toUpperCase();
  const line = lines.find((l) => l.barcode.toUpperCase() === code || l.sku.toUpperCase() === code);
  if (!line) {
    // Quét nhầm biến thể khác của cùng mẫu (sai size/màu)
    const expected = lines.find((l) => {
      const prefix = l.barcode.split("-").slice(0, 2).join("-");
      return code.startsWith(prefix) || code.includes(prefix);
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

export function returnDecision(restock: boolean): { movement: "NHAP_KHO_HANG_HOAN" | "NHAP_KHO_HANG_LOI"; restoreStock: boolean } {
  return restock
    ? { movement: "NHAP_KHO_HANG_HOAN", restoreStock: true }
    : { movement: "NHAP_KHO_HANG_LOI", restoreStock: false };
}

/* ---------- UC_WH_AUDIT: Kiểm kê & báo cáo xuất - nhập - tồn ---------- */

export interface AuditItem {
  ke: string;
  sku: string;
  variantId?: string;
  ten: string;
  size: string;
  mau: string;
  book: number;
  revision?: number;
}

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

export const LOW_STOCK_THRESHOLD = 5;

/** Danh sách biến thể chạm ngưỡng tồn an toàn. */
export function lowStock(products: BienThe[], threshold = LOW_STOCK_THRESHOLD): BienThe[] {
  return products.filter((p) => p.ton > 0 && p.ton <= threshold);
}
