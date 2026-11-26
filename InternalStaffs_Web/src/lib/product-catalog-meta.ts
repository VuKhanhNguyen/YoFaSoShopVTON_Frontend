export interface LabeledOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

export interface CategoryOption {
  value: string;
  label: string;
  parentId?: string | null;
}

export interface KMeansColor {
  name: string;
  hex: string;
  share: number;
}

export type VtonCategory = "upper_body" | "lower_body" | "dress";
export type ProductFit = "OM_SAT" | "SUONG_VUA" | "RONG_OVERSIZE";
export type WaistType = "CAP_CAO" | "CAP_VUA" | "CAP_TRE" | "KHONG_AP_DUNG";
export type GarmentLength =
  | "AO_CROPTOP"
  | "AO_TIEU_CHUAN"
  | "AO_DANG_DAI"
  | "NGAN_TREN_GOI"
  | "LUNG_NGANG_GOI"
  | "MIDI_QUA_GOI"
  | "DAI_CHAM_GOT";
export type PatternType =
  | "VAI_TRON"
  | "HOA_VAN_NHO"
  | "HOA_TO_BAN"
  | "KE_SOC_TAM"
  | "KE_CARO"
  | "IN_HINH";
export type ProductStatus = "BAN_NHAP" | "DANG_XU_LY_AI" | "DANG_KINH_DOANH" | "TAM_NGUNG";
export type VariantSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "FREESIZE";
export type VariantStatus = "DANG_BAN" | "HET_HANG" | "NGUNG_BAN";

export const VTON_CATEGORY_OPTIONS: LabeledOption<VtonCategory>[] = [
  { value: "upper_body", label: "Áo (Phần trên)", hint: "upper_body" },
  { value: "lower_body", label: "Quần / Chân váy (Phần dưới)", hint: "lower_body" },
  { value: "dress", label: "Đầm liền thân", hint: "dress" },
];

export interface SubtypeOption extends LabeledOption {
  vtonCategory: VtonCategory;
}

export const DEEPFASHION2_SUBTYPES: SubtypeOption[] = [
  { value: "short_sleeved_shirt", label: "Áo tay ngắn", vtonCategory: "upper_body" },
  { value: "long_sleeved_shirt", label: "Áo tay dài", vtonCategory: "upper_body" },
  { value: "short_sleeved_outwear", label: "Áo khoác tay ngắn", vtonCategory: "upper_body" },
  { value: "long_sleeved_outwear", label: "Áo khoác tay dài", vtonCategory: "upper_body" },
  { value: "vest", label: "Áo gile / không tay", vtonCategory: "upper_body" },
  { value: "sling", label: "Áo hai dây", vtonCategory: "upper_body" },
  { value: "shorts", label: "Quần short / ngắn", vtonCategory: "lower_body" },
  { value: "trousers", label: "Quần dài / quần tây", vtonCategory: "lower_body" },
  { value: "skirt", label: "Chân váy", vtonCategory: "lower_body" },
  { value: "short_sleeved_dress", label: "Đầm tay ngắn", vtonCategory: "dress" },
  { value: "long_sleeved_dress", label: "Đầm tay dài", vtonCategory: "dress" },
  { value: "vest_dress", label: "Đầm sát nách / không tay", vtonCategory: "dress" },
  { value: "sling_dress", label: "Đầm hai dây", vtonCategory: "dress" },
];

export const FIT_OPTIONS: LabeledOption<ProductFit>[] = [
  { value: "OM_SAT", label: "Ôm sát" },
  { value: "SUONG_VUA", label: "Suông vừa" },
  { value: "RONG_OVERSIZE", label: "Rộng oversize" },
];

export const WAIST_OPTIONS: LabeledOption<WaistType>[] = [
  { value: "CAP_CAO", label: "Cạp cao" },
  { value: "CAP_VUA", label: "Cạp vừa" },
  { value: "CAP_TRE", label: "Cạp trễ" },
  { value: "KHONG_AP_DUNG", label: "Không áp dụng" },
];

