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

export const FALLBACK_CATEGORIES: CategoryOption[] = [
  { value: "DM000001", label: "Thời trang Nam", parentId: null },
  { value: "DM000002", label: "Thời trang Nữ", parentId: null },
  { value: "DM000003", label: "Áo nam", parentId: "DM000001" },
  { value: "DM000004", label: "Quần nam", parentId: "DM000001" },
  { value: "DM000005", label: "Áo nữ", parentId: "DM000002" },
  { value: "DM000006", label: "Quần nữ", parentId: "DM000002" },
  { value: "DM000007", label: "Đầm & Chân váy", parentId: "DM000002" },
  { value: "DM000008", label: "Áo gile & Vest nam", parentId: "DM000003" },
  { value: "DM000009", label: "Áo len & Cardigan nam", parentId: "DM000003" },
  { value: "DM000010", label: "Áo nỉ & Hoodie nam", parentId: "DM000003" },
  { value: "DM000011", label: "Áo polo nam", parentId: "DM000003" },
  { value: "DM000012", label: "Áo sơ mi nam", parentId: "DM000003" },
  { value: "DM000013", label: "Áo thun nam", parentId: "DM000003" },
  { value: "DM000014", label: "Quần jeans nam", parentId: "DM000004" },
  { value: "DM000015", label: "Quần jogger & Thể thao nam", parentId: "DM000004" },
  { value: "DM000016", label: "Quần kaki & Chinos nam", parentId: "DM000004" },
  { value: "DM000017", label: "Quần short nam", parentId: "DM000004" },
  { value: "DM000018", label: "Quần tây âu nam", parentId: "DM000004" },
  { value: "DM000019", label: "Áo gile & Croptop nữ", parentId: "DM000005" },
  { value: "DM000020", label: "Áo kiểu & Blouses nữ", parentId: "DM000005" },
  { value: "DM000021", label: "Áo len & Dệt kim nữ", parentId: "DM000005" },
  { value: "DM000022", label: "Áo nỉ & Hoodie nữ", parentId: "DM000005" },
  { value: "DM000023", label: "Áo sơ mi nữ", parentId: "DM000005" },
  { value: "DM000024", label: "Áo thun & Polo nữ", parentId: "DM000005" },
  { value: "DM000025", label: "Quần jeans nữ", parentId: "DM000006" },
  { value: "DM000026", label: "Quần ống rộng & Suông nữ", parentId: "DM000006" },
  { value: "DM000027", label: "Quần short nữ", parentId: "DM000006" },
  { value: "DM000028", label: "Quần tây công sở nữ", parentId: "DM000006" },
  { value: "DM000029", label: "Quần legging & Thể thao nữ", parentId: "DM000006" },
  { value: "DM000030", label: "Chân váy nữ", parentId: "DM000007" },
  { value: "DM000031", label: "Đầm liền thân", parentId: "DM000007" },
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

/** Dữ liệu mẫu thực tế từ Gile_Croptop3 (SP00000003) dùng khi GPU Worker chưa bật. */
export const SAMPLE_INSPECTOR_ITEMS: InspectorSampleItem[] = [
  {
    id: "sample-img01",
    label: "Ảnh 01 · Kem phối be",
    colorName: "Kem",
    dominantHex: "#CAD8D4",
    palette: [
      { name: "kem", hex: "#CAD8D4", share: 0.555 },
      { name: "be", hex: "#BBC9C6", share: 0.332 },
      { name: "trắng", hex: "#F1EBDF", share: 0.113 },
    ],
    originalUrl: "/assets/samples/croptop-img01-original.png",
    cutoutUrl: "/assets/samples/croptop-img01-cutout.png",
    maskUrl: "/assets/samples/croptop-img01-mask.png",
    r2CutoutKey: "catalog/products/w-ao-Xuan-He-dang-croptop/w-ao-Xuan-He-dang-croptop--img01--v01--cutout.png",
    r2MaskKey: "catalog-processing/products/w-ao-Xuan-He-dang-croptop/w-ao-Xuan-He-dang-croptop--img01--v01--mask.png",
    predictedVton: "upper_body",
    predictedSubtype: "short_sleeved_shirt",
    bodyPositionNote: "chạm eo (body_position=0.683 · IoU=0.9965)",
    confidence: "high (score upper_body=1.899)",
  },
  {
    id: "sample-img02",
    label: "Ảnh 02 · Be tự nhiên",
    colorName: "Be",
    dominantHex: "#CABEB2",
    palette: [{ name: "be", hex: "#CABEB2", share: 1.0 }],
    originalUrl: "/assets/samples/croptop-img02-original.png",
    cutoutUrl: "/assets/samples/croptop-img02-cutout.png",
    maskUrl: "/assets/samples/croptop-img02-mask.png",
    r2CutoutKey: "catalog/products/w-ao-Xuan-He-dang-croptop/w-ao-Xuan-He-dang-croptop--img02--v01--cutout.png",
    r2MaskKey: "catalog-processing/products/w-ao-Xuan-He-dang-croptop/w-ao-Xuan-He-dang-croptop--img02--v01--mask.png",
    predictedVton: "upper_body",
    predictedSubtype: "short_sleeved_shirt",
    bodyPositionNote: "chạm eo (auto_extended · +1.9%)",
    confidence: "high (support=2)",
  },
];

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

