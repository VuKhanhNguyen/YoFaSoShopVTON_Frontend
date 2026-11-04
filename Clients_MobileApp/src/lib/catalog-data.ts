/**
 * YoFaSo Shop — Catalog & Master Product Data
 * Mirrors ERD_optimize & fromLovable high-fashion editorial dataset
 */

export type LoaiDanhMuc = "upper_body" | "lower_body" | "dress";
export type FormDang = "OM_SAT" | "SUONG_VUA" | "RONG_OVERSIZE";
export type HoaTiet = "VAI_TRON" | "KE_SOC_TAM" | "HOA_VAN_NHO" | "KE_CARO";
export type KichCo = "XS" | "S" | "M" | "L" | "XL";
export const KICH_CO: KichCo[] = ["XS", "S", "M", "L", "XL"];

export interface BienTheSanPham {
  maMauHex: string;
  tenMau: string;
  tonKho?: Partial<Record<KichCo, number>>;
  hinhAnh?: any[];
  anhNguoiMau?: any[];
}

export interface SanPham {
  maSanPham: string;
  tenSanPham: string;
  loai: LoaiDanhMuc;
  formDang: FormDang;
  hoaTiet: HoaTiet;
  capCao?: boolean;
  giaBan: number;
  hinhAnh: any;
  hinhAnhPhu?: any[];
  chatLieu?: string;
  moTa?: string;
  chiTiet?: string[];
  bienThe: BienTheSanPham[];
}

export const formatVND = (n: number | string | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })
    .format(Number(n))
    .replace("₫", "đ");
};

/**
 * Danh từ tiếng Việt chuẩn cho các hạng thành viên YoFaSo Atelier
 */
export const MEMBERSHIP_TIER_NAMES: Record<string, string> = {
  DONG: "Đồng",
  BAC: "Bạc",
  VANG: "Vàng",
  KIM_CUONG: "Kim cương",
  VIP: "VIP",
};

/**
 * Trả về tên hiển thị của hạng thẻ (vd: "Vàng", "Kim cương", "VIP", "Đồng", "Bạc")
 */
export function getMembershipTierName(
  membership?: string | null,
  membershipLabel?: string | null
): string {
  if (membershipLabel && membershipLabel.trim()) {
    return membershipLabel.trim();
  }
  if (!membership || !membership.trim()) {
    return "VIP";
  }
  const code = membership.trim().toUpperCase();
  return MEMBERSHIP_TIER_NAMES[code] || membership.trim();
}

/**
 * Định dạng nhãn hiển thị cho Thẻ Hội Viên (vd: "Thành viên Vàng", "Thành viên VIP")
 */
export function formatMembershipBadge(
  membership?: string | null,
  membershipLabel?: string | null
): string {
  const tierName = getMembershipTierName(membership, membershipLabel);
  return `Thành viên ${tierName}`;
}

/**
 * Định dạng hiển thị hạng đầy đủ trên UI (vd: "Hạng Vàng", "Hạng Kim cương", "Hạng VIP")
 */
export function formatMembershipRank(
  membership?: string | null,
  membershipLabel?: string | null
): string {
  const tierName = getMembershipTierName(membership, membershipLabel);
  return `Hạng ${tierName}`;
};

// Local fallback editorial images
export const EditorialImages = {
  hero: require("../../assets/editorial/home-hero.jpg"),
  onboard1: require("../../assets/editorial/onboard-1.jpg"),
  onboard2: require("../../assets/editorial/onboard-2.jpg"),
  onboard3: require("../../assets/editorial/onboard-3.jpg"),
  shirt: require("../../assets/editorial/p-shirt.jpg"),
  shirtDetail: require("../../assets/editorial/p-shirt-detail.jpg"),
  shirtModel: require("../../assets/editorial/p-shirt-model.jpg"),
  shirtBeige: require("../../assets/editorial/p-shirt-beige.jpg"),
  shirtBlack: require("../../assets/editorial/p-shirt-black.jpg"),
  shirtBlackModel: require("../../assets/editorial/p-shirt-black-model.jpg"),
  pants: require("../../assets/editorial/p-pants.jpg"),
  dress: require("../../assets/editorial/p-dress.jpg"),
  blazer: require("../../assets/editorial/p-blazer.jpg"),
  stripe: require("../../assets/editorial/p-stripe.jpg"),
  skirt: require("../../assets/editorial/p-skirt.jpg"),
  bannerLogin: require("../../assets/editorial/banner-login-v3.png"),
};