export const LENGTH_OPTIONS: (LabeledOption<GarmentLength> & { groups: VtonCategory[] })[] = [
  { value: "AO_CROPTOP", label: "Áo croptop", groups: ["upper_body"] },
  { value: "AO_TIEU_CHUAN", label: "Áo tiêu chuẩn", groups: ["upper_body"] },
  { value: "AO_DANG_DAI", label: "Áo dáng dài", groups: ["upper_body"] },
  { value: "NGAN_TREN_GOI", label: "Ngắn trên gối", groups: ["lower_body", "dress"] },
  { value: "LUNG_NGANG_GOI", label: "Lửng ngang gối", groups: ["lower_body", "dress"] },
  { value: "MIDI_QUA_GOI", label: "Midi qua gối", groups: ["lower_body", "dress"] },
  { value: "DAI_CHAM_GOT", label: "Dài chạm gót", groups: ["lower_body", "dress"] },
];

export const PATTERN_OPTIONS: LabeledOption<PatternType>[] = [
  { value: "VAI_TRON", label: "Vải trơn" },
  { value: "HOA_VAN_NHO", label: "Hoa văn nhỏ" },
  { value: "HOA_TO_BAN", label: "Hoa to bản" },
  { value: "KE_SOC_TAM", label: "Kẻ sọc tăm" },
  { value: "KE_CARO", label: "Kẻ ca rô" },
  { value: "IN_HINH", label: "In hình" },
];

export const PRODUCT_STATUS_OPTIONS: LabeledOption<ProductStatus>[] = [
  { value: "BAN_NHAP", label: "Bản nháp" },
  { value: "DANG_XU_LY_AI", label: "Đang xử lý AI" },
  { value: "DANG_KINH_DOANH", label: "Đang kinh doanh" },
  { value: "TAM_NGUNG", label: "Tạm ngừng" },
];

export const VARIANT_STATUS_OPTIONS: LabeledOption<VariantStatus>[] = [
  { value: "DANG_BAN", label: "Đang bán" },
  { value: "HET_HANG", label: "Hết hàng" },
  { value: "NGUNG_BAN", label: "Ngừng bán" },
];

export const ALL_SIZES: VariantSize[] = ["XS", "S", "M", "L", "XL", "XXL", "FREESIZE"];

export const DEFAULT_SHELF_CODES = [
  "KE-F01",
  "KE-F02",
  "KE-F03",
  "KE-F04",
  "KE-F05",
  "KE-F06",
  "KE-F07",
  "KE-F08",
  "KE-F09",
  "KE-F10",
  "KE-M01",
  "KE-M02",
  "KE-M03",
  "KE-D01",
  "KE-D02",
];

export const MATERIAL_PRESETS = [
  "100% Cotton cao cấp",
  "Vải tuytxi: 75% Polyester, 20% Rayon, 5% Spandex",
  "Vải Kate Silk: 65% Cotton, 35% Polyester",
  "Vải lụa satin mềm mịn",
  "Denim co giãn nhẹ",
  "Vải linen tự nhiên thoáng mát",
];

export function labelFor(options: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function buildYoFaSoDescriptionTemplate(name: string, material: string, fit: ProductFit): string {
  const fitLabel = labelFor(FIT_OPTIONS, fit);
  return [
    "📌 THÔNG TIN SẢN PHẨM",
    "- Thương hiệu: YoFaSo Shop",
    `- Tên mẫu: ${name || "(Nhập tên sản phẩm)"}`,
    `- Phom dáng (Fit): ${fitLabel}`,
    "- Độ xuyên thấu: Không xuyên thấu",
    "- Độ co giãn: Co giãn nhẹ",
    "",
    "✨ MÔ TẢ THIẾT KẾ & ĐIỂM NỔI BẬT",
    "[Mô tả phom dáng, đường cắt, chi tiết cổ/tay áo và điểm nhấn nổi bật của sản phẩm]",
    "",
    "🧵 CHẤT LIỆU & ĐẶC TÍNH VẢI",
    `- Thành phần: ${material || "(Ví dụ: 95% Cotton, 5% Spandex)"}`,
    "- Đặc tính: Bề mặt mịn màng, thoáng khí, giữ nếp tốt suốt ngày dài.",
    "",
    "💡 GỢI Ý PHỐI ĐỒ (MIX & MATCH)",
    "- Phong cách công sở / thanh lịch: [Gợi ý phối cùng quần tây / chân váy / blazer]",
    "- Phong cách dạo phố / trẻ trung: [Gợi ý phối cùng jeans / sneakers]",
    "",
    "🧺 HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN",
    "- Giặt tay hoặc giặt máy chế độ nhẹ với nước mát (dưới 30°C).",
    "- Không dùng chất tẩy mạnh; phơi nơi thoáng mát, tránh nắng gắt.",
  ].join("\n");
}

function slugToken(input: string, maxLen: number): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return (normalized || "SP").slice(0, maxLen);
}

