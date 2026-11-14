"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Edit3,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  ImagePlus,
  Keyboard,
  PauseCircle,
  Plus,
  RefreshCw,
  Save,
  ScanEye,
  Search,
  Sparkles,
  Upload,
  UserSquare2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Badge,
  Field,
  PageHeading,
  TablePagination,
  inputClass,
} from "@/components/admin/shared";
import {
  AiMaskInspectorDialog,
  type InspectorImageItem,
} from "@/components/admin/ai-mask-inspector-dialog";
import {
  ProductColorAreaCard,
  type AreaVariantRow,
  type ProductColorArea,
} from "@/components/admin/product-color-area-card";
import { api, ApiError, catalogImage, requestKey } from "@/lib/api";
import { pushToast } from "@/lib/feedback";

const toast = {
  success: (t: { title: string; detail?: string }) => pushToast({ tone: "success", ...t }),
  warning: (t: { title: string; detail?: string }) => pushToast({ tone: "warning", ...t }),
  error: (t: { title: string; detail?: string }) => pushToast({ tone: "error", ...t }),
  info: (t: { title: string; detail?: string }) => pushToast({ tone: "info", ...t }),
};
import {
  DEEPFASHION2_SUBTYPES,
  DEFAULT_SHELF_CODES,
  FALLBACK_CATEGORIES,
  FIT_OPTIONS,
  LENGTH_OPTIONS,
  MATERIAL_PRESETS,
  PATTERN_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  SAMPLE_INSPECTOR_ITEMS,
  VTON_CATEGORY_OPTIONS,
  WAIST_OPTIONS,
  buildProductStorageSlug,
  buildSku,
  buildYoFaSoDescriptionTemplate,
  detectCategoryGender,
  labelFor,
  pickDominantColor,
  type CategoryOption,
  type GarmentLength,
  type KMeansColor,
  type PatternType,
  type ProductFit,
  type ProductStatus,
  type VariantSize,
  type VariantStatus,
  type VtonCategory,
  type WaistType,
} from "@/lib/product-catalog-meta";
import { vnLabel } from "@/lib/vietnamese-labels";

const isValidServerAssetId = (id?: string | null): boolean =>
  Boolean(id && !id.startsWith("local-") && /^[a-f0-9-]{32,36}$/i.test(id));

interface AdminProductRow {
  productId: string;
  categoryId: string;
  name: string;
  material?: string;
  fit: ProductFit;
  waist: WaistType;
  length: GarmentLength;
  pattern: PatternType;
  vtonCategory: VtonCategory;
  subtype: string;
  status: ProductStatus;
  minPrice?: number | null;
  originalPrice?: number | null;
  coverUrl?: string | null;
  sku?: string;
  colorSwatches?: { hex: string; name: string }[];
  totalStock?: number;
  variantCount?: number;
}

interface AdminProductDetail extends AdminProductRow {
  description?: string;
  extractedPalette?: unknown;
  maskPath?: string | null;
  maskUrl?: string | null;
  gender?: "MALE" | "FEMALE";
  variants: {
    variantId: string;
    sku: string;
    size: VariantSize;
    colorName: string;
    colors: string;
    price: number;
    salePrice?: number | null;
    stock: number;
    shelf?: string | null;
    status: VariantStatus;
  }[];
  images: {
    imageId: string;
    originalAssetId: string;
    cutoutAssetId?: string | null;
    colors?: string | null;
    cover: number | boolean;
    position: number;
    role?: string;
    originalUrl?: string;
    cutoutUrl?: string | null;
    adminOriginalUrl?: string;
    adminCutoutUrl?: string | null;
  }[];
}

interface EditorFormState {
  productId: string | null;
  status: ProductStatus;
  name: string;
  categoryId: string;
  gender: "FEMALE" | "MALE";
  material: string;
  description: string;
  fit: ProductFit;
  waist: WaistType;
  length: GarmentLength;
  pattern: PatternType;
  vtonCategory: VtonCategory;
  subtype: string;
  maskUrl: string | null;
  maskPath: string | null;
  areas: ProductColorArea[];
  referenceImages: {
    assetId: string;
    url: string;
    name: string;
    imageId?: string;
    isCover?: boolean;
  }[];
  removedVariantIds: string[];
}

const OFFLINE_SAMPLE_PRODUCTS: AdminProductRow[] = [
  {
    productId: "SP00000003",
    categoryId: "DM000019",
    name: "ÁO XUÂN HÈ DÁNG CROPTOP",
    material: "Vải Tuytxi Cotton lạnh: 70% Polyester, 25% Cotton, 5% Spandex",
    fit: "SUONG_VUA",
    waist: "KHONG_AP_DUNG",
    length: "AO_CROPTOP",
    pattern: "VAI_TRON",
    vtonCategory: "upper_body",
    subtype: "short_sleeved_shirt",
    status: "DANG_KINH_DOANH",
    minPrice: 310000,
    originalPrice: 390000,
    coverUrl: "/assets/samples/croptop-img01-original.png",
    sku: "SKU-WAOXUAN-KEM-S-003",
    colorSwatches: [
      { hex: "#CAD8D4", name: "kem" },
      { hex: "#CABEB2", name: "be" },
    ],
  },
];