export const SAN_PHAM_MOCK: SanPham[] = [
  {
    maSanPham: "SP00000001",
    tenSanPham: "Áo Sơ Mi Lụa Dáng Rộng Cổ V (Relaxed Silk Shirt)",
    loai: "upper_body",
    formDang: "SUONG_VUA",
    hoaTiet: "VAI_TRON",
    giaBan: 450000,
    hinhAnh: EditorialImages.shirt,
    hinhAnhPhu: [EditorialImages.shirtDetail],
    chatLieu: "Lụa pha Cotton cao cấp, form suông vừa, vải trơn",
    moTa: "Từng đường kim mũi chỉ trên nền lụa pha Cotton cao cấp. Dáng Relaxed suông vừa với cổ V thanh lịch — chiếc áo đa dụng từ công sở đến dạo phố, mặc riêng hay làm lớp ngoài đều lên hình trang nhã.",
    chiTiet: [
      "Cổ V phối nẹp kín, hàng khuy nhỏ xà cừ tinh tế",
      "Tay áo hơi loe nhẹ, dễ cuộn lên cổ tay tạo điểm nhấn",
      "Hông suông, che khuyết điểm vùng bụng",
      "Phối cùng quần âu ống rộng cạp cao hoặc chân váy chữ A",
    ],
    bienThe: [
      {
        maMauHex: "#FFFFFF",
        tenMau: "Trắng ngà",
        tonKho: { XS: 4, S: 9, M: 12, L: 6, XL: 0 },
        hinhAnh: [EditorialImages.shirt],
        anhNguoiMau: [EditorialImages.shirtModel],
      },
      {
        maMauHex: "#E8E2D2",
        tenMau: "Be kem",
        tonKho: { XS: 0, S: 5, M: 8, L: 3, XL: 0 },
        hinhAnh: [EditorialImages.shirtBeige],
      },
      {
        maMauHex: "#1A1A1A",
        tenMau: "Đen than",
        tonKho: { XS: 2, S: 7, M: 1, L: 0, XL: 0 },
        hinhAnh: [EditorialImages.shirtBlack],
        anhNguoiMau: [EditorialImages.shirtBlackModel],
      },
    ],
  },
  {
    maSanPham: "SP00000002",
    tenSanPham: "Quần Âu Ống Rộng Xếp Ly Cạp Cao (High-Rise Trousers)",
    loai: "lower_body",
    formDang: "SUONG_VUA",
    hoaTiet: "VAI_TRON",
    capCao: true,
    giaBan: 1150000,
    hinhAnh: EditorialImages.pants,
    chatLieu: "Vải âu tuyết mưa dày dặn, đứng form tự nhiên",
    moTa: "Quần âu ống rộng màu rêu với cạp cao hack dáng — kéo dài chân và định hình thắt eo. Phom suông thẳng từ hông xuống gấu tạo cảm giác bước đi uyển chuyển và phong thái sang trọng.",
    chiTiet: [
      "Cạp cao 4.5cm, hàng khuy ẩn chắc chắn",
      "Ống suông rộng thẳng tắp, dài phủ nhẹ qua mắt cá chân",
      "Hai túi chéo hông sâu, đường ly xếp đôi phía trước",
      "Mặc cùng sơ mi lụa đóng thùng chia tỉ lệ cơ thể vàng 1/3 - 2/3",
    ],
    bienThe: [
      {
        maMauHex: "#4A5D4E",
        tenMau: "Xanh rêu",
        tonKho: { XS: 3, S: 6, M: 10, L: 4, XL: 2 },
        hinhAnh: [EditorialImages.pants],
      },
      {
        maMauHex: "#1F2937",
        tenMau: "Đen tuyền",
        tonKho: { XS: 2, S: 8, M: 12, L: 5, XL: 1 },
        hinhAnh: [EditorialImages.pants],
      },
    ],
  },
  {
    maSanPham: "SP00000003",
    tenSanPham: "Đầm Liền Cổ Blazer Linen Thắt Đai (Belted Linen Dress)",
    loai: "dress",
    formDang: "SUONG_VUA",
    hoaTiet: "VAI_TRON",
    giaBan: 1450000,
    hinhAnh: EditorialImages.dress,
    chatLieu: "Linen dệt tự nhiên, thoáng mát, bề mặt vân mộc",
    moTa: "Thiết kế đầm liền kết hợp tinh thần áo blazer và nét mềm mại nữ tính. Thắt đai eo bản nhỡ bằng vải tiệp màu giúp tôn vòng hai tự nhiên, dễ dàng phối giày mũi nhọn hoặc sandal quai mảnh.",
    chiTiet: [
      "Cổ ve lật vát chữ K kinh điển của âu phục thủ công",
      "Đai thắt kèm khóa kim loại vàng cát mạ mờ",
      "Vạt đầm chéo nhẹ bước đi kín đáo, tôn dáng",
      "Phù hợp cho cả sự kiện trang trọng và dạo phố cuối tuần",
    ],
    bienThe: [
      {
        maMauHex: "#D8C7B5",
        tenMau: "Cát ấm",
        tonKho: { XS: 1, S: 4, M: 7, L: 2, XL: 0 },
        hinhAnh: [EditorialImages.dress],
      },
    ],
  },
  {
    maSanPham: "SP00000004",
    tenSanPham: "Áo Blazer Dạ Cashmere Dáng Hộp (Oversized Cashmere Blazer)",
    loai: "upper_body",
    formDang: "RONG_OVERSIZE",
    hoaTiet: "VAI_TRON",
    giaBan: 1850000,
    hinhAnh: EditorialImages.blazer,
    chatLieu: "Dạ Cashmere pha len cừu cao cấp",
    moTa: "Đường cắt tối giản nhưng đầy quyền lực. Cầu vai đệm nhẹ định hình phom người mặc, lớp lót lụa mềm êm ái khi tiếp xúc trực tiếp làn da.",
    chiTiet: [
      "Cầu vai cấu trúc đệm mỏng 0.5cm chuẩn may đo",
      "Túi nắp bản lớn phía hông",
      "Khuy sừng màu nâu hổ phách tương phản",
    ],
    bienThe: [
      {
        maMauHex: "#3F3B37",
        tenMau: "Nâu khói",
        tonKho: { XS: 0, S: 3, M: 6, L: 5, XL: 2 },
        hinhAnh: [EditorialImages.blazer],
      },
    ],
  },
  {
    maSanPham: "SP00000005",
    tenSanPham: "Áo Dệt Kim Kẻ Sọc Cổ Tròn (Fine Stripe Knitwear)",
    loai: "upper_body",
    formDang: "SUONG_VUA",
    hoaTiet: "KE_SOC_TAM",
    giaBan: 520000,
    hinhAnh: EditorialImages.stripe,
    chatLieu: "Sợi dệt kim Viscose mảnh, co giãn nhẹ",
    moTa: "Họa tiết kẻ sọc tăm kinh điển lấy cảm hứng từ phong cách thủy thủ Pháp (Breton stripe). Bản phối màu đen - be tinh tế, dễ kết hợp với mọi chân váy hoặc quần jean.",
    chiTiet: [
      "Sọc tăm 0.8cm mảnh mai, không gây rối mắt",
      "Cổ tròn viền bo dệt đôi giữ form sau nhiều lần giặt",
      "Vạt áo suông nhẹ, tay lửng qua khủy",
    ],
    bienThe: [
      {
        maMauHex: "#E5E1D8",
        tenMau: "Sọc kem đen",
        tonKho: { XS: 5, S: 11, M: 8, L: 3, XL: 1 },
        hinhAnh: [EditorialImages.stripe],
      },
    ],
  },
  {
    maSanPham: "SP00000006",
    tenSanPham: "Chân Váy Chữ A Lụa Satin Xẻ Tà (Satin Midi Skirt)",
    loai: "lower_body",
    formDang: "SUONG_VUA",
    hoaTiet: "VAI_TRON",
    capCao: true,
    giaBan: 790000,
    hinhAnh: EditorialImages.skirt,
    chatLieu: "Lụa Satin dệt chéo có độ bóng mờ sang trọng",
    moTa: "Chân váy chữ A dài ngang bắp chân với đường xẻ tà bên hông vừa phải. Độ rũ nhẹ nhàng theo từng chuyển động bước chân, tạo hiệu ứng thị giác thon thả.",
    chiTiet: [
      "Lưng thun ẩn phía sau co giãn thoải mái",
      "Đường xẻ tà 20cm bên đùi trái kín đáo mà duyên dáng",
      "Vải không nhăn khi ngồi lâu",
    ],
    bienThe: [
      {
        maMauHex: "#B8A389",
        tenMau: "Vàng cát Bronze",
        tonKho: { XS: 2, S: 5, M: 7, L: 4, XL: 0 },
        hinhAnh: [EditorialImages.skirt],
      },
    ],
  },
];

