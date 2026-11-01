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
