// Pure last-mile delivery rules (UC_SHIP_STATUS, UC_SHIP_COD, UC_LOG_RETURN). In-memory simulation.
export type ShipStatus = "DANG_GIAO_HANG" | "HOAN_TAT" | "HEN_LAI" | "HOAN_TRA";
export type FailReason = "KHONG_NGHE_MAY" | "HEN_GIAO_LAI" | "TU_CHOI_NHAN";

export interface Stop {
  maDon: string;
  khach: string;
  sdt: string;
  diaChi: string;
  soTienThuHo: number;
  ghiChu: string;
  soLanGiao: number;
  status: ShipStatus;
  podPhoto?: string;
  lyDo?: FailReason;
}

export const MAX_ATTEMPTS = 3;

export const FAIL_REASONS: Record<FailReason, string> = {
  KHONG_NGHE_MAY: "Gọi 3 cuộc không nghe máy",
  HEN_GIAO_LAI: "Khách đi vắng hẹn giao chiều mai",
  TU_CHOI_NHAN: "Khách đổi ý từ chối nhận",
};

export const maskPhone = (p: string) =>
  !p || p.length < 7 ? p || "Chưa có SĐT" : `${p.slice(0, 4)}.***.${p.slice(-3)}`;
export const mapsUrl = (addr: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

/** Chuyển đổi dữ liệu đơn hàng từ CSDL sang trạm dừng giao hàng (Stop). */
export function mapOrderToStop(o: any): Stop {
  const maDon = o.orderId || o.id;
  const khach = o.recipientName || o.receiver || "Khách hàng";
  const sdt = o.phone || "";
  const diaChi = o.address || "";
  const soTienThuHo = Number(o.collectAmount ?? o.cod ?? 0);
  const ghiChu =
    o.ghiChu ||
    o.note ||
    (o.payment === "VIETQR" || (o.paymentMethod && String(o.paymentMethod).includes("VIETQR"))
      ? "Đã thanh toán online"
      : "Cho xem hàng, không cho thử");
  const soLanGiao = Number(o.soLanGiao ?? 0);
  let status: ShipStatus = "DANG_GIAO_HANG";
  if (o.status === "HOAN_TAT") status = "HOAN_TAT";
  else if (o.status === "TRA_HANG") status = "HOAN_TRA";
  else if (o.status === "DANG_GIAO_HANG") {
    if (ghiChu.includes("Hẹn") || ghiChu.includes("HEN_LAI") || soLanGiao > 0) status = "HEN_LAI";
    else status = "DANG_GIAO_HANG";
  }
  return { maDon, khach, sdt, diaChi, soTienThuHo, ghiChu, soLanGiao, status };
}

export type ScanOutcome = { kind: "added"; stop: Stop } | { kind: "duplicate" } | { kind: "unknown" };

export function scanParcel(route: Stop[], pending: Stop[], code: string): ScanOutcome {
  const c = code.trim().toUpperCase();
  if (route.some((r) => r.maDon === c)) return { kind: "duplicate" };
  const p = pending.find((x) => x.maDon === c);
  return p ? { kind: "added", stop: { ...p } } : { kind: "unknown" };
}

/** Giao thành công: bắt buộc xác nhận thu đủ COD (nếu có) và ảnh POD. */
export function completeDelivery(stop: Stop, cashConfirmed: boolean, podPhoto: string | undefined): Stop {
  if (stop.soTienThuHo > 0 && !cashConfirmed) throw new Error("Chưa xác nhận thu đủ COD");
  if (!podPhoto) throw new Error("Thiếu ảnh bằng chứng giao hàng");
  return { ...stop, status: "HOAN_TAT", soLanGiao: stop.soLanGiao + 1, podPhoto };
}

/** Giao thất bại: tăng SoLanGiao; đủ 3 lần hoặc khách từ chối → hoàn trả. */
export function failDelivery(stop: Stop, lyDo: FailReason): Stop {
  const soLanGiao = stop.soLanGiao + 1;
  const status: ShipStatus = soLanGiao >= MAX_ATTEMPTS || lyDo === "TU_CHOI_NHAN" ? "HOAN_TRA" : "HEN_LAI";
  return { ...stop, soLanGiao, status, lyDo };
}

export function settlement(route: Stop[]) {
  const done = route.filter((r) => r.status === "HOAN_TAT");
  return {
    total: route.length,
    delivered: done.length,
    codCollected: done.reduce((t, r) => t + r.soTienThuHo, 0),
    codExpected: route.reduce((t, r) => t + r.soTienThuHo, 0),
    returns: route.filter((r) => r.status === "HOAN_TRA").length,
    rescheduled: route.filter((r) => r.status === "HEN_LAI").length,
    pending: route.filter((r) => r.status === "DANG_GIAO_HANG").length,
  };
}