export const tonKho = (b: BienTheSanPham, s: KichCo): number => {
  return b.tonKho?.[s] ?? 0;
};

export const vtonHint = (loai: LoaiDanhMuc): string => {
  switch (loai) {
    case "upper_body":
      return "Nhóm Áo VTON: Chụp ảnh từ thắt lưng trở lên hoặc toàn thân. Giữ vai và tay không che khuất phần ngực áo.";
    case "lower_body":
      return "Nhóm Quần/Váy VTON: Bắt buộc ảnh chụp toàn thân thấy rõ mắt cá chân và mũi giày để AI định hình độ rũ của gấu.";
    case "dress":
      return "Nhóm Đầm Liền VTON: Ảnh toàn thân đứng thẳng tự nhiên, khoảng cách chụp cách ống kính 1.8m - 2.5m.";
  }
};

export interface Voucher {
  maKhuyenMai: string;
  maPhieuGiamGia: string;
  tenChuongTrinh: string;
  loaiGiamGia: "PHAN_TRAM" | "TIEN_MAT_TRUC_TIEP" | "MIEN_PHI_VAN_CHUYEN";
  giaTriGiam: number;
  giaTriDonHangToiThieu: number;
  giamToiDa?: number | null;
  soLuongPhatHanh: number;
  soLuongDaDung: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: "DANG_DIEN_RA" | "TAM_DUNG" | "KET_THUC";
  tag: string;
  category: "ALL" | "NEW" | "SHIPPING" | "VTON" | "VIP";
}

