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

const s = (maDon: string, khach: string, sdt: string, diaChi: string, soTienThuHo: number, ghiChu = "Cho xem hàng, không cho thử"): Stop => ({
  maDon, khach, sdt, diaChi, soTienThuHo, ghiChu, soLanGiao: 0, status: "DANG_GIAO_HANG",
});

/** Tuyến Hải Châu đã sắp xếp tối ưu (dữ liệu mô phỏng). */
export const ROUTE_HAI_CHAU: Stop[] = [
  s("DH00000001", "Trần Thu Hà", "0912345789", "48 Cao Thắng, Hải Châu, Đà Nẵng", 880_000),
  s("DH00000008", "Ngô Minh Khoa", "0905112233", "15 Lê Hồng Phong, Hải Châu, Đà Nẵng", 650_000),
  s("DH00000009", "Phan Thị Yến", "0935224466", "102 Phan Châu Trinh, Hải Châu, Đà Nẵng", 1_200_000),
  s("DH00000010", "Đặng Quốc Việt", "0978334455", "7 Trần Phú, Hải Châu, Đà Nẵng", 0, "Đã thanh toán online"),
  s("DH00000011", "Võ Hồng Nhung", "0913445566", "220 Bạch Đằng, Hải Châu, Đà Nẵng", 720_000),
  s("DH00000012", "Lý Thanh Tâm", "0988556677", "33 Nguyễn Chí Thanh, Hải Châu, Đà Nẵng", 990_000),
  s("DH00000015", "Huỳnh Gia Bảo", "0909667788", "64 Hoàng Diệu, Hải Châu, Đà Nẵng", 450_000),
  s("DH00000016", "Bùi Ngọc Lan", "0932778899", "18 Ông Ích Khiêm, Hải Châu, Đà Nẵng", 1_050_000),
  s("DH00000017", "Trương Đức Anh", "0967889900", "91 Lê Duẩn, Hải Châu, Đà Nẵng", 560_000),
  s("DH00000018", "Mai Phương Thảo", "0918990011", "5 Hùng Vương, Hải Châu, Đà Nẵng", 0, "Đã thanh toán online"),
  s("DH00000019", "Cao Minh Trí", "0903001122", "140 Nguyễn Văn Linh, Hải Châu, Đà Nẵng", 1_100_000),
  s("DH00000020", "Đỗ Thùy Linh", "0936112233", "27 Hải Phòng, Hải Châu, Đà Nẵng", 850_000),
];

/** Kiện thủ kho đang chờ bàn giao, quét để nạp thêm vào chuyến. */
export const PENDING_PARCELS: Stop[] = [
  s("DH00000013", "Lâm Bảo Ngọc", "0914223344", "58 Nguyễn Thị Minh Khai, Hải Châu, Đà Nẵng", 690_000),
  s("DH00000014", "Tạ Quang Huy", "0989334455", "12 Lý Tự Trọng, Hải Châu, Đà Nẵng", 0, "Đã thanh toán online"),
];

export const maskPhone = (p: string) => `${p.slice(0, 4)}.***.${p.slice(-3)}`;
export const mapsUrl = (addr: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

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
