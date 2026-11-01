/**
 * YoFaSo Shop — Orders & Notifications Store & Master Data
 * High-fashion luxury seed data matching Lovable screen-to-reality-builder
 */
import { EditorialImages, formatVND } from "./catalog-data";

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

const now = Date.now();

export const SEED_ORDERS: DonHang[] = [
  {
    maDonHang: "DH00000001",
    ngayDat: now - 35 * 60000,
    lines: [
      {
        id: "SP00000001-0-M",
        maSanPham: "SP00000001",
        tenSanPham: "Áo Sơ Mi Lụa Dáng Rủ Cổ Điển",
        hinhAnh: EditorialImages.shirt,
        donGia: 650000,
        tenMau: "Trắng ngà Pearl",
        maMauHex: "#F5F3EF",
        size: "M",
        soLuong: 1,
      },
      {
        id: "SP00000002-1-M",
        maSanPham: "SP00000002",
        tenSanPham: "Quần Âu Xếp Ly Dáng Rộng Cạp Cao",
        hinhAnh: EditorialImages.pants,
        donGia: 890000,
        tenMau: "Đen tuyền Noir",
        maMauHex: "#111827",
        size: "M",
        soLuong: 1,
      },
    ],
    phuongThuc: "VIETQR",
    trangThai: "DANG_DONG_GOI",
    tongTien: 1540000,
  },
  {
    maDonHang: "DH00000002",
    ngayDat: now - 2 * 86400000,
    lines: [
      {
        id: "SP00000003-0-S",
        maSanPham: "SP00000003",
        tenSanPham: "Đầm Lụa Midi Cúp Ngực Phối Nơ Lưng",
        hinhAnh: EditorialImages.dress,
        donGia: 1250000,
        tenMau: "Đen tuyền Noir",
        maMauHex: "#1A1A1A",
        size: "S",
        soLuong: 1,
      },
    ],
    phuongThuc: "COD",
    trangThai: "HOAN_TAT",
    tongTien: 1280000,
  },
  {
    maDonHang: "DH00000003",
    ngayDat: now - 5 * 86400000,
    lines: [
      {
        id: "SP00000004-0-L",
        maSanPham: "SP00000004",
        tenSanPham: "Áo Blazer Dạ Tweed Dệt Tay Tối Giản",
        hinhAnh: EditorialImages.blazer,
        donGia: 1450000,
        tenMau: "Đen sọc vàng Gold",
        maMauHex: "#18181B",
        size: "L",
        soLuong: 1,
      },
    ],
    phuongThuc: "VIETQR",
    trangThai: "HOAN_TAT",
    tongTien: 1450000,
  },
];

export const SEED_NOTIFICATIONS: ThongBao[] = [
  {
    id: "n1",
    loai: "DON_HANG",
    tieuDe: "Kho đang đóng gói đơn #DH00000001",
    noiDung: "Đơn hàng của bạn đã thanh toán VietQR thành công và đang được chuẩn bị để bàn giao cho shipper.",
    time: now - 15 * 60000,
    daDoc: false,
    link: { pathname: "/order/[id]", params: { id: "DH00000001" } },
  },
  {
    id: "n2",
    loai: "THU_DO_VTON",
    tieuDe: "Kết quả ướm thử VTON đạt 95/100 (Tuyệt hảo)",
    noiDung: "Set Áo Sơ Mi Lụa + Quần Âu Xếp Ly có tỉ lệ cơ thể cực chuẩn. Chạm để xem chi tiết và Digital Fitting Pass.",
    time: now - 2 * 3600000,
    daDoc: false,
    link: { pathname: "/session/[id]", params: { id: "PT00000001" } },
  },
  {
    id: "n3",
    loai: "KHUYEN_MAI",
    tieuDe: "Mã VTON5 & BIRTHDAY15 dành riêng cho bạn",
    noiDung: "Đặc quyền thành viên VIP Gold: Nhận ngay mã giảm 15% tối đa 150.000đ cho bộ sưu tập SS26 mới nhất.",
    time: now - 6 * 3600000,
    daDoc: false,
    link: { pathname: "/cart" },
  },
  {
    id: "n4",
    loai: "CANH_BAO_KHO",
    tieuDe: "Áo sơ mi lụa màu Đen tuyền chỉ còn 1 chiếc",
    noiDung: "Sản phẩm trong danh sách yêu thích của bạn sắp hết size M tại xưởng may YoFaSo Atelier.",
    time: now - 26 * 3600000,
    daDoc: true,
    link: { pathname: "/product/[id]", params: { id: "SP00000001" } },
  },
  {
    id: "n5",
    loai: "HE_THONG",
    tieuDe: "Chào mừng đến YoFaSo Atelier",
    noiDung: "Ướm thử AI miễn phí cho mọi sản phẩm có nhãn VTON Ready. Khám phá phong cách cá nhân hoàn mỹ ngay hôm nay.",
    time: now - 3 * 86400000,
    daDoc: true,
  },
];