export const VOUCHERS_MOCK: Voucher[] = [
  {
    maKhuyenMai: "KM000007",
    maPhieuGiamGia: "YOFASO15",
    tenChuongTrinh: "Ưu đãi 15% đơn hàng đầu tiên",
    loaiGiamGia: "PHAN_TRAM",
    giaTriGiam: 15,
    giaTriDonHangToiThieu: 350000,
    giamToiDa: 150000,
    soLuongPhatHanh: 500,
    soLuongDaDung: 62,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Khách hàng mới",
    category: "NEW",
  },
  {
    maKhuyenMai: "KM000008",
    maPhieuGiamGia: "FREESHIP",
    tenChuongTrinh: "Miễn phí vận chuyển giao hàng toàn quốc",
    loaiGiamGia: "MIEN_PHI_VAN_CHUYEN",
    giaTriGiam: 30000,
    giaTriDonHangToiThieu: 500000,
    giamToiDa: 30000,
    soLuongPhatHanh: 1000,
    soLuongDaDung: 185,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Giao hàng toàn quốc",
    category: "SHIPPING",
  },
  {
    maKhuyenMai: "KM000009",
    maPhieuGiamGia: "VTON100",
    tenChuongTrinh: "Voucher kích hoạt hồ sơ AI dáng người",
    loaiGiamGia: "TIEN_MAT_TRUC_TIEP",
    giaTriGiam: 100000,
    giaTriDonHangToiThieu: 600000,
    giamToiDa: 100000,
    soLuongPhatHanh: 300,
    soLuongDaDung: 41,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Đặc quyền AI VTON",
    category: "VTON",
  },
  {
    maKhuyenMai: "KM000001",
    maPhieuGiamGia: "YOFASO10",
    tenChuongTrinh: "Ưu đãi 10% đơn hàng đầu tiên",
    loaiGiamGia: "PHAN_TRAM",
    giaTriGiam: 10,
    giaTriDonHangToiThieu: 300000,
    giamToiDa: 100000,
    soLuongPhatHanh: 500,
    soLuongDaDung: 48,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Chào bạn mới",
    category: "NEW",
  },
  {
    maKhuyenMai: "KM000002",
    maPhieuGiamGia: "FREESHIP50",
    tenChuongTrinh: "Miễn phí vận chuyển toàn quốc",
    loaiGiamGia: "MIEN_PHI_VAN_CHUYEN",
    giaTriGiam: 30000,
    giaTriDonHangToiThieu: 250000,
    giamToiDa: 30000,
    soLuongPhatHanh: 1000,
    soLuongDaDung: 126,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Freeship đơn từ 250k",
    category: "SHIPPING",
  },
  {
    maKhuyenMai: "KM000003",
    maPhieuGiamGia: "GIAM50K",
    tenChuongTrinh: "Giảm ngay 50.000đ cho đơn từ 500.000đ",
    loaiGiamGia: "TIEN_MAT_TRUC_TIEP",
    giaTriGiam: 50000,
    giaTriDonHangToiThieu: 500000,
    giamToiDa: 50000,
    soLuongPhatHanh: 300,
    soLuongDaDung: 89,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Đơn từ 500k",
    category: "VIP",
  },
  {
    maKhuyenMai: "KM000004",
    maPhieuGiamGia: "VIPGOLD15",
    tenChuongTrinh: "Đặc quyền tri ân hội viên Vàng & Kim Cương",
    loaiGiamGia: "PHAN_TRAM",
    giaTriGiam: 15,
    giaTriDonHangToiThieu: 600000,
    giamToiDa: 200000,
    soLuongPhatHanh: 200,
    soLuongDaDung: 35,
    ngayBatDau: "01/01/2026",
    ngayKetThuc: "31/12/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Hội viên Vàng",
    category: "VIP",
  },
  {
    maKhuyenMai: "KM000006",
    maPhieuGiamGia: "HEVTON2026",
    tenChuongTrinh: "Lễ hội thử đồ ảo mùa hè VTON",
    loaiGiamGia: "TIEN_MAT_TRUC_TIEP",
    giaTriGiam: 70000,
    giaTriDonHangToiThieu: 700000,
    giamToiDa: 70000,
    soLuongPhatHanh: 400,
    soLuongDaDung: 95,
    ngayBatDau: "01/06/2026",
    ngayKetThuc: "31/08/2026",
    trangThai: "DANG_DIEN_RA",
    tag: "Lễ hội AI hè 2026",
    category: "VTON",
  },
  {
    maKhuyenMai: "KM000005",
    maPhieuGiamGia: "SINHNHATYOFASO",
    tenChuongTrinh: "Quà tặng sinh nhật tháng vàng",
    loaiGiamGia: "PHAN_TRAM",
    giaTriGiam: 20,
    giaTriDonHangToiThieu: 400000,
    giamToiDa: 250000,
    soLuongPhatHanh: 100,
    soLuongDaDung: 12,
    ngayBatDau: "01/05/2026",
    ngayKetThuc: "31/05/2026",
    trangThai: "TAM_DUNG",
    tag: "Sinh nhật hội viên",
    category: "VIP",
  },
];