function emptyEditorForm(defaultCategoryId: string): EditorFormState {
  return {
    productId: null,
    status: "BAN_NHAP",
    name: "",
    categoryId: defaultCategoryId,
    gender: detectCategoryGender(defaultCategoryId),
    material: "",
    description: "",
    fit: "SUONG_VUA",
    waist: "KHONG_AP_DUNG",
    length: "AO_TIEU_CHUAN",
    pattern: "VAI_TRON",
    vtonCategory: "upper_body",
    subtype: "short_sleeved_shirt",
    maskUrl: null,
    maskPath: null,
    areas: [],
    referenceImages: [],
    removedVariantIds: [],
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const STANDARD_FASHION_COLORS: { name: string; hex: string; rgb: [number, number, number] }[] = [
  { name: "Đen", hex: "#1C1C1C", rgb: [28, 28, 28] },
  { name: "Trắng", hex: "#F4F1E8", rgb: [244, 241, 232] },
  { name: "Xám", hex: "#808080", rgb: [128, 128, 128] },
  { name: "Đỏ", hex: "#C62828", rgb: [198, 40, 40] },
  { name: "Đỏ đô", hex: "#7F1D1D", rgb: [127, 29, 29] },
  { name: "Cam", hex: "#E97820", rgb: [233, 120, 32] },
  { name: "Vàng", hex: "#E5C229", rgb: [229, 194, 41] },
  { name: "Be", hex: "#D8C3A5", rgb: [216, 195, 165] },
  { name: "Nâu", hex: "#70452E", rgb: [112, 69, 46] },
  { name: "Xanh lá", hex: "#3D7A43", rgb: [61, 122, 67] },
  { name: "Xanh olive", hex: "#7A7D42", rgb: [122, 125, 66] },
  { name: "Xanh mint", hex: "#8EC9B3", rgb: [142, 201, 179] },
  { name: "Xanh dương", hex: "#295AA8", rgb: [41, 90, 168] },
  { name: "Xanh navy", hex: "#1D2E55", rgb: [29, 46, 85] },
  { name: "Xanh cyan", hex: "#2B9EB3", rgb: [43, 158, 179] },
  { name: "Tím", hex: "#75499B", rgb: [117, 73, 155] },
  { name: "Hồng", hex: "#D96C9D", rgb: [217, 108, 157] },
  { name: "Kem", hex: "#EEE0BD", rgb: [238, 224, 189] },
];

function inferVietnameseColorName(r: number, g: number, b: number): string {
  let closest = STANDARD_FASHION_COLORS[0];
  let minDistance = Infinity;
  for (const c of STANDARD_FASHION_COLORS) {
    const rmean = (r + c.rgb[0]) / 2;
    const dr = r - c.rgb[0];
    const dg = g - c.rgb[1];
    const db = b - c.rgb[2];
    const dist = Math.sqrt(
      (((512 + rmean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rmean) * db * db) >> 8)
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }
  return closest.name;
}

/** Lấy nhanh tối đa 3 màu chủ đạo bằng canvas offscreen loại bỏ nền khi tải ảnh. */
async function extractQuickPaletteFromFile(file: File): Promise<KMeansColor[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve([{ name: "Mặc định", hex: "#1F2937", share: 1 }]);
          return;
        }
        ctx.drawImage(img, 0, 0, 64, 64);
        const { data } = ctx.getImageData(0, 0, 64, 64);

        // Phát hiện màu nền từ viền ngoài của ảnh
        let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
        for (let x = 0; x < 64; x++) {
          for (const y of [0, 63]) {
            const idx = (y * 64 + x) * 4;
            if (data[idx + 3] >= 128) {
              bgR += data[idx];
              bgG += data[idx + 1];
              bgB += data[idx + 2];
              bgCount++;
            }
          }
        }
        const avgBgR = bgCount ? bgR / bgCount : 255;
        const avgBgG = bgCount ? bgG / bgCount : 255;
        const avgBgB = bgCount ? bgB / bgCount : 255;

        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Khoảng cách tới màu nền để lọc bỏ nền phẳng
          const bgDist = Math.hypot(r - avgBgR, g - avgBgG, b - avgBgB);
          if (bgDist < 30) continue;

          // Bỏ qua pixel cực sáng hoặc cực tối sát mép
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 15 || lum > 250) continue;

          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr}-${qg}-${qb}`;
          const prev = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
          prev.r += r;
          prev.g += g;
          prev.b += b;
          prev.count += 1;
          buckets.set(key, prev);
          total += 1;
        }

        if (total === 0) {
          const fallbackName = inferVietnameseColorName(avgBgR, avgBgG, avgBgB);
          resolve([{ name: fallbackName, hex: rgbToHex(avgBgR, avgBgG, avgBgB), share: 1 }]);
          return;
        }

        const top = Array.from(buckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        const topSum = top.reduce((s, t) => s + t.count, 0) || 1;
        resolve(
          top.map((t) => {
            const ar = t.r / t.count;
            const ag = t.g / t.count;
            const ab = t.b / t.count;
            return {
              name: inferVietnameseColorName(ar, ag, ab),
              hex: rgbToHex(ar, ag, ab),
              share: Number((t.count / topSum).toFixed(3)),
            };
          })
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([{ name: "Mặc định", hex: "#1F2937", share: 1 }]);
    };
    img.src = url;
  });
}

function parseExtractedPalette(raw: unknown): KMeansColor[][] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (Array.isArray(entry)) {
        return entry.map((c) => ({
          name: String(c?.name ?? "Màu"),
          hex: String(c?.hex ?? "#1F2937"),
          share: Number(c?.share ?? 1),
        }));
      }
      if (entry && typeof entry === "object" && Array.isArray((entry as { colors?: unknown }).colors)) {
        return ((entry as { colors: string[] }).colors || []).map((hex, i, arr) => ({
          name: "Màu",
          hex: String(hex),
          share: Number((1 / (arr.length || 1)).toFixed(2)),
        }));
      }
      return [];
    });
  } catch {
    return [];
  }
}

function extractReferencesFromDetail(detail: AdminProductDetail): EditorFormState["referenceImages"] {
  const refs = (detail.images ?? [])
    .filter((img) => {
      const asset = (img.originalAssetId || "").toLowerCase();
      const url = (img.originalUrl || "").toLowerCase();
      const adminUrl = (img.adminOriginalUrl || "").toLowerCase();
      const role = ((img as unknown as { role?: string }).role || "").toLowerCase();
      return role === "reference" || asset.includes("--ref") || url.includes("--ref") || adminUrl.includes("--ref");
    })
    .map((img, idx) => {
      const originalPath = img.adminOriginalUrl || img.originalUrl || img.originalAssetId || "";
      const fileName = (img.originalAssetId || originalPath).split("/").pop() || `ref-${idx + 1}.png`;
      const isRef01 = fileName.toLowerCase().includes("--ref01");
      return {
        assetId: img.originalAssetId,
        url: originalPath ? catalogImage(originalPath) : "/assets/samples/croptop-ref01.png",
        name: fileName,
        imageId: img.imageId,
        isCover: Boolean(img.cover) || isRef01 || idx === 0,
      };
    });

  refs.sort((a, b) => {
    if (a.name.toLowerCase().includes("--ref01")) return -1;
    if (b.name.toLowerCase().includes("--ref01")) return 1;
    if (a.isCover) return -1;
    if (b.isCover) return 1;
    return 0;
  });
  if (refs.length > 0 && !refs.some((r) => r.isCover)) {
    refs[0].isCover = true;
  }
  return refs;
}

function buildAreasFromDetail(detail: AdminProductDetail): ProductColorArea[] {
  const palettes = parseExtractedPalette(detail.extractedPalette);
  const byColors = new Map<string, AdminProductDetail["variants"]>();
  for (const v of detail.variants ?? []) {
    const key = (v.colors || "").toUpperCase();
    const list = byColors.get(key) ?? [];
    list.push(v);
    byColors.set(key, list);
  }

  // Tách riêng ảnh trang phục (loại bỏ tuyệt đối ảnh người mẫu --ref)
  const garmentImages = (detail.images ?? []).filter((img) => {
    const asset = (img.originalAssetId || "").toLowerCase();
    const url = (img.originalUrl || "").toLowerCase();
    const adminUrl = (img.adminOriginalUrl || "").toLowerCase();
    const role = ((img as unknown as { role?: string }).role || "").toLowerCase();
    return !(role === "reference" || asset.includes("--ref") || url.includes("--ref") || adminUrl.includes("--ref"));
  });

  const areas: ProductColorArea[] = garmentImages.map((img, idx) => {
    const colorCsv = (img.colors || "").toUpperCase();
    const matchedVariants = byColors.get(colorCsv) ?? [];
    if (matchedVariants.length) byColors.delete(colorCsv);
    const firstVariant = matchedVariants[0];
    const rawPalette = palettes[idx] ?? [];
    const hexTokens = (img.colors || firstVariant?.colors || "#1F2937")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const palette: KMeansColor[] =
      rawPalette.length > 0
        ? rawPalette
        : hexTokens.map((hex) => ({
            name: firstVariant?.colorName || `Màu ${idx + 1}`,
            hex,
            share: Number((1 / hexTokens.length).toFixed(2)),
          }));
    const dominant = pickDominantColor(palette);
    const originalPath = img.adminOriginalUrl || img.originalUrl || "";
    const cutoutPath = img.adminCutoutUrl || img.cutoutUrl || null;
    return {
      areaId: img.imageId || `area-${idx}`,
      imageId: img.imageId,
      assetId: img.originalAssetId,
      cutoutAssetId: img.cutoutAssetId ?? null,
      originalUrl: originalPath ? catalogImage(originalPath) : "/assets/samples/croptop-img01-original.png",
      cutoutUrl: cutoutPath ? catalogImage(cutoutPath) : null,
      colorName: firstVariant?.colorName || dominant.name || `Màu ${idx + 1}`,
      dominantHex: dominant.hex,
      palette,
      cover: false, // Ảnh trang phục không làm ảnh bìa khi đã có ảnh người mẫu
      variants: matchedVariants.map<AreaVariantRow>((v) => ({
        variantId: v.variantId,
        size: v.size,
        sku: v.sku,
        price: String(v.price ?? 0),
        salePrice: v.salePrice != null ? String(v.salePrice) : "",
        stock: String(v.stock ?? 0),
        shelf: v.shelf ?? "",
        status: v.status ?? "DANG_BAN",
      })),
    };
  });

  // Nếu có biến thể chưa khớp ảnh nào thì gom vào area bổ sung để không bị sót dữ liệu
  let extraIdx = 0;
  for (const [colorCsv, orphaned] of byColors.entries()) {
    const first = orphaned[0];
    const hex = (colorCsv.split(",")[0] || "#1F2937").trim();
    areas.push({
      areaId: `orphan-${extraIdx++}`,
      assetId: "/assets/samples/croptop-img01-original.png",
      originalUrl: "/assets/samples/croptop-img01-original.png",
      colorName: first.colorName,
      dominantHex: hex,
      palette: [{ name: first.colorName, hex, share: 1 }],
      cover: areas.length === 0,
      variants: orphaned.map((v) => ({
        variantId: v.variantId,
        size: v.size,
        sku: v.sku,
        price: String(v.price ?? 0),
        salePrice: v.salePrice != null ? String(v.salePrice) : "",
        stock: String(v.stock ?? 0),
        shelf: v.shelf ?? "",
        status: v.status ?? "DANG_BAN",
      })),
    });
  }

  return areas;
}

const statusTone = (status: string) => {
  switch (status) {
    case "DANG_KINH_DOANH":
      return "success";
    case "DANG_XU_LY_AI":
      return "info";
    case "BAN_NHAP":
      return "warning";
    case "TAM_NGUNG":
    default:
      return "neutral";
  }
};

export function ProductCrudStudio({
  isActive = true,
  onAuditLog,
}: {
  isActive?: boolean;
  onAuditLog: (action: string, reason: string) => void;
}) {
  const [view, setView] = useState<"list" | "editor">("list");
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>(FALLBACK_CATEGORIES);
  const [shelves, setShelves] = useState<string[]>(DEFAULT_SHELF_CODES);
  const [loadingList, setLoadingList] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);

  // Bộ lọc danh sách
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [vtonFilter, setVtonFilter] = useState<string>("");
  const [parentCategoryFilter, setParentCategoryFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Form tạo/sửa sản phẩm
  const [form, setForm] = useState<EditorFormState>(() =>
    emptyEditorForm(FALLBACK_CATEGORIES[6]?.value ?? "DM000019")
  );
  const [editorParentCategory, setEditorParentCategory] = useState<string>("DM000001");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<AdminProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [autoTriggerAi, setAutoTriggerAi] = useState(true);
  const [archiveTarget, setArchiveTarget] = useState<AdminProductRow | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("DM000005");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Inspector Popup (Ctrl + M)
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorProductId, setInspectorProductId] = useState<string | null>(null);
  const [inspectorProductName, setInspectorProductName] = useState("");
  const [inspectorVton, setInspectorVton] = useState<VtonCategory>("upper_body");
  const [inspectorSubtype, setInspectorSubtype] = useState<string>("short_sleeved_shirt");
  const [inspectorItems, setInspectorItems] = useState<InspectorImageItem[]>([]);
  const [inspectorRefUrl, setInspectorRefUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  const garmentInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const fetchCatalogPayload = useCallback(async () => {
    const [prodRes, filterRes, catRes] = await Promise.all([
      api<AdminProductRow[]>("/admin/products?page=0&size=100"),
      api<{
        categories?: CategoryOption[];
        shelves?: { value: string; label: string }[];
      }>("/staff/product-filters"),
      api<CategoryOption[]>("/catalog/categories").catch(() => []),
    ]);
    const loadedCats =
      filterRes?.categories?.length ? filterRes.categories : catRes.length ? catRes : FALLBACK_CATEGORIES;
    const mergedShelves = Array.from(
      new Set([
        ...DEFAULT_SHELF_CODES,
        ...(filterRes?.shelves ?? []).map((s) => s.value).filter(Boolean),
      ])
    );
    return {
      items: Array.isArray(prodRes) ? prodRes : [],
      categories: loadedCats,
      shelves: mergedShelves,
    };
  }, []);

  const loadCatalogData = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await fetchCatalogPayload();
      setProducts(data.items);
      setCategories(data.categories);
      setShelves(data.shelves);
      setBackendOffline(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 401)) {
        setBackendOffline(true);
        setProducts((prev) => (prev.length ? prev : OFFLINE_SAMPLE_PRODUCTS));
      } else {
        toast.error({
          title: "Không tải được danh sách sản phẩm",
          detail: err instanceof Error ? err.message : "Vui lòng thử lại.",
        });
      }
    } finally {
      setLoadingList(false);
    }
  }, [fetchCatalogPayload]);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogPayload()
      .then((data) => {
        if (cancelled) return;
        setProducts(data.items);
        setCategories(data.categories);
        setShelves(data.shelves);
        setBackendOffline(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 401)) {
          setBackendOffline(true);
          setProducts((prev) => (prev.length ? prev : OFFLINE_SAMPLE_PRODUCTS));
        } else {
          toast.error({
            title: "Không tải được danh sách sản phẩm",
            detail: err instanceof Error ? err.message : "Vui lòng thử lại.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCatalogPayload]);

  const isCategoryDescendantOf = useCallback(
    (catId: string, ancestorId: string): boolean => {
      if (!catId || !ancestorId) return false;
      if (catId === ancestorId) return true;
      let current = categories.find((c) => c.value === catId);
      let depth = 0;
      while (current && current.parentId && depth < 10) {
        if (current.parentId === ancestorId) return true;
        current = categories.find((c) => c.value === current?.parentId);
        depth++;
      }
      return false;
    },
    [categories]
  );

  // Danh mục cha cấp cao nhất (parentId = null hoặc rỗng)
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );

  // Nhóm danh mục con theo danh mục cha đã chọn
  const groupedChildCategories = useMemo(() => {
    if (!parentCategoryFilter) return [];
    // Các nhánh cấp 2 trực tiếp thuộc danh mục cha (VD: Áo nam, Quần nam...)
    const directChildren = categories.filter((c) => c.parentId === parentCategoryFilter);
    return directChildren.map((parent) => ({
      category: parent,
      // Các danh mục cấp 3 thuộc nhánh cấp 2 này (VD: Áo polo nam, Quần short nam...)
      children: categories.filter((c) => c.parentId === parent.value),
    }));
  }, [categories, parentCategoryFilter]);

  // Lọc danh sách client-side sau khi tải từ Backend để tìm tức thời theo Tên / Mã SP / SKU
  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (vtonFilter && p.vtonCategory !== vtonFilter) return false;
      if (categoryFilter) {
        if (p.categoryId !== categoryFilter && !isCategoryDescendantOf(p.categoryId, categoryFilter)) {
          return false;
        }
      } else if (parentCategoryFilter) {
        if (!isCategoryDescendantOf(p.categoryId, parentCategoryFilter)) {
          return false;
        }
      }
      if (q) {
        const hay = `${p.productId} ${p.name} ${p.sku ?? ""} ${p.material ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, searchText, statusFilter, vtonFilter, parentCategoryFilter, categoryFilter, isCategoryDescendantOf]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = useMemo(
    () => filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredProducts, safePage]
  );

  const runGarmentSegmentation = useCallback(
    async (
      areaId: string,
      garmentAssetId: string,
      refAssetId?: string,
      vtonCat?: VtonCategory,
      sub?: string
    ) => {
      setAnalyzing(true);
      setAnalysisMessage("Đang bóc tách nền YOLOv8s-seg + SAM 2 trên GPU...");
      try {
        const res = await api<{
          cutoutAssetId?: string;
          cutoutUrl?: string;
          maskAssetId?: string;
          maskUrl?: string;
          predictedVton?: VtonCategory;
          predictedSubtype?: string;
          confidence?: string;
          bodyPositionNote?: string;
        }>("/admin/ai/segment-garment", "POST", {
          garmentAssetId,
          referenceAssetId: isValidServerAssetId(refAssetId) ? refAssetId : null,
          vtonCategory: vtonCat || form.vtonCategory,
          subtype: sub || form.subtype,
        });

        if (res && res.cutoutUrl) {
          const liveCutoutUrl = catalogImage(res.cutoutUrl);
          const liveMaskUrl = res.maskUrl ? catalogImage(res.maskUrl) : null;
          setForm((prev) => ({
            ...prev,
            vtonCategory: res.predictedVton || prev.vtonCategory,
            subtype: res.predictedSubtype || prev.subtype,
            maskUrl: liveMaskUrl || prev.maskUrl,
            maskPath: res.maskAssetId || prev.maskPath,
            areas: prev.areas.map((a) =>
              a.areaId === areaId || a.assetId === garmentAssetId
                ? {
                    ...a,
                    cutoutAssetId: res.cutoutAssetId || a.cutoutAssetId,
                    cutoutUrl: liveCutoutUrl || a.cutoutUrl,
                  }
                : a
            ),
          }));

          setInspectorItems((prev) =>
            prev.map((item) =>
              item.id === areaId
                ? {
                    ...item,
                    cutoutUrl: liveCutoutUrl || item.cutoutUrl,
                    maskUrl: liveMaskUrl || item.maskUrl,
                    r2CutoutKey: res.cutoutAssetId ? `media/assets/${res.cutoutAssetId}.png` : item.r2CutoutKey,
                    r2MaskKey: res.maskAssetId ? `media/assets/${res.maskAssetId}.png` : item.r2MaskKey,
                    predictedVton: res.predictedVton || item.predictedVton,
                    predictedSubtype: res.predictedSubtype || item.predictedSubtype,
                    confidence: res.confidence || item.confidence,
                    bodyPositionNote: res.bodyPositionNote || item.bodyPositionNote,
                    isSampleFallback: false,
                  }
                : item
            )
          );
          setAnalysisMessage(null);
        } else {
          setAnalysisMessage("AI Service chưa trả về kết quả bóc tách. Nhấn 'Chạy lại AI bóc tách' để thử lại.");
        }
      } catch (err) {
        console.warn("Background AI segmentation skipped/failed:", err);
        setAnalysisMessage("Bóc tách GPU gặp sự cố mạng hoặc thời gian chờ. Vui lòng bấm 'Chạy lại AI bóc tách'.");
      } finally {
        setAnalyzing(false);
      }
    },
    [form.vtonCategory, form.subtype]
  );

  const openInspectorForEditor = useCallback(() => {
    const coverRef =
      form.referenceImages.find((r) => r.isCover || r.name.toLowerCase().includes("--ref01")) ||
      form.referenceImages[0];
    const items: InspectorImageItem[] = form.areas.map((a, idx) => ({
      id: a.areaId,
      label: `Ảnh ${String(idx + 1).padStart(2, "0")} · ${a.colorName}`,
      colorName: a.colorName,
      dominantHex: a.dominantHex,
      palette: a.palette,
      originalUrl: a.originalUrl,
      cutoutUrl: a.cutoutUrl ? catalogImage(a.cutoutUrl) : null,
      maskUrl: form.maskUrl ? catalogImage(form.maskUrl) : null,
      r2CutoutKey: a.cutoutAssetId ? `media/assets/${a.cutoutAssetId}.png` : null,
      r2MaskKey: form.maskPath ? `media/assets/${form.maskPath}.png` : null,
      predictedVton: form.vtonCategory,
      predictedSubtype: form.subtype,
    }));
    setInspectorProductId(form.productId);
    setInspectorProductName(form.name || "Sản phẩm đang soạn");
    setInspectorVton(form.vtonCategory);
    setInspectorSubtype(form.subtype);
    setInspectorItems(items);
    setInspectorRefUrl(coverRef?.url ?? "/assets/samples/croptop-ref01.png");
    setAnalysisMessage(null);
    setInspectorOpen(true);

    // Tự động kích hoạt bóc tách nền GPU nếu có ảnh chưa chạy
    const unsegmented = form.areas.find((a) => !a.cutoutUrl && isValidServerAssetId(a.assetId));
    if (unsegmented) {
      void runGarmentSegmentation(
        unsegmented.areaId,
        unsegmented.assetId,
        coverRef?.assetId,
        form.vtonCategory,
        form.subtype
      );
    }
  }, [form, runGarmentSegmentation]);

  const openInspectorForProductRow = useCallback(async (row: AdminProductRow) => {
    setInspectorProductId(row.productId);
    setInspectorProductName(row.name);
    setInspectorVton(row.vtonCategory);
    setInspectorSubtype(row.subtype);
    setAnalysisMessage(null);

    try {
      const detail = await api<AdminProductDetail>(`/admin/products/${encodeURIComponent(row.productId)}`);
      const areas = buildAreasFromDetail(detail);
      setInspectorItems(
        areas.map((a, idx) => ({
          id: a.areaId,
          label: `Ảnh ${String(idx + 1).padStart(2, "0")} · ${a.colorName}`,
          colorName: a.colorName,
          dominantHex: a.dominantHex,
          palette: a.palette,
          originalUrl: a.originalUrl,
          cutoutUrl: a.cutoutUrl,
          maskUrl: detail.maskUrl ? catalogImage(detail.maskUrl) : null,
          r2MaskKey: detail.maskPath ?? null,
          predictedVton: detail.vtonCategory,
          predictedSubtype: detail.subtype,
        }))
      );
      setInspectorRefUrl(null);
    } catch {
      setInspectorItems(SAMPLE_INSPECTOR_ITEMS.map((s) => ({ ...s, isSampleFallback: true })));
      setInspectorRefUrl("/assets/samples/croptop-ref01.png");
    }
    setInspectorOpen(true);
  }, []);

  // Phím tắt Ctrl + M mở Popup xem kết quả bóc tách nền & Agnostic Mask
  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (view === "editor") {
          openInspectorForEditor();
        } else if (products[0]) {
          void openInspectorForProductRow(products[0]);
        } else {
          setInspectorItems(SAMPLE_INSPECTOR_ITEMS.map((s) => ({ ...s, isSampleFallback: true })));
          setInspectorOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, view, products, openInspectorForEditor, openInspectorForProductRow]);

  const getRootCategoryId = useCallback(
    (catId: string): string => {
      let current = categories.find((c) => c.value === catId);
      while (current && current.parentId) {
        const p = categories.find((c) => c.value === current!.parentId);
        if (!p) break;
        current = p;
      }
      return current?.value || (detectCategoryGender(catId) === "MALE" ? "DM000001" : "DM000002");
    },
    [categories]
  );

  const openProductDetail = async (row: AdminProductRow) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const data = await api<AdminProductDetail>(`/admin/products/${encodeURIComponent(row.productId)}`);
      setDetailProduct(data);
      setActiveDetailImageIndex(0);
    } catch {
      setDetailProduct({
        ...row,
        gender: detectCategoryGender(row.categoryId),
        description: "",
        material: row.material ?? "",
        fit: row.fit,
        waist: row.waist,
        length: row.length,
        pattern: row.pattern,
        vtonCategory: row.vtonCategory,
        subtype: row.subtype,
        images: [],
        variants: [],
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const startCreate = () => {
    const parentId = parentCategories[0]?.value || "DM000001";
    setEditorParentCategory(parentId);
    const firstLeaf = categories.find(
      (c) => isCategoryDescendantOf(c.value, parentId) && !categories.some((k) => k.parentId === c.value)
    );
    const leafCategory = firstLeaf?.value || "DM000019";
    setForm(emptyEditorForm(leafCategory));
    setView("editor");
  };

  const startEdit = async (row: AdminProductRow) => {
    try {
      const detail = await api<AdminProductDetail>(`/admin/products/${encodeURIComponent(row.productId)}`);
      const rootCat = getRootCategoryId(detail.categoryId || row.categoryId);
      setEditorParentCategory(rootCat);

      const subOption = DEEPFASHION2_SUBTYPES.find(
        (s) => s.value === (detail.subtype || row.subtype || (detail as unknown as { tieuLoaiTrangPhuc?: string }).tieuLoaiTrangPhuc)
      );
      const rawVton = String(
        detail.vtonCategory ||
        row.vtonCategory ||
        subOption?.vtonCategory ||
        (detail as unknown as { phanLoaiVTON?: string }).phanLoaiVTON ||
        "upper_body"
      ).toLowerCase().trim();

      const resolvedVton: VtonCategory =
        rawVton === "lower_body" || rawVton === "dress" ? rawVton : "upper_body";

      const resolvedSubtype =
        String(
          detail.subtype ||
          row.subtype ||
          (detail as unknown as { tieuLoaiTrangPhuc?: string }).tieuLoaiTrangPhuc ||
          DEEPFASHION2_SUBTYPES.find((s) => s.vtonCategory === resolvedVton)?.value ||
          "short_sleeved_shirt"
        ).trim();

      setForm({
        productId: detail.productId || row.productId,
        status: detail.status || row.status,
        name: detail.name || row.name,
        categoryId: detail.categoryId || row.categoryId,
        gender: detectCategoryGender(detail.categoryId || row.categoryId),
        material: detail.material ?? row.material ?? "",
        description: detail.description ?? "",
        fit: detail.fit || row.fit || "OM_SAT",
        waist: detail.waist || row.waist || "KHONG_AP_DUNG",
        length: detail.length || row.length || "AO_TIEU_CHUAN",
        pattern: detail.pattern || row.pattern || "VAI_TRON",
        vtonCategory: resolvedVton,
        subtype: resolvedSubtype,
        maskUrl: detail.maskUrl ?? null,
        maskPath: detail.maskPath ?? null,
        areas: buildAreasFromDetail(detail),
        referenceImages: extractReferencesFromDetail(detail),
        removedVariantIds: [],
      });
      setInspectorVton(resolvedVton);
      setInspectorSubtype(resolvedSubtype);
      setView("editor");
    } catch (err) {
      console.warn("Could not load product detail, falling back to row info:", err);
      const rootCat = getRootCategoryId(row.categoryId);
      setEditorParentCategory(rootCat);
      const subOption = DEEPFASHION2_SUBTYPES.find((s) => s.value === row.subtype);
      const rawVton = String(row.vtonCategory || subOption?.vtonCategory || "upper_body").toLowerCase().trim();
      const resolvedVton: VtonCategory =
        rawVton === "lower_body" || rawVton === "dress" ? rawVton : "upper_body";
      const resolvedSubtype = String(
        row.subtype || DEEPFASHION2_SUBTYPES.find((s) => s.vtonCategory === resolvedVton)?.value || "short_sleeved_shirt"
      ).trim();

      setForm({
        ...emptyEditorForm(row.categoryId),
        productId: row.productId,
        status: row.status,
        name: row.name,
        categoryId: row.categoryId,
        gender: detectCategoryGender(row.categoryId),
        material: row.material ?? "",
        fit: row.fit || "OM_SAT",
        waist: row.waist || "KHONG_AP_DUNG",
        length: row.length || "AO_TIEU_CHUAN",
        pattern: row.pattern || "VAI_TRON",
        vtonCategory: resolvedVton,
        subtype: resolvedSubtype,
        areas: [],
        referenceImages: [],
        removedVariantIds: [],
      });
      setInspectorVton(resolvedVton);
      setInspectorSubtype(resolvedSubtype);
      setView("editor");
    }
  };

  const handleGarmentFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    if (!valid.length) {
      toast.warning({ title: "Định dạng ảnh chưa hợp lệ", detail: "Chỉ hỗ trợ JPG hoặc PNG." });
      return;
    }

    const createdAreas: ProductColorArea[] = [];
    let detectedVtonCategory: VtonCategory | undefined;
    let detectedSubtype: string | undefined;

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const previewUrl = URL.createObjectURL(file);
      createdUrlsRef.current.push(previewUrl);
      const localPalette = await extractQuickPaletteFromFile(file);
      let palette = localPalette;
      let dominant = pickDominantColor(palette);

      let assetId = `local-${Date.now()}-${i}`;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("role", "garment");
        fd.append("consent", "true");
        const uploaded = await api<{
          assetId: string;
          colorName?: string;
          dominantHex?: string;
          palette?: { name: string; hex: string; share: number }[];
          vtonCategory?: VtonCategory;
          subtype?: string;
        }>("/assets", "POST", fd);
        assetId = uploaded.assetId;

        // Ưu tiên kết quả nhận diện màu sắc từ model AI Vision
        if (uploaded.colorName && uploaded.dominantHex) {
          dominant = { name: uploaded.colorName, hex: uploaded.dominantHex, share: 1 };
          if (uploaded.palette?.length) {
            palette = uploaded.palette.map((p) => ({
              name: p.name,
              hex: p.hex,
              share: p.share,
            }));
          }
        }
        if (uploaded.vtonCategory && !detectedVtonCategory) {
          detectedVtonCategory = uploaded.vtonCategory;
        }
        if (uploaded.subtype && !detectedSubtype) {
          detectedSubtype = uploaded.subtype;
        }
      } catch (err) {
        if (!(err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 401))) {
          toast.warning({
            title: `Tải ảnh ${file.name} lên server thất bại`,
            detail: err instanceof Error ? err.message : "Đang giữ ảnh xem trước cục bộ.",
          });
        }
      }

      createdAreas.push({
        areaId: `area-${Date.now()}-${i}`,
        assetId,
        originalUrl: previewUrl,
        colorName: dominant.name,
        dominantHex: dominant.hex,
        palette,
        cover: false, // Ảnh trang phục không làm ảnh bìa
        variants: [
          {
            size: "M",
            sku: buildSku(form.name || "SANPHAM", dominant.name, "M", form.areas.length + i + 1),
            price: "350000",
            salePrice: "",
            stock: "20",
            shelf: shelves[0] || "KE-F01",
            status: "DANG_BAN",
          },
        ],
      });
    }

    const finalVton = detectedVtonCategory || form.vtonCategory;
    const finalSub = detectedSubtype || form.subtype;

    setForm((prev) => ({
      ...prev,
      areas: [...prev.areas, ...createdAreas],
      vtonCategory: detectedVtonCategory || prev.vtonCategory,
      subtype: detectedSubtype || prev.subtype,
    }));

    const colorSummary = createdAreas.map((a) => a.colorName).join(", ");
    toast.success({
      title: `AI đã nhận diện màu: ${colorSummary}`,
      detail: `Đang chạy ngầm bóc tách nền YOLOv8s-seg + SAM 2 trên GPU...`,
    });

    // Kích hoạt ngầm phân tích & bóc tách nền realtime từ GPU
    const coverRefAssetId = form.referenceImages[0]?.assetId;
    for (const ca of createdAreas) {
      if (isValidServerAssetId(ca.assetId)) {
        void runGarmentSegmentation(ca.areaId, ca.assetId, coverRefAssetId, finalVton, finalSub);
      }
    }
  };

  const handleRedetectAreaColor = async (areaId: string, assetId: string) => {
    try {
      const result = await api<{
        dominantColor?: { name: string; hex: string; share?: number };
        palette?: { name: string; hex: string; share: number }[];
        vtonCategory?: VtonCategory;
        subtype?: string;
      }>(`/assets/${encodeURIComponent(assetId)}/detect-color`, "POST");

      if (result.dominantColor) {
        const nextPalette: KMeansColor[] = (result.palette || [result.dominantColor]).map((p) => ({
          name: p.name,
          hex: p.hex,
          share: p.share ?? 1,
        }));
        setForm((prev) => ({
          ...prev,
          vtonCategory: result.vtonCategory || prev.vtonCategory,
          subtype: result.subtype || prev.subtype,
          areas: prev.areas.map((a) => {
            if (a.areaId !== areaId) return a;
            return {
              ...a,
              colorName: result.dominantColor!.name,
              dominantHex: result.dominantColor!.hex,
              palette: nextPalette,
              variants: a.variants.map((v, vIdx) => ({
                ...v,
                sku: buildSku(prev.name || "SANPHAM", result.dominantColor!.name, v.size, vIdx + 1),
              })),
            };
          }),
        }));
        toast.success({
          title: `AI đã nhận diện lại màu: ${result.dominantColor.name}`,
          detail: `Mã màu HEX: ${result.dominantColor.hex}`,
        });
      }
    } catch (err) {
      toast.warning({
        title: "Không thể nhận diện lại màu bằng AI",
        detail: err instanceof Error ? err.message : "Vui lòng thử lại sau.",
      });
    }
  };

  const handleReferenceFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked: EditorFormState["referenceImages"] = [];
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      createdUrlsRef.current.push(url);
      let assetId = `ref-${Date.now()}`;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("role", "reference");
        fd.append("consent", "true");
        const uploaded = await api<{ assetId: string }>("/assets", "POST", fd);
        assetId = uploaded.assetId;
      } catch {
        // Fallback giữ thumbnail cục bộ nếu Backend/session chưa kết nối
      }
      const isRef01 = file.name.toLowerCase().includes("--ref01");
      picked.push({ assetId, url, name: file.name, isCover: isRef01 });
    }
    setForm((prev) => {
      const combined = [...prev.referenceImages, ...picked];
      const hasRef01 = combined.some((r) => r.name.toLowerCase().includes("--ref01"));
      const updated = combined.map((r, idx) => ({
        ...r,
        isCover: hasRef01 ? r.name.toLowerCase().includes("--ref01") : idx === 0,
      }));
      updated.sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));
      return {
        ...prev,
        referenceImages: updated,
      };
    });
  };

  const validateEditorForm = (publish: boolean): string | null => {
    if (!form.name.trim()) return "Vui lòng nhập tên sản phẩm.";
    if (!form.categoryId) return "Vui lòng chọn danh mục sản phẩm.";
    if (form.areas.length === 0) return "Cần tải ít nhất 1 ảnh sản phẩm (tương ứng 1 nhóm màu).";
    const totalVariants = form.areas.reduce((s, a) => s + a.variants.length, 0);
    if (publish && totalVariants === 0) {
      return "Cần chọn ít nhất 1 size biến thể trước khi công bố sản phẩm.";
    }
    const seenSkus = new Set<string>();
    for (const area of form.areas) {
      if (!area.colorName.trim()) return "Mỗi area ảnh cần có tên màu sắc.";
      for (const v of area.variants) {
        if (!v.sku.trim()) return `Size ${v.size} (${area.colorName}) đang thiếu mã SKU.`;
        const skuUpper = v.sku.trim().toUpperCase();
        if (seenSkus.has(skuUpper)) return `Mã SKU "${v.sku}" bị trùng lặp.`;
        seenSkus.add(skuUpper);
        const price = Number(v.price);
        const stock = Number(v.stock);
        if (!Number.isFinite(price) || price <= 0)
          return `Giá niêm yết của ${area.colorName} · ${v.size} phải lớn hơn 0.`;
        if (!Number.isInteger(stock) || stock < 0)
          return `Số lượng tồn của ${area.colorName} · ${v.size} phải là số nguyên >= 0.`;
        if (v.salePrice.trim() !== "") {
          const sale = Number(v.salePrice);
          if (!Number.isFinite(sale) || sale < 0 || sale > price)
            return `Giá khuyến mãi của ${area.colorName} · ${v.size} không hợp lệ.`;
        }
      }
    }
    return null;
  };

  const triggerAiAnalysis = async (productId: string, garmentIds: string[], refIds: string[]) => {
    const validGarments = garmentIds.filter(isValidServerAssetId);
    if (!validGarments.length) return null;
    const validRefs = refIds.filter(isValidServerAssetId);
    return api<{ operationId: string; status: string }>(
      `/admin/products/${encodeURIComponent(productId)}/analysis`,
      "POST",
      { productAssetIds: validGarments, referenceAssetIds: validRefs },
      requestKey()
    );
  };

  const handleSaveProduct = async (publishNow: boolean) => {
    const errMsg = validateEditorForm(publishNow);
    if (errMsg) {
      toast.warning({ title: "Thông tin chưa hợp lệ", detail: errMsg });
      return;
    }

    setSaving(true);
    try {
      const extractedPaletteJson = JSON.stringify(form.areas.map((a) => a.palette));
      const materialCombined = form.material.trim();
      const extraNotes = form.areas
        .filter((a) => a.materialNote?.trim())
        .map((a) => `[Màu ${a.colorName}]: ${a.materialNote?.trim()}`)
        .join("\n");
      const finalDescription = extraNotes
        ? `${form.description.trim()}\n\n${extraNotes}`.trim()
        : form.description.trim();

      const productPayload = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        description: finalDescription,
        material: materialCombined,
        fit: form.fit,
        waist: form.waist,
        length: form.length,
        pattern: form.pattern,
        vtonCategory: form.vtonCategory,
        subtype: form.subtype,
        extractedPalette: extractedPaletteJson,
        status: publishNow ? "DANG_KINH_DOANH" : "BAN_NHAP",
      };

      // 1. Tạo hoặc cập nhật SanPham
      const savedProduct = form.productId
        ? await api<AdminProductDetail>(
            `/admin/products/${encodeURIComponent(form.productId)}`,
            "PUT",
            productPayload
          )
        : await api<AdminProductDetail>("/admin/products", "POST", productPayload);

      const pid = savedProduct.productId;
      const prodNum = parseInt(pid.replace(/\D/g, ""), 10) || 1;
      const prodNumStr = prodNum >= 100 ? String(prodNum) : String(prodNum).padStart(3, "0");

      // 2. Xóa các biến thể đã gỡ (nếu sửa sản phẩm cũ)
      for (const removedId of form.removedVariantIds) {
        await api(
          `/admin/products/${encodeURIComponent(pid)}/variants/${encodeURIComponent(removedId)}`,
          "DELETE"
        ).catch(() => null);
      }

      // 3. Tạo / cập nhật từng biến thể màu x size với SKU đuôi theo mã sản phẩm
      for (const area of form.areas) {
        const colorsCsv = area.palette.map((c) => c.hex).join(",") || area.dominantHex;
        for (const v of area.variants) {
          const baseSku = v.sku.trim();
          const cleanSku = baseSku.replace(/(-\d+)?$/, `-${prodNumStr}`);
          const vPayload = {
            sku: cleanSku,
            size: v.size,
            colorName: area.colorName.trim(),
            colors: colorsCsv,
            price: Number(v.price),
            salePrice: v.salePrice.trim() ? Number(v.salePrice) : null,
            shelf: v.shelf.trim() || null,
            status: v.status,
            stock: Number(v.stock),
          };
          if (v.variantId) {
            await api(
              `/admin/products/${encodeURIComponent(pid)}/variants/${encodeURIComponent(v.variantId)}`,
              "PUT",
              vPayload
            );
          } else {
            await api(`/admin/products/${encodeURIComponent(pid)}/variants`, "POST", vPayload);
          }
        }
      }

      // 4. Đồng bộ bảng HinhAnhSanPham + BangMauTrichXuat
      // Ảnh người mẫu --ref01 có LaAnhDaiDien = 1 (cover: true), ThuTuHienThi = 1
      // Các ảnh người mẫu tiếp theo có ThuTuHienThi = 2, 3...
      // Các ảnh trang phục có ThuTuHienThi = refCount + idx + 1 (cover: false)
      const refItems = form.referenceImages
        .filter((r) => !r.assetId.startsWith("local-"))
        .map((r, idx) => {
          const isRef01 = r.name.toLowerCase().includes("--ref01");
          const isCover = r.isCover ?? (isRef01 || idx === 0);
          return {
            imageId: r.imageId || null,
            assetId: r.assetId,
            cutoutAssetId: null,
            maskAssetId: null,
            colors: form.areas[0]?.palette[0]?.hex || "#1A1919",
            cover: isCover,
            position: isCover ? 1 : idx + 2,
            role: "reference",
          };
        });

      refItems.sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0));
      refItems.forEach((r, idx) => {
        r.position = idx + 1;
      });

      const garmentItems = form.areas
        .filter((a) => !a.assetId.startsWith("local-"))
        .map((a, idx) => ({
          imageId: a.imageId || null,
          assetId: a.assetId,
          cutoutAssetId: a.cutoutAssetId ?? null,
          maskAssetId: form.maskPath ?? null,
          colors: a.palette.map((c) => c.hex).join(",") || a.dominantHex,
          cover: refItems.length === 0 && idx === 0,
          position: refItems.length + idx + 1,
          role: "garment",
        }));

      const imageItems = [...refItems, ...garmentItems];
      if (imageItems.length > 0) {
        await api(`/admin/products/${encodeURIComponent(pid)}/images`, "POST", {
          images: imageItems,
          extractedPalette: extractedPaletteJson,
          maskAssetId: form.maskPath || null,
        });
      }

      // 5. Gửi AI bóc tách ngầm nếu có ảnh mới tải lên
      if (autoTriggerAi) {
        await triggerAiAnalysis(
          pid,
          form.areas.map((a) => a.assetId),
          form.referenceImages.map((r) => r.assetId)
        ).catch(() => null);
      }

      // 6. Thông báo trạng thái đã lưu & đồng bộ Cloudflare R2
      const finalStatus: ProductStatus = publishNow ? "DANG_KINH_DOANH" : "BAN_NHAP";
      if (publishNow) {
        toast.success({
          title: "Đã lưu và công bố sản phẩm",
          detail: `${form.name} đã ở trạng thái Đang kinh doanh và đồng bộ ảnh lên Cloudflare R2.`,
        });
      } else {
        toast.success({
          title: "Đã lưu bản nháp",
          detail: `Sản phẩm ${pid} đã được lưu ở trạng thái Bản nháp và đồng bộ ảnh lên Cloudflare R2.`,
        });
      }

      onAuditLog(
        `${finalStatus === "DANG_KINH_DOANH" ? "Công bố" : "Lưu nháp"} sản phẩm ${form.name}`,
        `${pid} · ${form.areas.length} ảnh màu`
      );
      await loadCatalogData();
      setView("list");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 401)) {
        // Hỗ trợ lưu cục bộ để demo UI khi chưa bật Backend
        const localId = form.productId ?? `SP-LOCAL-${Date.now()}`;
        const localRow: AdminProductRow = {
          productId: localId,
          categoryId: form.categoryId,
          name: form.name.trim(),
          material: form.material.trim(),
          fit: form.fit,
          waist: form.waist,
          length: form.length,
          pattern: form.pattern,
          vtonCategory: form.vtonCategory,
          subtype: form.subtype,
          status: publishNow ? "DANG_KINH_DOANH" : "BAN_NHAP",
          minPrice: Number(form.areas[0]?.variants[0]?.price || 350000),
          originalPrice: Number(form.areas[0]?.variants[0]?.price || 350000),
          coverUrl: form.areas[0]?.originalUrl,
          sku: form.areas[0]?.variants[0]?.sku,
          colorSwatches: form.areas.map((a) => ({ hex: a.dominantHex, name: a.colorName })),
        };
        setProducts((prev) =>
          prev.some((p) => p.productId === localId)
            ? prev.map((p) => (p.productId === localId ? localRow : p))
            : [localRow, ...prev]
        );
        onAuditLog("Lưu sản phẩm (offline preview)", `${localRow.name} · ${localRow.status}`);
        toast.warning({
          title: "Backend chưa kết nối — đã lưu tạm trên phiên trình duyệt",
          detail: "Khi bật Spring Boot + MySQL, thao tác này sẽ ghi trực tiếp vào CSDL.",
        });
        setView("list");
      } else {
        toast.error({
          title: "Lưu sản phẩm thất bại",
          detail: err instanceof Error ? err.message : "Vui lòng kiểm tra dữ liệu nhập.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPublish = async (row: AdminProductRow) => {
    try {
      await api(`/admin/products/${encodeURIComponent(row.productId)}/publish`, "POST", {});
      toast.success({ title: `Đã công bố ${row.name}` });
      onAuditLog(`Công bố sản phẩm ${row.name}`, row.productId);
      await loadCatalogData();
    } catch (err) {
      toast.warning({
        title: "Chưa đủ điều kiện công bố",
        detail:
          err instanceof Error
            ? err.message
            : "Mỗi biến thể cần có ảnh bóc nền và Agnostic Mask trên R2.",
      });
    }
  };

  const handleArchiveProduct = async () => {
    if (!archiveTarget) return;
    try {
      await api(`/admin/products/${encodeURIComponent(archiveTarget.productId)}`, "DELETE");
      toast.success({ title: `Đã tạm ngừng kinh doanh ${archiveTarget.name}` });
      onAuditLog(`Tạm ngừng sản phẩm ${archiveTarget.name}`, archiveTarget.productId);
      setArchiveTarget(null);
      await loadCatalogData();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 0 || err.status === 502)) {
        setProducts((prev) =>
          prev.map((p) =>
            p.productId === archiveTarget.productId ? { ...p, status: "TAM_NGUNG" } : p
          )
        );
        setArchiveTarget(null);
      } else {
        toast.error({
          title: "Không thể tạm ngừng sản phẩm",
          detail: err instanceof Error ? err.message : "Vui lòng thử lại.",
        });
      }
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.warning({ title: "Nhập tên danh mục" });
      return;
    }
    try {
      const res = await api<{ categoryId: string }>("/admin/categories", "POST", {
        name: newCatName.trim(),
        parentId: newCatParent || null,
        description: newCatDesc.trim() || null,
        position: categories.length + 1,
      });
      toast.success({ title: "Đã thêm danh mục mới", detail: newCatName.trim() });
      setNewCatName("");
      setNewCatDesc("");
      setCategoryModalOpen(false);
      await loadCatalogData();
      if (view === "editor") {
        setForm((prev) => ({ ...prev, categoryId: res.categoryId }));
      }
    } catch (err) {
      toast.error({
        title: "Không tạo được danh mục",
        detail: err instanceof Error ? err.message : "Vui lòng kiểm tra lại.",
      });
    }
  };

  const handleQuickUpdateVtonFromInspector = async (
    nextVton: VtonCategory,
    nextSubtype: string
  ) => {
    if (view === "editor") {
      setForm((prev) => ({
        ...prev,
        vtonCategory: nextVton,
        subtype: nextSubtype,
        waist: nextVton === "upper_body" ? "KHONG_AP_DUNG" : prev.waist,
      }));

      // Tự động chạy lại bóc tách GPU ngay cho các biến thể với phân loại VTON mới
      const coverRefAssetId =
        form.referenceImages.find((r) => r.isCover || r.name.toLowerCase().includes("--ref01"))?.assetId ||
        form.referenceImages[0]?.assetId;
      for (const a of form.areas) {
        if (isValidServerAssetId(a.assetId)) {
          void runGarmentSegmentation(a.areaId, a.assetId, coverRefAssetId, nextVton, nextSubtype);
        }
      }
    }
    if (inspectorProductId) {
      try {
        await api(`/admin/products/${encodeURIComponent(inspectorProductId)}/vton`, "PATCH", {
          vtonCategory: nextVton,
          subtype: nextSubtype,
        });
        toast.success({
          title: "Đã cập nhật phân loại VTON",
          detail: `${labelFor(VTON_CATEGORY_OPTIONS, nextVton)} · ${labelFor(
            DEEPFASHION2_SUBTYPES,
            nextSubtype
          )}`,
        });
        await loadCatalogData();
      } catch (err) {
        if (!(err instanceof ApiError && (err.status === 0 || err.status === 502))) {
          toast.error({
            title: "Lỗi cập nhật phân loại VTON",
            detail: err instanceof Error ? err.message : "Thử lại sau.",
          });
        }
      }
    } else {
      toast.success({
        title: "Đã áp dụng phân loại mới vào form",
        detail: `${labelFor(VTON_CATEGORY_OPTIONS, nextVton)} · ${labelFor(
          DEEPFASHION2_SUBTYPES,
          nextSubtype
        )}`,
      });
    }
  };

  const handleReanalyzeFromInspector = async () => {
    setAnalyzing(true);
    setAnalysisMessage(null);
    try {
      const coverRef =
        form.referenceImages.find((r) => r.isCover || r.name.toLowerCase().includes("--ref01")) ||
        form.referenceImages[0];
      const refAssetId = coverRef?.assetId;
      let updatedCount = 0;

      for (const area of form.areas) {
        if (isValidServerAssetId(area.assetId)) {
          const res = await api<{
            cutoutAssetId?: string;
            cutoutUrl?: string;
            maskAssetId?: string;
            maskUrl?: string;
            predictedVton?: VtonCategory;
            predictedSubtype?: string;
            confidence?: string;
            bodyPositionNote?: string;
          }>("/admin/ai/segment-garment", "POST", {
            garmentAssetId: area.assetId,
            referenceAssetId: isValidServerAssetId(refAssetId) ? refAssetId : null,
            vtonCategory: form.vtonCategory,
            subtype: form.subtype,
          });

          if (res && res.cutoutUrl) {
            updatedCount++;
            const liveCutoutUrl = catalogImage(res.cutoutUrl);
            const liveMaskUrl = res.maskUrl ? catalogImage(res.maskUrl) : null;
            setForm((prev) => ({
              ...prev,
              vtonCategory: res.predictedVton || prev.vtonCategory,
              subtype: res.predictedSubtype || prev.subtype,
              maskUrl: liveMaskUrl || prev.maskUrl,
              maskPath: res.maskAssetId || prev.maskPath,
              areas: prev.areas.map((a) =>
                a.areaId === area.areaId
                  ? {
                      ...a,
                      cutoutAssetId: res.cutoutAssetId || a.cutoutAssetId,
                      cutoutUrl: liveCutoutUrl || a.cutoutUrl,
                    }
                  : a
              ),
            }));

            setInspectorItems((prev) =>
              prev.map((item) =>
                item.id === area.areaId
                  ? {
                      ...item,
                      cutoutUrl: liveCutoutUrl || item.cutoutUrl,
                      maskUrl: liveMaskUrl || item.maskUrl,
                      r2CutoutKey: res.cutoutAssetId ? `media/assets/${res.cutoutAssetId}.png` : item.r2CutoutKey,
                      r2MaskKey: res.maskAssetId ? `media/assets/${res.maskAssetId}.png` : item.r2MaskKey,
                      predictedVton: res.predictedVton || item.predictedVton,
                      predictedSubtype: res.predictedSubtype || item.predictedSubtype,
                      confidence: res.confidence || item.confidence,
                      bodyPositionNote: res.bodyPositionNote || item.bodyPositionNote,
                      isSampleFallback: false,
                    }
                  : item
              )
            );
          }
        }
      }

      if (updatedCount > 0) {
        setAnalysisMessage("Đã hoàn tất phân tích & bóc tách nền realtime từ YOLOv8s-seg + SAM 2 trên GPU.");
        toast.success({
          title: "Bóc tách nền AI thành công",
          detail: `Đã xử lý xong ${updatedCount} ảnh biến thể trang phục.`,
        });
      } else if (inspectorProductId) {
        const assetIds = form.areas.map((a) => a.assetId);
        const refIds = form.referenceImages.map((r) => r.assetId);
        const op = await triggerAiAnalysis(inspectorProductId, assetIds, refIds);
        if (op) {
          setAnalysisMessage(`Đã gửi job AI (${op.operationId}) — trạng thái: ${op.status}.`);
          toast.info({ title: "Đã gửi yêu cầu chạy lại AI bóc tách", detail: `Job ${op.operationId}` });
        }
      } else {
        setAnalysisMessage("Không tìm thấy ảnh asset hợp lệ trên server để gửi phân tích GPU.");
      }
    } catch (err) {
      setAnalysisMessage(
        err instanceof Error
          ? `Không thể chạy lại AI: ${err.message}`
          : "AI Service / GPU Worker hiện chưa phản hồi."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // Danh mục con để hiển thị gọn gàng trong dropdown
  const leafCategories = useMemo(
    () => categories.filter((c) => Boolean(c.parentId)),
    [categories]
  );

  // Sinh mã lưu trữ slug chuẩn R2: w- (Nữ) hoặc m- (Nam) theo danh mục và tên sản phẩm
  const storageSlug = useMemo(
    () => buildProductStorageSlug(form.name, form.categoryId, form.gender),
    [form.name, form.categoryId, form.gender]
  );

  return (
    <section className="space-y-6">
      <PageHeading
        eyebrow="Quản lý sản phẩm · AI Vision Pipeline"
        title="Quản lý sản phẩm & AI Studio"
        detail="Quản trị danh mục, biến thể màu × size, giá kệ và kiểm định phân loại VTON."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              view === "editor"
                ? openInspectorForEditor()
                : products[0]
                  ? void openInspectorForProductRow(products[0])
                  : setInspectorOpen(true)
            }
            title="Phím tắt Ctrl + M"
          >
            <Keyboard className="h-3.5 w-3.5 text-accent-hover" />
            <span>Soi Mask AI</span>
            <kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl + M
            </kbd>
          </Button>
          {view === "list" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setCategoryModalOpen(true)}>
                <FolderPlus className="h-3.5 w-3.5" />
                Thêm danh mục
              </Button>
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" />
                Thêm sản phẩm mới
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setView("list")}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Button>
          )}
        </div>
      </PageHeading>

      {backendOffline && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-xs text-foreground">
          <span>
            <strong>Chế độ xem trước ngoại tuyến:</strong> Chưa kết nối được Backend Spring Boot (hoặc chưa đăng nhập qua API). Dữ liệu thao tác đang chạy tạm trên phiên trình duyệt.
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadCatalogData()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Thử kết nối lại
          </Button>
        </div>
      )}

      {/* ==================== CHẾ ĐỘ 1: DANH SÁCH CRUD SẢN PHẨM ==================== */}
      {view === "list" && (
        <div className="space-y-4">
          {/* Thanh tìm kiếm & bộ lọc */}
          <div className="grid gap-2.5 rounded-xl border border-border bg-surface p-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                aria-label="Tìm theo tên sản phẩm, mã SP hoặc SKU"
                placeholder="Tìm tên, mã SP, SKU…"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} pl-9 text-xs sm:text-sm px-2.5`}
              />
            </div>

            <select
              aria-label="Lọc theo trạng thái sản phẩm"
              className={`${inputClass} text-xs sm:text-sm px-2.5`}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {PRODUCT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc theo phân loại VTON"
              className={`${inputClass} text-xs sm:text-sm px-2.5`}
              value={vtonFilter}
              onChange={(e) => {
                setVtonFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả VTON</option>
              {VTON_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Lọc danh mục cha (Thời trang Nam / Nữ...) */}
            <select
              aria-label="Lọc theo danh mục cha"
              className={`${inputClass} text-xs sm:text-sm px-2.5`}
              value={parentCategoryFilter}
              onChange={(e) => {
                setParentCategoryFilter(e.target.value);
                setCategoryFilter("");
                setPage(1);
              }}
            >
              <option value="">Tất cả danh mục cha</option>
              {parentCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Lọc danh mục con (chỉ chọn sau khi chọn danh mục cha) */}
            <select
              aria-label="Lọc theo danh mục con"
              className={`${inputClass} text-xs sm:text-sm px-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/40`}
              value={categoryFilter}
              disabled={!parentCategoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {parentCategoryFilter ? "Tất cả danh mục con" : "Chọn danh mục cha trước"}
              </option>
              {groupedChildCategories.map((group) =>
                group.children.length > 0 ? (
                  <optgroup key={group.category.value} label={group.category.label}>
                    <option value={group.category.value}>
                      Tất cả {group.category.label}
                    </option>
                    {group.children.map((sub) => (
                      <option key={sub.value} value={sub.value}>
                        {sub.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={group.category.value} value={group.category.value}>
                    {group.category.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Bảng danh sách sản phẩm */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục &amp; Thuộc tính</th>
                  <th>Phân loại VTON</th>
                  <th>Màu đại diện</th>
                  <th>Giá bán</th>
                  <th>Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Đang tải danh sách sản phẩm…
                    </td>
                  </tr>
                ) : pagedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Không có sản phẩm nào khớp bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((row) => {
                    const catName =
                      categories.find((c) => c.value === row.categoryId)?.label ?? row.categoryId;
                    const primarySwatch = row.colorSwatches?.[0];
                    return (
                      <tr key={row.productId}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-canvas">
                              {row.coverUrl ? (
                                <img
                                  src={catalogImage(row.coverUrl)}
                                  alt={row.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                  No img
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-xs truncate font-semibold text-foreground">
                                {row.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {row.productId}
                                {row.sku ? ` · ${row.sku}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-xs font-semibold text-foreground">{catName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {labelFor(FIT_OPTIONS, row.fit)} · {labelFor(PATTERN_OPTIONS, row.pattern)}
                          </p>
                        </td>
                        <td>
                          <p className="text-xs font-medium text-foreground">
                            {labelFor(VTON_CATEGORY_OPTIONS, row.vtonCategory)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {labelFor(DEEPFASHION2_SUBTYPES, row.subtype)}
                          </p>
                        </td>
                        <td>
                          {primarySwatch ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="h-5 w-5 shrink-0 rounded-full border border-border"
                                style={{
                                  backgroundColor: primarySwatch.hex.split(",")[0]?.trim() || "#1F2937",
                                }}
                                title={primarySwatch.name}
                              />
                              <span className="text-xs capitalize text-foreground">
                                {primarySwatch.name}
                                {(row.colorSwatches?.length ?? 0) > 1
                                  ? ` +${(row.colorSwatches?.length ?? 1) - 1}`
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="font-mono text-xs">
                          {row.minPrice != null
                            ? `${Number(row.minPrice).toLocaleString("vi-VN")}đ`
                            : "Chưa đặt giá"}
                        </td>
                        <td>
                          <Badge tone={statusTone(row.status)}>
                            {vnLabel(row.status) || labelFor(PRODUCT_STATUS_OPTIONS, row.status)}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
 
  <Button
    variant="ghost"
    size="sm"
    title="Xem chi tiết sản phẩm"
    onClick={() => void openProductDetail(row)}
  >
    <Eye className="h-3.5 w-3.5" />
  </Button>

  
  <div className="flex flex-col items-stretch gap-1.5">
    <Button
      variant="outline"
      size="sm"
      onClick={() => void startEdit(row)}
    >
      <Edit3 className="h-3.5 w-3.5" />
      Sửa
    </Button>

    {row.status === "BAN_NHAP" && (
      <Button
        variant="success"
        size="sm"
        onClick={() => void handleQuickPublish(row)}
      >
        <Check className="h-3.5 w-3.5" />
        Công bố
      </Button>
    )}

    {row.status !== "TAM_NGUNG" ? (
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-danger-subtle hover:text-destructive"
        title="Xóa hoặc Tạm ngừng kinh doanh sản phẩm (Ảnh R2 vẫn lưu trữ vĩnh viễn)"
        onClick={() => setArchiveTarget(row)}
      >
        <PauseCircle className="h-3.5 w-3.5" />
        Xóa / Ngừng
      </Button>
    ) : (
      <span className="text-[11px] text-muted-foreground italic px-2 text-center">
        Đã tạm ngừng
      </span>
    )}
  </div>
</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={setPage}
            unit="sản phẩm"
          />
        </div>
      )}

      {/* ==================== CHẾ ĐỘ 2: WORKSPACE TẠO / SỬA SẢN PHẨM ==================== */}
      {view === "editor" && (
        <div className="space-y-6">
          {/* Khu A: Thông tin chung (SanPham) */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <section className="space-y-5 rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    1. Thông tin chung &amp; Thuộc tính thẩm mỹ
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Nhập 1 lần cho toàn bộ biến thể màu &amp; size của sản phẩm.
                  </p>
                </div>
                <Badge tone={statusTone(form.status)}>
                  {form.productId ? `${form.productId} · ` : "Tạo mới · "}
                  {labelFor(PRODUCT_STATUS_OPTIONS, form.status)}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên sản phẩm *">
                  <input
                    type="text"
                    placeholder="VD: Áo Sơ Mi Lụa Cổ Đức Dáng Suông"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                    maxLength={150}
                  />
                </Field>

                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Danh mục cha *">
                    <select
                      value={editorParentCategory}
                      onChange={(e) => {
                        const newParent = e.target.value;
                        setEditorParentCategory(newParent);
                        const firstChild = categories.find(
                          (c) =>
                            isCategoryDescendantOf(c.value, newParent) &&
                            !categories.some((k) => k.parentId === c.value)
                        );
                        if (firstChild) {
                          setForm((prev) => ({
                            ...prev,
                            categoryId: firstChild.value,
                            gender: detectCategoryGender(firstChild.value),
                          }));
                        }
                      }}
                      className={inputClass}
                    >
                      {parentCategories.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Danh mục chi tiết *">
                    <div className="flex gap-2">
                      <select
                        value={form.categoryId}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            categoryId: newCat,
                            gender: detectCategoryGender(newCat),
                          }));
                        }}
                        className={inputClass}
                      >
                        {categories
                          .filter((sec) => sec.parentId === editorParentCategory)
                          .map((sec) => {
                            const subLeaves = categories.filter((c) => c.parentId === sec.value);
                            if (!subLeaves.length) {
                              return (
                                <option key={sec.value} value={sec.value}>
                                  {sec.label}
                                </option>
                              );
                            }
                            return (
                              <optgroup key={sec.value} label={sec.label}>
                                {subLeaves.map((child) => (
                                  <option key={child.value} value={child.value}>
                                    {child.label}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                      </select>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Thêm danh mục mới"
                        onClick={() => setCategoryModalOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </Field>
                </div>

                {/* Khối phân loại Giới tính & Xem trước Quy tắc đặt tên Cloudflare R2 */}
                <div className="sm:col-span-2 rounded-xl border border-border bg-canvas/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Folder className="h-4 w-4 text-accent-hover" />
                      Phân loại giới tính &amp; Thư mục lưu trữ R2:
                    </span>
                    <div className="flex items-center gap-4 text-xs" role="radiogroup" aria-label="Giới tính trang phục">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground hover:text-accent-hover transition-colors">
                        <input
                          type="radio"
                          name="gender_select"
                          value="FEMALE"
                          checked={form.gender === "FEMALE"}
                          onChange={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                          className="h-3.5 w-3.5 text-accent"
                        />
                        <span>Thời trang Nữ (Tiền tố <code className="font-mono text-accent-hover font-bold">w-</code>)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground hover:text-accent-hover transition-colors">
                        <input
                          type="radio"
                          name="gender_select"
                          value="MALE"
                          checked={form.gender === "MALE"}
                          onChange={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                          className="h-3.5 w-3.5 text-accent"
                        />
                        <span>Thời trang Nam (Tiền tố <code className="font-mono text-accent-hover font-bold">m-</code>)</span>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-3 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground font-medium">Mã lưu trữ file (Storage Slug):</span>
                      <code className="rounded bg-canvas px-2 py-0.5 font-mono text-xs font-bold text-accent-hover border border-border">
                        {storageSlug}
                      </code>
                    </div>
                    <div className="grid gap-1 pt-1 font-mono text-[11px] text-muted-foreground">
                      <p className="truncate">
                        📁 <strong>R2 Folder:</strong> catalog/products/{storageSlug}/
                      </p>
                      <p className="truncate">
                        📸 <strong>Ảnh gốc &amp; PNG:</strong> {storageSlug}--img01--v01--original.png · {storageSlug}--img01--v01--cutout.png
                      </p>
                      <p className="truncate">
                        🎭 <strong>Mặt nạ AI Mask:</strong> catalog-processing/products/{storageSlug}/{storageSlug}--img01--v01--mask.png
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    💡 Lưu ý: Khi tải ảnh lên từ máy tính (dù tên file là gì: image.png, photo.jpg...), hệ thống sẽ tự động đổi tên và phân loại theo đúng cấu trúc chuẩn Cloudflare R2 ở trên khi lưu/phân tích.
                  </p>
                </div>
              </div>

              {/* Radio button Kiểu dáng */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-muted-foreground">
                  Kiểu dáng (Form dáng)
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kiểu dáng">
                  {FIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={form.fit === opt.value}
                      onClick={() => setForm((prev) => ({ ...prev, fit: opt.value }))}
                      className={`rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        form.fit === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-canvas text-foreground hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radio button Loại cạp quần */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-muted-foreground">
                  Loại cạp quần / chân váy
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Loại cạp quần">
                  {WAIST_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={form.waist === opt.value}
                      onClick={() => setForm((prev) => ({ ...prev, waist: opt.value }))}
                      className={`rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        form.waist === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-canvas text-foreground hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radio button Chiều dài trang phục */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-muted-foreground">
                  Chiều dài trang phục
                </span>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Chiều dài trang phục"
                >
                  {LENGTH_OPTIONS.map((opt) => {
                    const matchedGroup = opt.groups.includes(form.vtonCategory);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={form.length === opt.value}
                        onClick={() => setForm((prev) => ({ ...prev, length: opt.value }))}
                        className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                          form.length === opt.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : matchedGroup
                              ? "border-border bg-canvas text-foreground hover:border-primary"
                              : "border-border/60 bg-canvas/50 text-muted-foreground hover:border-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Radio button Loại họa tiết */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-muted-foreground">
                  Loại họa tiết vải
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Loại họa tiết">
                  {PATTERN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={form.pattern === opt.value}
                      onClick={() => setForm((prev) => ({ ...prev, pattern: opt.value }))}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        form.pattern === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-canvas text-foreground hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chất liệu (Textarea + gợi ý nhanh) */}
              <div className="space-y-2">
                <Field label="Chất liệu vải">
                  <textarea
                    rows={2}
                    placeholder="VD: Vải tuytxi cao cấp: 75% Polyester, 20% Rayon, 5% Spandex"
                    value={form.material}
                    onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}
                    maxLength={100}
                    className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  {MATERIAL_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, material: preset }))}
                      className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Cột phải: Định hướng AI VTON + Ảnh người mẫu + Khung mô tả chuẩn */}
            <section className="space-y-5 rounded-xl border border-border bg-surface p-5">
              <div className="border-b border-border pb-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-accent-hover" />
                  2. Định hướng AI VTON &amp; Ảnh người mẫu
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Admin xác nhận đúng nhóm VTON &amp; tiểu loại trang phục để tránh việc AI nhận diện nhầm. 
                </p>
              </div>

              {/* Radio button 3 phân loại VTON */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-muted-foreground">
                  Phân loại vùng mặc VTON *
                </span>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Phân loại VTON">
                  {VTON_CATEGORY_OPTIONS.map((opt) => {
                    const isSelected = String(form.vtonCategory || "").toLowerCase().trim() === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          const firstSubtype = DEEPFASHION2_SUBTYPES.find(
                            (s) => s.vtonCategory === opt.value
                          );
                          setForm((prev) => ({
                            ...prev,
                            vtonCategory: opt.value,
                            subtype: firstSubtype?.value ?? prev.subtype,
                            waist: opt.value === "upper_body" ? "KHONG_AP_DUNG" : prev.waist,
                            length:
                              opt.value === "upper_body"
                                ? "AO_TIEU_CHUAN"
                                : opt.value === "lower_body"
                                  ? "DAI_CHAM_GOT"
                                  : "MIDI_QUA_GOI",
                          }));
                          setInspectorVton(opt.value);
                          if (firstSubtype) setInspectorSubtype(firstSubtype.value);
                        }}
                        className={`rounded-lg border px-3 py-2.5 text-center text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25"
                            : "border-border bg-canvas text-foreground hover:border-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropdown 13 tiểu loại DeepFashion2 */}
              <Field label="Tiểu loại trang phục*">
                <select
                  value={form.subtype}
                  onChange={(e) => {
                    const selected = DEEPFASHION2_SUBTYPES.find((s) => s.value === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      subtype: e.target.value,
                      vtonCategory: selected ? selected.vtonCategory : prev.vtonCategory,
                    }));
                  }}
                  className={inputClass}
                >
                  {DEEPFASHION2_SUBTYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — ({labelFor(VTON_CATEGORY_OPTIONS, opt.vtonCategory)})
                    </option>
                  ))}
                </select>
              </Field>

              {/* Upload ảnh người mẫu mặc thử tham chiếu (hiện thumbnail, ẩn kết quả đoán của model khỏi UI form) */}
              <div className="rounded-lg border border-dashed border-border bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <UserSquare2 className="h-4 w-4 text-accent-hover" />
                      Ảnh người mẫu tham chiếu (tùy chọn)
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Giúp AI kiểm tra độ dài chạm eo/hông thực tế.
                    </p>
                  </div>
                  <input
                    ref={referenceInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      void handleReferenceFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => referenceInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Tải ảnh mẫu
                  </Button>
                </div>

                {form.referenceImages.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {form.referenceImages.map((refImg, idx) => {
                      const isCover =
                        refImg.isCover ||
                        refImg.name.toLowerCase().includes("--ref01") ||
                        (idx === 0 &&
                          !form.referenceImages.some((r) =>
                            r.name.toLowerCase().includes("--ref01")
                          ));
                      return (
                        <div
                          key={refImg.assetId + idx}
                          className={`group relative h-20 w-16 overflow-hidden rounded-md border bg-surface ${
                            isCover ? "border-primary ring-2 ring-primary/40" : "border-border"
                          }`}
                        >
                          <img
                            src={refImg.url}
                            alt={`Ảnh người mẫu ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {isCover && (
                            <span className="absolute bottom-0 inset-x-0 bg-primary/95 py-0.5 text-center text-[8px] font-bold text-primary-foreground shadow-xs">
                              Ảnh bìa
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={`Xóa ảnh người mẫu ${idx + 1}`}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                referenceImages: prev.referenceImages.filter((_, i) => i !== idx),
                              }))
                            }
                            className="absolute right-1 top-1 rounded-full bg-surface/90 p-0.5 text-foreground opacity-90 hover:opacity-100 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mô tả sản phẩm với khung mô tả dùng chung */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Mô tả chi tiết sản phẩm
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        description: buildYoFaSoDescriptionTemplate(
                          prev.name,
                          prev.material,
                          prev.fit
                        ),
                      }))
                    }
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Áp dụng khung mô tả mẫu
                  </Button>
                </div>
                <textarea
                  rows={8}
                  placeholder="Nhấn 'Áp dụng khung mô tả mẫu' để tạo nhanh bố cục 5 phần rồi điền điểm riêng của sản phẩm…"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </section>
          </div>

          {/* Khu B: Upload ảnh sản phẩm -> Sinh Area biến thể theo từng ảnh */}
          <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  3. Ảnh sản phẩm &amp; biến thể
                </h2>
               
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={garmentInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    void handleGarmentFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button variant="accent" onClick={() => garmentInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Tải ảnh sản phẩm
                </Button>
              </div>
            </div>

            {form.areas.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleGarmentFiles(e.dataTransfer.files);
                }}
                className="flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-canvas p-8 text-center"
              >
                <ImagePlus className="mb-3 h-10 w-10 text-accent-hover" />
                <p className="text-sm font-semibold text-foreground">
                  Kéo thả nhiều ảnh sản phẩm (mỗi ảnh một màu) vào đây
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hệ thống tự tách màu đại diện và tạo sẵn Area chọn Size · Tồn kho · Giá · Kệ cho từng ảnh.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => garmentInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Chọn ảnh từ máy tính
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {form.areas.map((area, idx) => (
                  <ProductColorAreaCard
                    key={area.areaId}
                    area={area}
                    index={idx}
                    productName={form.name || "SANPHAM"}
                    shelfOptions={shelves}
                    onChange={(updated) => {
                      setForm((prev) => ({
                        ...prev,
                        areas: prev.areas.map((a, i) => {
                          if (i === idx) return updated;
                          return updated.cover ? { ...a, cover: false } : a;
                        }),
                      }));
                    }}
                    onRemoveArea={() => {
                      setForm((prev) => {
                        const removedIds = area.variants
                          .map((v) => v.variantId)
                          .filter((id): id is string => Boolean(id));
                        const remaining = prev.areas.filter((_, i) => i !== idx);
                        if (remaining.length > 0 && !remaining.some((a) => a.cover)) {
                          remaining[0] = { ...remaining[0], cover: true };
                        }
                        return {
                          ...prev,
                          areas: remaining,
                          removedVariantIds: [...prev.removedVariantIds, ...removedIds],
                        };
                      });
                    }}
                    onRedetectColor={() => handleRedetectAreaColor(area.areaId, area.assetId)}
                    onDeletePersistedVariant={async (variantId) => {
                      setForm((prev) => ({
                        ...prev,
                        removedVariantIds: [...prev.removedVariantIds, variantId],
                      }));
                      return true;
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Thanh hành động lưu nháp hoặc công bố ngay */}
          <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface/95 px-5 py-4 shadow-modal backdrop-blur-xs">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-foreground">
              <Checkbox
                checked={autoTriggerAi}
                onCheckedChange={(checked) => setAutoTriggerAi(checked)}
              />
              <span>Tự động gửi pipeline AI bóc nền &amp; sinh Agnostic Mask vào R2 khi lưu</span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="ghost" disabled={saving} onClick={() => setView("list")}>
                Hủy
              </Button>
              {form.productId && form.status !== "TAM_NGUNG" && (
                <Button
                  variant="ghost"
                  disabled={saving}
                  className="text-destructive hover:bg-danger-subtle hover:text-destructive"
                  onClick={() => {
                    const currentRow: AdminProductRow = {
                      productId: form.productId!,
                      categoryId: form.categoryId,
                      name: form.name,
                      material: form.material,
                      fit: form.fit,
                      waist: form.waist,
                      length: form.length,
                      pattern: form.pattern,
                      vtonCategory: form.vtonCategory,
                      subtype: form.subtype,
                      status: form.status,
                      minPrice: Number(form.areas[0]?.variants[0]?.price || 0),
                      coverUrl:
                        form.referenceImages.find((r) => r.isCover || r.name.toLowerCase().includes("--ref01"))?.url ||
                        form.referenceImages[0]?.url ||
                        form.areas[0]?.originalUrl,
                      sku: form.areas[0]?.variants[0]?.sku,
                    };
                    setArchiveTarget(currentRow);
                  }}
                >
                  <PauseCircle className="h-4 w-4" />
                  Xóa / Ngừng kinh doanh
                </Button>
              )}
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void handleSaveProduct(false)}
              >
                <Save className="h-4 w-4" />
                {saving ? "Đang lưu…" : "Lưu bản nháp"}
              </Button>
              <Button
                variant="success"
                disabled={saving}
                onClick={() => void handleSaveProduct(true)}
              >
                <Check className="h-4 w-4" />
                {saving ? "Đang xử lý…" : "Lưu & Công bố ngay"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Popup xem & kiểm định kết quả bóc tách nền + Agnostic Mask bằng phím tắt Ctrl + M */}
      <AiMaskInspectorDialog
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        productId={inspectorProductId}
        productName={inspectorProductName}
        vtonCategory={inspectorVton}
        subtype={inspectorSubtype}
        items={inspectorItems}
        referenceUrl={inspectorRefUrl}
        analyzing={analyzing}
        analysisMessage={analysisMessage}
        onQuickUpdateVton={handleQuickUpdateVtonFromInspector}
        onReanalyze={handleReanalyzeFromInspector}
      />

      {/* Modal thêm nhanh danh mục */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm danh mục sản phẩm mới</DialogTitle>
            <DialogDescription>
              Hỗ trợ tối đa 2 cấp danh mục theo cấu trúc cây của YoFaSo Shop.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Danh mục cha">
              <select
                className={inputClass}
                value={newCatParent}
                onChange={(e) => setNewCatParent(e.target.value)}
              >
                <option value="">-- Danh mục gốc (cấp 1) --</option>
                {parentCategories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tên danh mục *">
              <input
                type="text"
                placeholder="VD: Áo khoác blazer nữ"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={inputClass}
                maxLength={100}
              />
            </Field>
            <Field label="Mô tả ngắn">
              <input
                type="text"
                placeholder="Mô tả tóm tắt phân loại"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className={inputClass}
                maxLength={255}
              />
            </Field>
          </div>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>
              Đóng
            </Button>
            <Button onClick={() => void handleCreateCategory()}>Tạo danh mục</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xác nhận xóa / ngừng kinh doanh sản phẩm & bảo toàn R2 */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Xác nhận Xóa / Tạm ngừng kinh doanh sản phẩm?"
        description={
          archiveTarget ? (
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Bạn có chắc chắn muốn xóa hoặc tạm ngừng kinh doanh sản phẩm{" "}
                <strong className="text-foreground">{archiveTarget.name}</strong>{" "}
                <span className="font-mono text-muted-foreground">({archiveTarget.productId})</span>?
              </p>
              <div className="rounded-lg border border-border bg-canvas/60 p-3 space-y-2 text-left">
                <div className="flex items-start gap-2">
                  <span className="inline-block mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <p>
                    <strong className="text-foreground">Trạng thái hệ thống:</strong> Sản phẩm sẽ chuyển sang trạng thái <strong>TẠM NGỪNG KINH DOANH</strong> và lập tức ẩn khỏi App khách hàng cũng như danh mục bán lẻ.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-block mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <p>
                    <strong className="text-foreground">Bảo toàn tài nguyên Cloudflare R2:</strong> Toàn bộ hình ảnh sản phẩm (ảnh gốc, ảnh bóc nền PNG, Agnostic Mask và ảnh người mẫu) trên Cloudflare R2 <strong>vẫn được giữ nguyên vĩnh viễn</strong> để bảo đảm khách hàng xem lại Đơn hàng đã mua và Lịch sử thử đồ ảo không bao giờ bị lỗi vỡ ảnh.
                  </p>
                </div>
              </div>
            </div>
          ) : null
        }
        confirmLabel="Xác nhận (Chuyển Tạm Ngừng)"
        cancelLabel="Hủy bỏ"
        tone="danger"
        onConfirm={() => void handleArchiveProduct()}
        onClose={() => setArchiveTarget(null)}
      />

      {/* Modal Xem chi tiết sản phẩm */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {detailProduct?.name || "Chi tiết sản phẩm"}
                  <Badge tone={statusTone(detailProduct?.status || "BAN_NHAP")}>
                    {vnLabel(detailProduct?.status || "") || detailProduct?.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-muted-foreground mt-1">
                  Mã sản phẩm: <span className="font-semibold text-foreground">{detailProduct?.productId}</span>
                  {" · "}
                  Danh mục: <span className="font-medium text-foreground">{categories.find(c => c.value === detailProduct?.categoryId)?.label || detailProduct?.categoryId}</span>
                  {" · "}
                  Giới tính: <span className="font-medium text-foreground">{detailProduct?.gender === "MALE" ? "Nam" : "Nữ"}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-accent-hover" />
              Đang tải thông tin chi tiết sản phẩm...
            </div>
          ) : detailProduct ? (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Cột trái: Bộ sưu tập ảnh & xem trước */}
                <div className="md:col-span-5 space-y-3">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-canvas/60 flex items-center justify-center">
                    {detailProduct.images && detailProduct.images[activeDetailImageIndex] ? (
                      <img
                        src={catalogImage(
                          detailProduct.images[activeDetailImageIndex].adminOriginalUrl ||
                          detailProduct.images[activeDetailImageIndex].originalUrl ||
                          detailProduct.images[activeDetailImageIndex].originalAssetId
                        )}
                        alt={detailProduct.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">Chưa có ảnh</div>
                    )}
                    {detailProduct.images && detailProduct.images[activeDetailImageIndex]?.cover && (
                      <span className="absolute top-2 left-2 rounded bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5">
                        Ảnh bìa
                      </span>
                    )}
                  </div>

                  {/* Thumbnail gallery */}
                  {detailProduct.images && detailProduct.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {detailProduct.images.map((img, idx) => {
                        const isSelected = idx === activeDetailImageIndex;
                        const isRef = Boolean(img.originalAssetId?.includes("--ref") || (img as { role?: string }).role === "reference");
                        return (
                          <button
                            key={img.imageId || idx}
                            type="button"
                            onClick={() => setActiveDetailImageIndex(idx)}
                            className={`relative h-16 w-14 shrink-0 rounded-lg border overflow-hidden transition-all ${
                              isSelected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-foreground/40"
                            }`}
                          >
                            <img
                              src={catalogImage(img.adminOriginalUrl || img.originalUrl || img.originalAssetId)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {isRef && (
                              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-medium">
                                Mẫu ref
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cột phải: Thông số kỹ thuật & VTON */}
                <div className="md:col-span-7 space-y-4">
                  <div className="rounded-xl border border-border bg-canvas/40 p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thông tin VTON &amp; Phân loại AI</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Phân loại VTON:</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(VTON_CATEGORY_OPTIONS, detailProduct.vtonCategory)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tiểu loại (DeepFashion2):</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(DEEPFASHION2_SUBTYPES, detailProduct.subtype)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Form dáng:</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(FIT_OPTIONS, detailProduct.fit)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cạp quần:</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(WAIST_OPTIONS, detailProduct.waist)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chiều dài:</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(LENGTH_OPTIONS, detailProduct.length)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Họa tiết:</span>
                        <p className="font-semibold text-foreground mt-0.5">{labelFor(PATTERN_OPTIONS, detailProduct.pattern)}</p>
                      </div>
                      {detailProduct.material && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Chất liệu:</span>
                          <p className="font-semibold text-foreground mt-0.5">{detailProduct.material}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bảng màu trích xuất K-Means */}
                  {Boolean(detailProduct.extractedPalette) && (
                    <div className="rounded-xl border border-border bg-canvas/40 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bảng màu trích xuất K-Means</h4>
                      <div className="flex flex-wrap gap-2">
                        {parseExtractedPalette(detailProduct.extractedPalette).flat().map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-canvas px-2 py-1 text-xs">
                            <span className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: c.hex }} />
                            <span className="font-medium text-foreground">{c.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({c.hex})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mô tả chi tiết */}
                  {detailProduct.description && (
                    <div className="rounded-xl border border-border bg-canvas/40 p-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mô tả chi tiết</h4>
                      <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto pr-2">
                        {detailProduct.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bảng biến thể SKU */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Danh sách biến thể SKU ({detailProduct.variants?.length || 0} biến thể)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas border-b border-border text-muted-foreground">
                      <tr>
                        <th className="p-2.5 font-medium">Mã SKU</th>
                        <th className="p-2.5 font-medium">Màu sắc</th>
                        <th className="p-2.5 font-medium">Size</th>
                        <th className="p-2.5 font-medium">Giá niêm yết</th>
                        <th className="p-2.5 font-medium">Giá bán</th>
                        <th className="p-2.5 font-medium">Tồn kho</th>
                        <th className="p-2.5 font-medium">Vị trí kệ</th>
                        <th className="p-2.5 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(detailProduct.variants ?? []).map((v) => (
                        <tr key={v.variantId || v.sku} className="hover:bg-canvas/50">
                          <td className="p-2.5 font-mono font-medium text-foreground">{v.sku}</td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-3 w-3 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: v.colors?.split(",")[0] || "#1F2937" }}
                              />
                              <span>{v.colorName}</span>
                            </div>
                          </td>
                          <td className="p-2.5 font-bold">{v.size}</td>
                          <td className="p-2.5 font-mono">{Number(v.price).toLocaleString("vi-VN")}đ</td>
                          <td className="p-2.5 font-mono text-emerald-600 font-semibold">
                            {v.salePrice ? `${Number(v.salePrice).toLocaleString("vi-VN")}đ` : "—"}
                          </td>
                          <td className="p-2.5 font-mono">{v.stock ?? 0}</td>
                          <td className="p-2.5 font-mono text-muted-foreground">{v.shelf || "—"}</td>
                          <td className="p-2.5">
                            <Badge tone={v.status === "DANG_BAN" ? "success" : v.status === "HET_HANG" ? "warning" : "neutral"}>
                              {v.status === "DANG_BAN" ? "Đang bán" : v.status === "HET_HANG" ? "Hết hàng" : "Ngừng bán"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-4 gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Đóng
            </Button>
            {detailProduct && (
              <Button
                variant="default"
                onClick={() => {
                  setDetailModalOpen(false);
                  void startEdit(detailProduct as unknown as AdminProductRow);
                }}
              >
                <Edit3 className="h-4 w-4 mr-1.5" />
                Chỉnh sửa sản phẩm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

