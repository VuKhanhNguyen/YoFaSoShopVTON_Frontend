import { type Product, type Variant } from "@/lib/models";

export type ShopModelId = "female" | "male" | "female_upper" | "male_upper";
export type FashionGender = "NAM" | "NU";

export type TryOnColorGroup = {
  key: string;
  name: string;
  hex: string;
  primaryHex: string;
  variants: Variant[];
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "FREESIZE"];
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function primaryHexOf(colors?: string, fallback = "#CBD5E1"): string {
  return (
    (colors || "")
      .split(",")
      .map((s) => s.trim())
      .find((s) => HEX_COLOR_RE.test(s)) || fallback
  );
}

export function matchColor(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA === normB) return true;
  const tokensA = normA.split(",").map((s) => s.trim()).filter(Boolean);
  const tokensB = normB.split(",").map((s) => s.trim()).filter(Boolean);
  if (!tokensA.length || !tokensB.length) return false;
  if (tokensA[0] === tokensB[0]) return true;
  return tokensA.some((t) => tokensB.includes(t));
}

/** Ưu tiên ảnh sản phẩm thật (role !== "reference", có cutout), tránh chọn nhầm 2 ảnh người mẫu đầu tiên. */
export function pickProductImageForColor(product?: Product, colorHex?: string): string | undefined {
  const images = product?.images ?? [];
  const isGarment = (img: NonNullable<Product["images"]>[number]) =>
    img.role !== "reference" && Boolean(img.cutoutUrl) && !(img.originalUrl || "").includes("--ref");
  const isNonModel = (img: NonNullable<Product["images"]>[number]) =>
    img.role !== "reference" && !img.cover && !(img.originalUrl || "").includes("--ref");

  if (colorHex) {
    const exactGarment = images.find((i) => isGarment(i) && matchColor(i.colors, colorHex) && i.originalUrl);
    if (exactGarment?.originalUrl) return exactGarment.originalUrl;
    const exactCutout = images.find((i) => isGarment(i) && matchColor(i.colors, colorHex) && i.cutoutUrl);
    if (exactCutout?.cutoutUrl) return exactCutout.cutoutUrl;
    const nonModelMatch = images.find((i) => isNonModel(i) && matchColor(i.colors, colorHex) && i.originalUrl);
    if (nonModelMatch?.originalUrl) return nonModelMatch.originalUrl;
  }
  const anyGarment = images.find((i) => isGarment(i) && i.originalUrl);
  if (anyGarment?.originalUrl) return anyGarment.originalUrl;
  const anyNonModel = images.find((i) => isNonModel(i) && i.originalUrl);
  if (anyNonModel?.originalUrl) return anyNonModel.originalUrl;
  return product?.coverUrl;
}

export function normalizeGender(gender?: string): FashionGender | undefined {
  const g = (gender || "").trim().toUpperCase();
  if (g === "NAM" || g === "MALE") return "NAM";
  if (g === "NU" || g === "NỮ" || g === "FEMALE") return "NU";
  return undefined;
}

export function isUpperOnlyFrame(frame?: string, shopModelId?: string): boolean {
  if (shopModelId && shopModelId.includes("upper")) return true;
  const f = (frame || "").trim().toUpperCase();
  return f === "HALF_BODY" || f === "UPPER" || f === "THREE_QUARTER";
}

export type CompatibilityResult = { allowed: true } | { allowed: false; reason: string };

/** Ràng buộc VTON: full-body thử mọi loại; nửa thân chỉ thử áo; nghiêm cấm phối Đầm liền với Áo/Quần/Chân váy. */
export function checkTryOnCompatibility(input: {
  targetCategory?: string;
  frame?: string;
  shopModelId?: string;
  chainedFromCategory?: string;
  chainedFromFrame?: string;
}): CompatibilityResult {
  const target = (input.targetCategory || "").trim();
  const prevCat = (input.chainedFromCategory || "").trim();

  if (prevCat === "dress" && (target === "upper_body" || target === "lower_body")) {
    return {
      allowed: false,
      reason: "Không thể thử chung Đầm liền với Áo hoặc Quần/Chân váy. Vui lòng đổi sang ảnh gốc khác.",
    };
  }
  if ((prevCat === "upper_body" || prevCat === "lower_body") && target === "dress") {
    return {
      allowed: false,
      reason: "Nghiêm cấm thử Đầm liền chung với Áo hoặc Quần/Chân váy. Vui lòng đổi sang ảnh gốc khác.",
    };
  }
  if (prevCat === "upper_body" && target === "lower_body" && isUpperOnlyFrame(input.chainedFromFrame, input.shopModelId)) {
    return {
      allowed: false,
      reason: "Ảnh kết quả chỉ có nửa thân trên nên không thể thử tiếp Quần/Chân váy. Hãy dùng ảnh toàn thân.",
    };
  }
  if ((target === "lower_body" || target === "dress") && isUpperOnlyFrame(input.frame, input.shopModelId)) {
    return {
      allowed: false,
      reason:
        target === "dress"
          ? "Ảnh nửa thân trên không thể thử Đầm liền. Vui lòng chuyển sang khung/ảnh Toàn thân."
          : "Ảnh nửa thân trên không thể thử Quần/Chân váy. Vui lòng chuyển sang khung/ảnh Toàn thân.",
    };
  }
  return { allowed: true };
}

