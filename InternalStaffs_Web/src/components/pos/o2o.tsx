"use client";

import { useState } from "react";
import {
  MapPin,
  Printer,
  Sparkles,
  ScanLine,
  CheckCircle2,
  Loader2,
  Search,
  Package,
  Clock,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, catalogImage } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import { exportO2OPickingPdf } from "@/lib/receipt-pdf";
import { type BienThe, vnd } from "@/lib/pos";

interface O2ORecommendation {
  recommendationId?: string;
  variantId: string;
  productId?: string;
  sku?: string;
  productName?: string;
  name?: string;
  size?: string;
  colorName?: string;
  price?: number;
  stock?: number;
  shelf?: string;
  projectedScore?: number;
  reason?: string;
  status?: string;
  imageUrl?: string | null;
}

interface O2OSessionDetail {
  sessionId: string;
  variantId: string;
  productId?: string;
  productName?: string;
  sku?: string;
  size?: string;
  colorName?: string;
  price?: number;
  stock?: number;
  shelf?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  createdAt?: string;
  productImageUrl?: string | null;
  pairedItem?: {
    sessionId?: string;
    variantId: string;
    productId?: string;
    productName?: string;
    sku?: string;
    size?: string;
    colorName?: string;
    price?: number;
    stock?: number;
    shelf?: string;
  };
  status: string;
  total: number;
  advice?: string;
  recommendations: O2ORecommendation[];
}

interface ProductLookupVariant {
  variantId: string;
  productId?: string;
  sku: string;
  productName?: string;
  name?: string;
  size?: string;
  colorName?: string;
  price?: number;
  salePrice?: number;
  stock?: number;
  shelf?: string;
  vtonCategory?: string;
  productImageUrl?: string | null;
  variants?: ProductLookupVariant[];
}

function toBienThe(raw: {
  variantId: string;
  sku?: string;
  productId?: string;
  productName?: string;
  name?: string;
  size?: string;
  colorName?: string;
  salePrice?: number;
  price?: number;
  stock?: number;
  shelf?: string;
  sessionId?: string;
}): BienThe {
  return {
    variantId: raw.variantId,
    maQuanLy: raw.sku || raw.variantId,
    sku: raw.sku || raw.variantId,
    productId: raw.productId,
    ten: raw.productName || raw.name || "Sản phẩm YoFaSo",
    size: raw.size || "Free",
    mau: raw.colorName || "Mặc định",
    donGia: Number(raw.salePrice ?? raw.price ?? 0),
    ton: Number(raw.stock ?? 0),
    shelf: raw.shelf || "KHO-01",
    sessionId: raw.sessionId,
  };
}