export function buildSku(
  productName: string,
  colorName: string,
  size: string,
  productIdOrSeq: string | number = 1
): string {
  const p = slugToken(productName, 8);
  const c = slugToken(colorName, 6);
  const s = slugToken(size, 4);
  let numStr = "01";
  if (productIdOrSeq !== undefined && productIdOrSeq !== null && productIdOrSeq !== "") {
    if (typeof productIdOrSeq === "number") {
      numStr = productIdOrSeq >= 100 ? String(productIdOrSeq) : String(productIdOrSeq).padStart(3, "0");
    } else {
      const match = String(productIdOrSeq).match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        numStr = n >= 100 ? String(n) : String(n).padStart(3, "0");
      } else {
        numStr = String(productIdOrSeq);
      }
    }
  }
  return `SKU-${p}-${c}-${s}-${numStr}`;
}

export function pickDominantColor(palette: KMeansColor[]): KMeansColor {
  if (!palette.length) return { name: "Mặc định", hex: "#1F2937", share: 1 };
  return palette.reduce((best, cur) => (cur.share > best.share ? cur : best), palette[0]);
}

export interface InspectorSampleItem {
  id: string;
  label: string;
  colorName: string;
  dominantHex: string;
  palette: KMeansColor[];
  originalUrl: string;
  cutoutUrl: string;
  maskUrl: string;
  r2CutoutKey: string;
  r2MaskKey: string;
  predictedVton: VtonCategory;
  predictedSubtype: string;
  bodyPositionNote: string;
  confidence: string;
}

/**
 * Nhận diện giới tính thời trang (Nam / Nữ) từ mã hoặc tên danh mục
 */
export function detectCategoryGender(categoryIdOrLabel?: string): "FEMALE" | "MALE" {
  if (!categoryIdOrLabel) return "FEMALE";
  const val = categoryIdOrLabel.toUpperCase();
  const femaleCodes = ["DM000002", "DM000005", "DM000006", "DM000007"];
  const idNum = parseInt(val.replace("DM", ""), 10);
  if (
    femaleCodes.includes(val) ||
    (idNum >= 19 && idNum <= 32) ||
    val.includes("NỮ") ||
    val.includes("ĐẦM") ||
    val.includes("VÁY") ||
    val.includes("CROPTOP") ||
    val.includes("ÁO DÀI")
  ) {
    return "FEMALE";
  }
  return "MALE";
}

/**
 * Sinh mã lưu trữ slug cố định trên Cloudflare R2:
 * Tiền tố w- cho thời trang Nữ (women), m- cho thời trang Nam (men).
 * Bỏ dấu tiếng Việt, chuyển chữ thường, thay khoảng trắng thành dấu gạch nối.
 */
export function buildProductStorageSlug(
  productName: string,
  categoryId?: string,
  genderOverride?: "FEMALE" | "MALE"
): string {
  const gender = genderOverride ?? detectCategoryGender(categoryId);
  const prefix = gender === "FEMALE" ? "w-" : "m-";
  if (!productName || !productName.trim()) {
    return `${prefix}san-pham-moi`;
  }
  const normalized = productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}${normalized || "san-pham"}`;
}