export function checkModelGenderLock(
  productGender: FashionGender | undefined,
  targetModelGender: "female" | "male"
): CompatibilityResult {
  if (productGender === "NU" && targetModelGender === "male") {
    return {
      allowed: false,
      reason: "Sản phẩm thuộc Thời trang Nữ nên chỉ cho phép thử trên Mẫu nữ.",
    };
  }
  if (productGender === "NAM" && targetModelGender === "female") {
    return {
      allowed: false,
      reason: "Sản phẩm thuộc Thời trang Nam nên chỉ cho phép thử trên Mẫu nam.",
    };
  }
  return { allowed: true };
}

export function groupVariantsByColor(variants: Variant[]): TryOnColorGroup[] {
  const groups = new Map<string, TryOnColorGroup>();
  for (const v of variants) {
    const key = (v.colors || v.colorName || v.variantId).trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      const primaryHex = primaryHexOf(v.colors);
      group = {
        key,
        name: v.colorName || "Màu sắc",
        hex: v.colors || primaryHex,
        primaryHex,
        variants: [],
      };
      groups.set(key, group);
    }
    if (!group.variants.some((item) => item.size === v.size)) {
      group.variants.push(v);
    }
  }
  const rank = (size: string) => {
    const idx = SIZE_ORDER.indexOf(size.trim().toUpperCase());
    return idx === -1 ? SIZE_ORDER.length : idx;
  };
  for (const group of groups.values()) {
    group.variants.sort((a, b) => rank(a.size) - rank(b.size));
  }
  return Array.from(groups.values());
}

export type PairedTryOnItem = {
  sessionId: string;
  productId: string;
  productName: string;
  variantId: string;
  vtonCategory?: string;
  sku?: string;
  size?: string;
  colorName?: string;
  colorHex?: string;
  productImageUrl?: string;
};

export type TryOnSession = {
  sessionId: string;
  productId: string;
  productName: string;
  variantId: string;
  vtonCategory: string;
  sku?: string;
  size?: string;
  colorName?: string;
  colorHex?: string;
  productImageUrl?: string;
  personFrame?: string;
  productGender?: FashionGender;
  sourceSessionId?: string;
  pairedItem?: PairedTryOnItem;
  status: string;
  progress?: number;
  stage?: string;
  stageMessage?: string;
  shopModelId?: ShopModelId;
  personAssetId?: string;
  resultAssetId?: string;
  jobId?: string;
  simulated?: boolean;
  result?: { referenceReviewed?: boolean };
  retryable?: boolean;
  error?: string | { message?: string };
  createdAt: string;
  score?: number | null;
  advice?: string;
  proportionScore?: number;
  colorScore?: number;
  patternScore?: number;
  penaltyScore?: number;
  tier?: string;
  tierLabel?: string;
  proportionRule?: string;
  proportionNote?: string;
  singleItemPreview?: {
    evaluated: boolean;
    singleItem: boolean;
    colorName?: string;
    colorNote?: string;
    patternRule?: string;
    patternNote?: string;
    source?: string;
  };
};

export function buildFittingPassQrPayload(
  session: TryOnSession,
  resolvedProductImageUrl: string,
  scoreOverride?: number | null,
  resolvedPairedImageUrl?: string
): string {
  const numericScore = Number(scoreOverride ?? session.score ?? 0);
  const vtonScore = Number.isFinite(numericScore) && numericScore > 0 ? Math.round(numericScore) : 0;
  const currentItem = {
    sessionId: session.sessionId,
    productId: session.productId,
    sku: session.sku || session.variantId,
    productName: session.productName,
    colorName: session.colorName || "",
    colorHex: primaryHexOf(session.colorHex, "#CBD5E1"),
    size: session.size || "",
    productImage: resolvedProductImageUrl,
  };
  const payload: Record<string, unknown> = {
    type: "YOFASO-O2O",
    ...currentItem,
    vtonScore,
  };
  if (session.pairedItem) {
    const prev = session.pairedItem;
    const prevItem = {
      sessionId: prev.sessionId,
      productId: prev.productId,
      sku: prev.sku || prev.variantId,
      productName: prev.productName,
      colorName: prev.colorName || "",
      colorHex: primaryHexOf(prev.colorHex, "#CBD5E1"),
      size: prev.size || "",
      productImage: resolvedPairedImageUrl || "",
    };
    payload.sourceSessionId = prev.sessionId;
    payload.items = [prevItem, currentItem];
  }
  return JSON.stringify(payload);
}
export const isPending = (status: string) =>
  ["PENDING_SUBMIT", "QUEUED", "PROCESSING", "RECONCILING", "CHO_XU_LY", "DANG_RENDER_GPU"].includes(status);
export const isComplete = (status: string) => ["COMPLETED", "THANH_CONG"].includes(status);
export function statusLabel(status: string) {
  if (isComplete(status)) return "Đã hoàn tất";
  if (["PROCESSING", "DANG_RENDER_GPU"].includes(status)) return "Đang xử lý";
  if (isPending(status)) return "Đang chờ";
  return status === "CANCELLED" ? "Đã hủy" : "Cần kiểm tra";
}