export function O2O({
  onLoad,
}: {
  products?: BienThe[];
  onLoad: (set: BienThe[], sessionId?: string) => boolean;
  onPrint?: () => void;
}) {
  const [mode, setMode] = useState<"session" | "product">("session");

  // Mode 1: Session ID and/or Customer Phone
  const [sessionId, setSessionId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneSessions, setPhoneSessions] = useState<O2OSessionDetail[]>([]);
  const [data, setData] = useState<O2OSessionDetail | null>(null);

  // Mode 2: Fallback Product ID / SKU / Name + AI Recommendations
  const [productQuery, setProductQuery] = useState("");
  const [lookedUpProduct, setLookedUpProduct] = useState<ProductLookupVariant | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductLookupVariant | null>(null);
  const [productRecs, setProductRecs] = useState<O2ORecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Shared resolved items + selection + PDF export
  const [resolvedItems, setResolvedItems] = useState<
    (BienThe & { tag?: string; projectedScore?: number; reason?: string })[]
  >([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  const extractSessionId = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.sessionId === "string" && parsed.sessionId.trim()) {
          return parsed.sessionId.trim().toUpperCase();
        }
      } catch {}
    }
    if (trimmed.toUpperCase().startsWith("YOFASO-O2O|")) {
      return trimmed.split("|")[1]?.trim().toUpperCase() || "";
    }
    return trimmed.toUpperCase();
  };

  const applySessionToView = (res: O2OSessionDetail) => {
    setData(res);
    const items: (BienThe & { tag?: string; projectedScore?: number; reason?: string })[] = [];
    const seen = new Set<string>();

    if (res.pairedItem?.variantId) {
      seen.add(res.pairedItem.variantId);
      items.push({
        ...toBienThe({ ...res.pairedItem, sessionId: res.sessionId }),
        tag: "Món gốc đã thử trước",
      });
    }
    if (res.variantId && !seen.has(res.variantId)) {
      seen.add(res.variantId);
      items.push({
        ...toBienThe({
          variantId: res.variantId,
          sku: res.sku,
          productId: res.productId,
          productName: res.productName,
          size: res.size,
          colorName: res.colorName,
          price: res.price,
          stock: res.stock,
          shelf: res.shelf,
          sessionId: res.sessionId,
        }),
        tag: "Món khách đã thử VTON",
      });
    }
    for (const r of res.recommendations || []) {
      if (!r.variantId || seen.has(r.variantId)) continue;
      seen.add(r.variantId);
      items.push({
        ...toBienThe({
          variantId: r.variantId,
          sku: r.sku,
          productId: r.productId,
          productName: r.productName || r.name,
          size: r.size,
          colorName: r.colorName,
          price: r.price,
          stock: r.stock,
          shelf: r.shelf,
          sessionId: res.sessionId,
        }),
        tag: "Gợi ý phối đồ AI",
        projectedScore: r.projectedScore,
        reason: r.reason,
      });
    }

    setResolvedItems(items);
    const defaultChecked = items.filter((it) => it.ton > 0).map((it) => it.variantId || it.maQuanLy);
    setCheckedIds(defaultChecked);
  };

  const lookupSessionOrPhone = async () => {
    const cleanSession = extractSessionId(sessionId);
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanSession && cleanSession !== sessionId.trim().toUpperCase()) {
      setSessionId(cleanSession);
    }

    // Auto-switch to product lookup if cashier enters SP... / SKU-... / BT... into session field
    if (cleanSession && !cleanPhone && /^(SP|SKU|BT)/i.test(cleanSession)) {
      setMode("product");
      setProductQuery(cleanSession);
      void lookupProductOrSku(cleanSession);
      return;
    }

    if (!cleanSession && !cleanPhone) {
      const msg = "Nhập mã phiên thử đồ (TD...) hoặc số điện thoại khách hàng để tra cứu.";
      setError(msg);
      pushToast({ tone: "warning", title: msg });
      return;
    }

    setLoading(true);
    setError("");
    setData(null);
    setPhoneSessions([]);
    setResolvedItems([]);
    setCheckedIds([]);

    try {
      if (cleanSession) {
        const qs = cleanPhone ? `?phone=${encodeURIComponent(cleanPhone)}` : "";
        const res = await api<O2OSessionDetail>(
          `/pos/try-on/sessions/${encodeURIComponent(cleanSession)}${qs}`
        );
        if (res && res.sessionId) {
          applySessionToView(res);
          pushToast({ tone: "success", title: `Đã tải phiên thử đồ ${res.sessionId}` });
        } else {
          setError("Không tìm thấy phiên thử đồ tương ứng trong hệ thống.");
        }
      } else {
        const list = await api<O2OSessionDetail[]>(
          `/pos/try-on/sessions?phone=${encodeURIComponent(cleanPhone)}`
        );
        if (Array.isArray(list) && list.length > 0) {
          setPhoneSessions(list);
          applySessionToView(list[0]);
          pushToast({
            tone: "success",
            title: `Tìm thấy ${list.length} phiên thử đồ gần nhất của SĐT ${cleanPhone}`,
          });
        } else {
          const msg = `Khách hàng SĐT ${cleanPhone} chưa có phiên thử đồ VTON nào.`;
          setError(msg);
          pushToast({ tone: "info", title: msg });
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Không tìm thấy phiên thử đồ hoặc số điện thoại không khớp.";
      setError(msg);
      pushToast({ tone: "error", title: msg });
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendationsForVariant = async (variant: ProductLookupVariant) => {
    setSelectedVariant(variant);
    setLoadingRecs(true);
    setProductRecs([]);
    try {
      const recs = await api<O2ORecommendation[]>(
        `/scoring/recommendations?variantId=${encodeURIComponent(variant.variantId)}`
      );
      const topRecs = Array.isArray(recs) ? recs.slice(0, 4) : [];
      setProductRecs(topRecs);

      const items: (BienThe & { tag?: string; projectedScore?: number; reason?: string })[] = [
        { ...toBienThe(variant), tag: "Sản phẩm gốc" },
      ];
      const seen = new Set<string>([variant.variantId]);

      for (const r of topRecs) {
        if (!r.variantId || seen.has(r.variantId)) continue;
        seen.add(r.variantId);
        // Enrich via /staff/variants/by-sku only if shelf/sku missing
        if (r.sku && r.shelf && r.stock !== undefined) {
          items.push({
            ...toBienThe(r),
            tag: "Gợi ý phối đồ AI",
            projectedScore: r.projectedScore,
            reason: r.reason,
          });
        } else {
          try {
            const full = await api<ProductLookupVariant>(
              `/staff/variants/by-sku?sku=${encodeURIComponent(r.variantId)}`
            );
            items.push({
              ...toBienThe(full),
              tag: "Gợi ý phối đồ AI",
              projectedScore: r.projectedScore,
              reason: r.reason,
            });
          } catch {
            items.push({
              ...toBienThe(r),
              tag: "Gợi ý phối đồ AI",
              projectedScore: r.projectedScore,
              reason: r.reason,
            });
          }
        }
      }

      setResolvedItems(items);
      const firstInStock = items.filter((it) => it.ton > 0).slice(0, 2).map((it) => it.variantId || it.maQuanLy);
      setCheckedIds(firstInStock);
    } catch {
      const base = [{ ...toBienThe(variant), tag: "Sản phẩm gốc" }];
      setResolvedItems(base);
      setCheckedIds(variant.stock && variant.stock > 0 ? [variant.variantId] : []);
    } finally {
      setLoadingRecs(false);
    }
  };

  const lookupProductOrSku = async (explicit?: string) => {
    const q = (explicit ?? productQuery).trim();
    if (!q) {
      const msg = "Nhập mã sản phẩm (SP...), mã SKU, mã biến thể (BT...) hoặc tên sản phẩm.";
      setError(msg);
      pushToast({ tone: "warning", title: msg });
      return;
    }
    setLoading(true);
    setError("");
    setLookedUpProduct(null);
    setSelectedVariant(null);
    setProductRecs([]);
    setResolvedItems([]);
    setCheckedIds([]);
    try {
      const found = await api<ProductLookupVariant>(`/staff/variants/by-sku?sku=${encodeURIComponent(q)}`);
      if (found && found.variantId) {
        setLookedUpProduct(found);
        await loadRecommendationsForVariant(found);
        pushToast({ tone: "success", title: `Đã tìm thấy ${found.productName || found.sku}` });
      } else {
        setError(`Không tìm thấy sản phẩm hoặc SKU "${q}".`);
      }
    } catch (e: any) {
      const msg = e?.message || `Không tìm thấy mã sản phẩm / SKU "${q}" trong kho.`;
      setError(msg);
      pushToast({ tone: "error", title: msg });
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedItems = resolvedItems.filter((it) => checkedIds.includes(it.variantId || it.maQuanLy));

  const handleApply = () => {
    if (!selectedItems.length) {
      pushToast({ tone: "warning", title: "Vui lòng chọn ít nhất 1 sản phẩm còn tồn kho để nạp vào hóa đơn." });
      return;
    }
    const ok = onLoad(selectedItems, mode === "session" ? data?.sessionId : undefined);
    if (!ok) {
      const msg = "Một số sản phẩm đã chọn không đủ tồn khả dụng trong kho.";
      setError(msg);
      pushToast({ tone: "error", title: msg });
    }
  };

  const handlePrintPdf = async () => {
    const itemsToPrint = selectedItems.length > 0 ? selectedItems : resolvedItems;
    if (!itemsToPrint.length || printing) return;
    setPrinting(true);
    try {
      const filename = await exportO2OPickingPdf(
        mode === "session" && data
          ? {
              sessionId: data.sessionId,
              customerName: data.customerName,
              customerPhone: data.customerPhone,
              score: data.total,
              advice: data.advice,
            }
          : {
              lookupLabel: `PHỐI ĐỒ THEO MÃ ${selectedVariant?.sku || productQuery.toUpperCase()}`,
            },
        itemsToPrint
      );
      pushToast({
        tone: "success",
        title: "Đã tải Phiếu Lấy Đồ Thử (PDF A5)",
        detail: `Đã lưu tự động vào Downloads: ${filename}`,
      });
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không thể xuất PDF phiếu lấy đồ thử",
        detail: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button
          type="button"
          variant={mode === "session" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setMode("session");
            setError("");
            setResolvedItems([]);
            setCheckedIds([]);
          }}
        >
          <ScanLine className="h-4 w-4" />
          Mã phiên VTON / SĐT khách
        </Button>
        <Button
          type="button"
          variant={mode === "product" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setMode("product");
            setError("");
            setResolvedItems([]);
            setCheckedIds([]);
          }}
        >
          <Package className="h-4 w-4" />
          Dự phòng: Mã SP / SKU + Gợi ý phối đồ
        </Button>
      </div>

      {mode === "session" ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookupSessionOrPhone();
          }}
        >
          <label className="space-y-1 text-xs font-semibold">
            Mã phiên thử đồ (hoặc dán QR Pass)
            <Input
              autoFocus
              aria-label="Mã phiên thử đồ"
              placeholder="VD: TD00000001 (hoặc bỏ trống nếu tra theo SĐT)"
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setError("");
              }}
              className="h-11 font-mono uppercase"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Số điện thoại khách hàng (tùy chọn)
            <Input
              aria-label="Số điện thoại khách hàng"
              placeholder="VD: 0912345678 (tra 5 phiên gần nhất)"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
              }}
              className="h-11 font-mono"
            />
          </label>
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Không cần máy quét QR: nhập mã phiên <code>TD...</code>, SĐT khách, hoặc chuyển tab nhập mã SP/SKU.
            </span>
            <Button type="submit" disabled={loading} className="h-10 gap-2 shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Tra cứu O2O
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookupProductOrSku();
          }}
        >
          <label className="block space-y-1 text-xs font-semibold">
            Mã sản phẩm (SP...), mã SKU, mã biến thể (BT...) hoặc tên sản phẩm
            <div className="flex gap-2">
              <Input
                autoFocus
                aria-label="Mã sản phẩm hoặc SKU"
                placeholder="VD: SP00000001, SKU-SM01-TRANG-M, BT00000001 hoặc Áo sơ mi..."
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setError("");
                }}
                className="h-11 flex-1 font-mono"
              />
              <Button type="submit" disabled={loading} className="h-11 gap-2 px-5 shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Tìm &amp; Gợi ý phối
              </Button>
            </div>
          </label>
          <p className="text-[11px] text-muted-foreground">
            Hệ thống tự tra vị trí kệ, tồn kho thật và gợi ý các món phối đạt điểm thẩm mỹ cao từ Rule Engine YoFaSo.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      {/* Session picker when searching by customer phone */}
      {mode === "session" && phoneSessions.length > 1 && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            5 phiên thử đồ VTON gần nhất ({phoneSessions.length} phiên) — bấm chọn để xem chi tiết:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {phoneSessions.map((s) => {
              const active = data?.sessionId === s.sessionId;
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => applySessionToView(s)}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
                    active
                      ? "border-accent bg-accent-subtle shadow-xs"
                      : "border-border bg-surface hover:border-accent/50"
                  }`}
                >
                  {s.productImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={catalogImage(s.productImageUrl)}
                      alt={s.productName || s.sessionId}
                      className="h-12 w-12 rounded-md border border-border object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-accent-hover">{s.sessionId}</p>
                    <p className="truncate text-xs font-semibold text-foreground">{s.productName || s.sku}</p>
                    <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Điểm: <b>{s.total}/100</b></span>
                      {s.createdAt && (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Variant switcher in Product/SKU fallback mode */}
      {mode === "product" && lookedUpProduct?.variants && lookedUpProduct.variants.length > 1 && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Chọn phân loại Size / Màu của {lookedUpProduct.productName} ({lookedUpProduct.variants.length} biến thể):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lookedUpProduct.variants.map((v) => {
              const isSelected = selectedVariant?.variantId === v.variantId;
              const stock = Number(v.stock ?? 0);
              return (
                <button
                  key={v.variantId}
                  type="button"
                  onClick={() => void loadRecommendationsForVariant(v)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : stock > 0
                      ? "border-border bg-surface hover:border-accent"
                      : "border-border bg-surface opacity-50"
                  }`}
                >
                  {v.colorName} · Size {v.size} ({stock > 0 ? `Còn ${stock}` : "Hết"})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Result Panel */}
      {((mode === "session" && data) || (mode === "product" && selectedVariant)) && (
        <div className="space-y-4 rounded-xl border border-accent bg-surface p-5">
          {mode === "session" && data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Phiên: <b>{data.sessionId}</b>
                    {data.customerName && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        · {data.customerName}
                        {data.customerPhone && (
                          <>
                            {" "}
                            <Phone className="h-3 w-3 inline" /> {data.customerPhone}
                          </>
                        )}
                      </span>
                    )}
                  </p>
                  <h3 className="text-base font-bold text-accent-hover">
                    Điểm thẩm mỹ VTON: {data.total}/100
                  </h3>
                </div>
                <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-bold text-success">
                  DỮ LIỆU THẬT TẠI QUẦY
                </span>
              </div>

              {data.advice && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-accent pl-3">
                  Stylist AI nhận xét: &ldquo;{data.advice}&rdquo;
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  Tra cứu dự phòng · SKU: <b>{selectedVariant?.sku}</b>
                </p>
                <h3 className="text-base font-bold text-foreground">
                  {selectedVariant?.productName || selectedVariant?.name}
                </h3>
              </div>
              <span className="rounded-full bg-accent-subtle px-3 py-1 text-xs font-bold text-accent-hover">
                {loadingRecs ? "Đang tính gợi ý AI…" : `${productRecs.length} gợi ý phối đồ`}
              </span>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Chọn sản phẩm nạp vào Hóa đơn POS ({selectedItems.length}/{resolvedItems.length} món)
              </h4>
              {resolvedItems.some((it) => it.ton > 0) && (
                <button
                  type="button"
                  className="text-xs font-semibold text-accent-hover hover:underline"
                  onClick={() => {
                    const avail = resolvedItems.filter((it) => it.ton > 0).map((it) => it.variantId || it.maQuanLy);
                    setCheckedIds(checkedIds.length === avail.length ? [] : avail);
                  }}
                >
                  {checkedIds.length === resolvedItems.filter((it) => it.ton > 0).length
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả món còn hàng"}
                </button>
              )}
            </div>

            {loadingRecs ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Đang tính toán gợi ý phối đồ &amp; vị trí kệ…
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {resolvedItems.map((item) => {
                  const id = item.variantId || item.maQuanLy;
                  const outOfStock = item.ton <= 0;
                  const checked = checkedIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                        outOfStock
                          ? "border-border bg-surface-muted opacity-60 cursor-not-allowed"
                          : checked
                          ? "border-accent bg-accent-subtle/40 cursor-pointer"
                          : "border-border bg-surface hover:border-accent/50 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={outOfStock}
                        checked={checked}
                        onChange={() => toggleItem(id)}
                        className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-foreground">{item.ten}</span>
                          {item.tag && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {item.tag}
                            </span>
                          )}
                          {item.projectedScore ? (
                            <span className="rounded-full bg-success-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-success">
                              Phối {item.projectedScore}/100
                            </span>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          Size {item.size} · {item.mau} · SKU: {item.sku}
                        </p>
                        {item.reason && (
                          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.reason}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-accent-hover">{vnd(item.donGia)}</p>
                        <p
                          className={`text-xs flex items-center gap-1 justify-end ${
                            outOfStock ? "text-destructive font-bold" : "text-muted-foreground"
                          }`}
                        >
                          <MapPin className="h-3 w-3" />
                          {item.shelf || "KHO-01"} · {outOfStock ? "Hết hàng" : `Còn ${item.ton}`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleApply} disabled={selectedItems.length === 0} className="flex-1 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Nạp {selectedItems.length} món đã chọn vào Hóa đơn POS
            </Button>
            <Button
              variant="outline"
              disabled={printing || resolvedItems.length === 0}
              onClick={() => void handlePrintPdf()}
              className="gap-2"
            >
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {printing ? "Đang tạo PDF…" : "Tải phiếu lấy đồ (PDF A5)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
