/**
 * YoFaSo Shop — Orders & Notifications Types & Helpers
 */

export type TrangThaiDonHang =
  | "CHO_XAC_NHAN"
  | "DA_THANH_TOAN"
  | "DANG_DONG_GOI"
  | "DANG_GIAO_HANG"
  | "HOAN_TAT"
  | "DA_HUY";

export const LUONG_TRANG_THAI: TrangThaiDonHang[] = [
  "CHO_XAC_NHAN",
  "DA_THANH_TOAN",
  "DANG_DONG_GOI",
  "DANG_GIAO_HANG",
  "HOAN_TAT",
];

export const nhanTrangThai: Record<TrangThaiDonHang, string> = {
  CHO_XAC_NHAN: "Chờ xác nhận",
  DA_THANH_TOAN: "Đã thanh toán",
  DANG_DONG_GOI: "Đang đóng gói",
  DANG_GIAO_HANG: "Đang giao",
  HOAN_TAT: "Hoàn tất",
  DA_HUY: "Đã huỷ",
};

export interface OrderLineItem {
  id: string;
  maSanPham: string;
  tenSanPham: string;
  hinhAnh: any;
  donGia: number;
  tenMau: string;
  maMauHex: string;
  size: string;
  soLuong: number;
}

export interface DonHang {
  maDonHang: string;
  ngayDat: number;
  lines: OrderLineItem[];
  maKhuyenMai?: string;
  phuongThuc: "COD" | "VIETQR";
  trangThai: TrangThaiDonHang;
  tongTien: number;
}

export type LoaiThongBao =
  | "DON_HANG"
  | "THU_DO_VTON"
  | "CANH_BAO_KHO"
  | "KHUYEN_MAI"
  | "HE_THONG";

export interface ThongBao {
  id: string;
  loai: LoaiThongBao;
  tieuDe: string;
  noiDung: string;
  time: number;
  daDoc: boolean;
  link?: { pathname: string; params?: Record<string, string> };
}

export function timeAgo(t: number): string {
  const diffMs = Date.now() - t;
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
}