export interface UserVoucherWallet {
  maNguoiDung: string;
  maKhuyenMai: string;
  ngayThuThap: string;
  trangThai: "CHUA_DUNG" | "DA_DUNG" | "HET_HAN";
  ngaySuDung?: string | null;
  maDonHangDaDung?: string | null;
}

export const USER_VOUCHER_WALLET_MOCK: Record<string, UserVoucherWallet[]> = {
  ND00000002: [
    { maNguoiDung: "ND00000002", maKhuyenMai: "KM000001", ngayThuThap: "2026-10-20 09:00:00", trangThai: "DA_DUNG", ngaySuDung: "2026-10-28 09:30:00", maDonHangDaDung: "DH00000001" },
    { maNguoiDung: "ND00000002", maKhuyenMai: "KM000002", ngayThuThap: "2026-10-22 14:00:00", trangThai: "CHUA_DUNG" },
    { maNguoiDung: "ND00000002", maKhuyenMai: "KM000007", ngayThuThap: "2026-10-25 10:15:00", trangThai: "CHUA_DUNG" },
    { maNguoiDung: "ND00000002", maKhuyenMai: "KM000008", ngayThuThap: "2026-10-26 11:30:00", trangThai: "CHUA_DUNG" },
    { maNguoiDung: "ND00000002", maKhuyenMai: "KM000009", ngayThuThap: "2026-10-28 08:45:00", trangThai: "CHUA_DUNG" },
  ],
  ND00000003: [
    { maNguoiDung: "ND00000003", maKhuyenMai: "KM000001", ngayThuThap: "2026-10-21 10:00:00", trangThai: "DA_DUNG", ngaySuDung: "2026-10-28 10:15:00", maDonHangDaDung: "DH00000002" },
    { maNguoiDung: "ND00000003", maKhuyenMai: "KM000008", ngayThuThap: "2026-10-27 15:20:00", trangThai: "CHUA_DUNG" },
  ],
  ND00000004: [
    { maNguoiDung: "ND00000004", maKhuyenMai: "KM000002", ngayThuThap: "2026-10-22 09:10:00", trangThai: "DA_DUNG", ngaySuDung: "2026-10-28 10:45:00", maDonHangDaDung: "DH00000003" },
    { maNguoiDung: "ND00000004", maKhuyenMai: "KM000003", ngayThuThap: "2026-10-25 16:30:00", trangThai: "CHUA_DUNG" },
  ],
  ND00000005: [
    { maNguoiDung: "ND00000005", maKhuyenMai: "KM000007", ngayThuThap: "2026-10-27 08:00:00", trangThai: "CHUA_DUNG" },
    { maNguoiDung: "ND00000005", maKhuyenMai: "KM000008", ngayThuThap: "2026-10-27 08:05:00", trangThai: "CHUA_DUNG" },
  ],
  ND00000006: [
    { maNguoiDung: "ND00000006", maKhuyenMai: "KM000001", ngayThuThap: "2026-10-26 14:00:00", trangThai: "CHUA_DUNG" },
    { maNguoiDung: "ND00000006", maKhuyenMai: "KM000009", ngayThuThap: "2026-10-28 09:00:00", trangThai: "CHUA_DUNG" },
  ],
};

export type UserWalletVoucherItem = Voucher & {
  walletStatus: "CHUA_DUNG" | "DA_DUNG" | "HET_HAN";
  ngayThuThap: string;
  maDonHangDaDung: string | null | undefined;
};

export function getUserVouchers(userId?: string): UserWalletVoucherItem[] {
  const currentUserId = userId || "ND00000002";
  const records = USER_VOUCHER_WALLET_MOCK[currentUserId] || USER_VOUCHER_WALLET_MOCK["ND00000002"];
  const list: UserWalletVoucherItem[] = [];
  for (const rec of records) {
    const v = VOUCHERS_MOCK.find((item) => item.maKhuyenMai === rec.maKhuyenMai);
    if (v) {
      list.push({
        ...v,
        walletStatus: rec.trangThai,
        ngayThuThap: rec.ngayThuThap,
        maDonHangDaDung: rec.maDonHangDaDung ?? null,
      });
    }
  }
  return list;
}
