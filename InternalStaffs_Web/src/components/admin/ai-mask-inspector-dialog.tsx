"use client";

import { useState } from "react";
import { RefreshCw, ScanEye, Sparkles, ZoomIn } from "lucide-react";
import { catalogImage } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, inputClass } from "@/components/admin/shared";
import {
  DEEPFASHION2_SUBTYPES,
  SAMPLE_INSPECTOR_ITEMS,
  VTON_CATEGORY_OPTIONS,
  labelFor,
  type KMeansColor,
  type VtonCategory,
} from "@/lib/product-catalog-meta";

export interface InspectorImageItem {
  id: string;
  label: string;
  colorName: string;
  dominantHex: string;
  palette: KMeansColor[];
  originalUrl: string;
  cutoutUrl?: string | null;
  maskUrl?: string | null;
  r2CutoutKey?: string | null;
  r2MaskKey?: string | null;
  predictedVton?: VtonCategory;
  predictedSubtype?: string;
  bodyPositionNote?: string;
  confidence?: string;
  isSampleFallback?: boolean;
}

interface AiMaskInspectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string | null;
  productName: string;
  vtonCategory: VtonCategory;
  subtype: string;
  items: InspectorImageItem[];
  referenceUrl?: string | null;
  analyzing?: boolean;
  analysisMessage?: string | null;
  onQuickUpdateVton: (vtonCategory: VtonCategory, subtype: string) => Promise<void> | void;
  onReanalyze?: () => Promise<void> | void;
}

export function AiMaskInspectorDialog({
  open,
  onOpenChange,
  productId,
  productName,
  vtonCategory,
  subtype,
  items,
  referenceUrl,
  analyzing = false,
  analysisMessage,
  onQuickUpdateVton,
  onReanalyze,
}: AiMaskInspectorDialogProps) {
  const resolvedItems: InspectorImageItem[] =
    items.length > 0
      ? items.map((item, idx) => {
          const fallback = SAMPLE_INSPECTOR_ITEMS[idx % SAMPLE_INSPECTOR_ITEMS.length];
          const isSampleItem = item.originalUrl.includes("/assets/samples/");
          const hasLiveCutout = Boolean(item.cutoutUrl && !item.cutoutUrl.includes("/assets/samples/"));
          const hasLiveMask = Boolean(item.maskUrl && !item.maskUrl.includes("/assets/samples/"));
          return {
            ...item,
            cutoutUrl: item.cutoutUrl || (isSampleItem ? fallback.cutoutUrl : null),
            maskUrl: item.maskUrl || (isSampleItem ? fallback.maskUrl : null),
            r2CutoutKey: item.r2CutoutKey || (isSampleItem ? fallback.r2CutoutKey : null),
            r2MaskKey: item.r2MaskKey || (isSampleItem ? fallback.r2MaskKey : null),
            predictedVton: item.predictedVton ?? vtonCategory,
            predictedSubtype: item.predictedSubtype ?? subtype,
            bodyPositionNote: item.bodyPositionNote ?? (isSampleItem ? fallback.bodyPositionNote : undefined),
            confidence: item.confidence ?? (isSampleItem ? fallback.confidence : undefined),
            isSampleFallback: isSampleItem || (!hasLiveCutout && !hasLiveMask),
          };
        })
      : SAMPLE_INSPECTOR_ITEMS.map((s) => ({ ...s, isSampleFallback: true }));

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const contextKey = `${open}-${productId ?? "new"}-${vtonCategory}-${subtype}`;
  const [draftOverride, setDraftOverride] = useState<{
    key: string;
    vton: VtonCategory;
    subtype: string;
  } | null>(null);
  const draftVton = draftOverride?.key === contextKey ? draftOverride.vton : vtonCategory;
  const draftSubtype = draftOverride?.key === contextKey ? draftOverride.subtype : subtype;
  const [savingVton, setSavingVton] = useState(false);

  const safeIndex = selectedIndex < resolvedItems.length ? selectedIndex : 0;
  const current = resolvedItems[safeIndex] ?? resolvedItems[0];

  const handleApplyVton = async (nextVton: VtonCategory, nextSubtype: string) => {
    setSavingVton(true);
    try {
      await onQuickUpdateVton(nextVton, nextSubtype);
    } finally {
      setSavingVton(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-24px)] max-w-6xl p-6">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info" className="gap-1">
              <ScanEye className="h-3.5 w-3.5" />
              Ctrl + M · AI Vision Inspector
            </Badge>
            <Badge tone={analyzing ? "info" : current?.isSampleFallback ? "warning" : "success"}>
              {analyzing
                ? "Đang chạy bóc tách GPU realtime..."
                : current?.isSampleFallback
                ? "Chưa có bóc tách (GPU chưa chạy)"
                : "Kết quả AI & R2 thực tế"}
            </Badge>
            {productId && (
              <span className="font-mono text-xs text-muted-foreground">{productId}</span>
            )}
          </div>
          <DialogTitle className="mt-2 font-editorial text-2xl">
            Kiểm định bóc tách nền &amp; Agnostic Mask — {productName || "Sản phẩm mới"}
          </DialogTitle>
          <DialogDescription>
            Khu vực dành riêng cho kỹ thuật &amp; chủ shop kiểm tra ảnh PNG xóa phông, mặt nạ VTON
            (Agnostic Mask) và nhãn nhận diện của model trước khi công bố.
          </DialogDescription>
        </DialogHeader>

        {/* Thanh chuyển ảnh + Zoom + Chạy lại AI */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-canvas p-3">
          <div className="flex flex-wrap items-center gap-2">
            {resolvedItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  idx === safeIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary"
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border"
                  style={{ backgroundColor: item.dominantHex }}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ZoomIn className="h-3.5 w-3.5" />
              <span>Phóng {zoom}%</span>
              <input
                type="range"
                min={100}
                max={220}
                step={10}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 accent-primary"
              />
            </label>
            {onReanalyze && (
              <Button
                variant="outline"
                size="sm"
                disabled={analyzing}
                onClick={() => void onReanalyze()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />
                {analyzing ? "Đang gửi AI…" : "Chạy lại AI bóc tách"}
              </Button>
            )}
          </div>
        </div>

        {analysisMessage && (
          <div className="rounded-md border border-border bg-accent-subtle px-3 py-2 text-xs text-foreground">
            {analysisMessage}
          </div>
        )}

        {/* 3 khung so sánh: Ảnh gốc | PNG bóc tách nền | Agnostic Mask */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Panel 1: Ảnh gốc */}
          <div className="flex flex-col rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">1. Ảnh sản phẩm gốc</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {current.colorName}
              </span>
            </div>
            <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-md border border-border bg-canvas">
              <img
                src={current.originalUrl}
                alt={`Ảnh gốc ${current.label}`}
                className="h-full w-full object-contain transition-transform"
                style={{ transform: `scale(${zoom / 100})` }}
              />
              {referenceUrl && (
                <div className="absolute bottom-2 right-2 overflow-hidden rounded-md border border-border bg-surface/95 p-1 shadow-sm">
                  <img
                    src={referenceUrl}
                    alt="Ảnh mẫu tham chiếu"
                    className="h-12 w-10 rounded object-cover"
                  />
                  <span className="block text-center text-[9px] font-semibold text-muted-foreground">
                    Mẫu ref
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Màu sắc: {current.colorName}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {current.dominantHex}
                </span>
              </div>
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={current.originalUrl || ""}>
                Gốc: {current.originalUrl.split("/").pop()}
              </p>
            </div>
          </div>

          {/* Panel 2: PNG Bóc tách nền + Dự đoán category/body tách khỏi ảnh */}
          <div className="flex flex-col rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-success">
                2. Ảnh PNG bóc tách nền (R2)
              </span>
              <Badge tone="info" className="text-[10px]">
                YOLOv8s-seg
              </Badge>
            </div>
            <div className="admin-checkerboard relative flex h-64 items-center justify-center overflow-hidden rounded-md border border-border">
              {analyzing ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Đang bóc tách nền YOLOv8s-seg + SAM 2 trên GPU...
                  </span>
                </div>
              ) : current.cutoutUrl ? (
                <img
                  src={catalogImage(current.cutoutUrl)}
                  alt={`Ảnh bóc tách nền ${current.label}`}
                  className="h-full w-full object-contain transition-transform"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <span className="text-xs text-muted-foreground">Chưa có ảnh bóc tách</span>
                  {onReanalyze && (
                    <Button size="sm" variant="outline" onClick={() => void onReanalyze()}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Chạy bóc tách GPU
                    </Button>
                  )}
                </div>
              )}
            </div>
            {/* Nhãn nhận diện model đặt bên ngoài để không đè lên ảnh bóc tách */}
            <div className="mt-2.5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Model đoán VTON:{" "}
                  {labelFor(VTON_CATEGORY_OPTIONS, current.predictedVton ?? vtonCategory)}
                </span>
                <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold text-foreground ring-1 ring-border">
                  Tiểu loại:{" "}
                  {labelFor(DEEPFASHION2_SUBTYPES, current.predictedSubtype ?? subtype)}
                </span>
              </div>
              {current.confidence && (
                <div className="text-[10px] text-muted-foreground">
                  Độ tin cậy: <strong className="text-foreground">{current.confidence}</strong>
                </div>
              )}
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={current.r2CutoutKey || ""}>
                R2: {current.r2CutoutKey}
              </p>
            </div>
          </div>

          {/* Panel 3: Agnostic Mask + Body/VTON tách khỏi ảnh */}
          <div className="flex flex-col rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                3. Agnostic Mask (Vùng thay đồ)
              </span>
              <Badge tone="neutral" className="text-[10px]">
                OOTDiffusion
              </Badge>
            </div>
            <div className="admin-checkerboard relative flex h-64 items-center justify-center overflow-hidden rounded-md border border-border">
              {analyzing ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Đang tạo Agnostic Mask VTON...
                  </span>
                </div>
              ) : current.maskUrl ? (
                <img
                  src={catalogImage(current.maskUrl)}
                  alt={`Agnostic Mask ${current.label}`}
                  className="h-full w-full object-contain transition-transform"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              ) : current.cutoutUrl ? (
                <img
                  src={catalogImage(current.cutoutUrl)}
                  alt={`Agnostic Mask preview ${current.label}`}
                  className="h-full w-full object-contain opacity-50 grayscale transition-transform"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <span className="text-xs text-muted-foreground">Chưa có Agnostic Mask</span>
                </div>
              )}
            </div>
            {/* Nhãn nhận diện body đặt bên ngoài để không đè lên mask */}
            <div className="mt-2.5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Phân loại body: {labelFor(VTON_CATEGORY_OPTIONS, current.predictedVton ?? vtonCategory)}
                </span>
              </div>
              {current.bodyPositionNote && (
                <div className="text-[10px] text-muted-foreground">
                  Tỉ lệ body mẫu: <strong className="text-foreground">{current.bodyPositionNote}</strong>
                </div>
              )}
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={current.r2MaskKey || ""}>
                Mask: {current.r2MaskKey}
              </p>
            </div>
          </div>
        </div>

        {/* Hàng dưới: Bảng màu K-Means + Điều chỉnh nhanh phân loại VTON */}
        <div className="grid gap-4 rounded-lg border border-border bg-canvas p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Bảng màu trích xuất K-Means (lưu đủ danh sách vào <code className="font-mono">BangMauTrichXuat</code>)
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {current.palette.map((c, idx) => (
                <div
                  key={`${c.hex}-${idx}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-border"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div>
                    <span className="font-semibold capitalize">{c.name}</span>{" "}
                    <span className="font-mono text-[11px] text-muted-foreground">{c.hex}</span>
                    <span className="ml-1.5 font-mono text-[11px] font-semibold text-accent-hover">
                      {Math.round(c.share * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
              Chỉnh nhanh phân loại VTON &amp; Tiểu loại DeepFashion2
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Phân loại VTON nhanh"
                className={inputClass}
                value={draftVton}
                onChange={(e) => {
                  const next = e.target.value as VtonCategory;
                  const firstMatch = DEEPFASHION2_SUBTYPES.find((s) => s.vtonCategory === next);
                  setDraftOverride({
                    key: contextKey,
                    vton: next,
                    subtype: firstMatch ? firstMatch.value : draftSubtype,
                  });
                }}
              >
                {VTON_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tiểu loại trang phục nhanh"
                className={inputClass}
                value={draftSubtype}
                onChange={(e) =>
                  setDraftOverride({
                    key: contextKey,
                    vton: draftVton,
                    subtype: e.target.value,
                  })
                }
              >
                {DEEPFASHION2_SUBTYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2.5 flex justify-end">
              <Button
                size="sm"
                disabled={savingVton}
                onClick={() => void handleApplyVton(draftVton, draftSubtype)}
              >
                {savingVton ? "Đang áp dụng…" : "Áp dụng phân loại mới"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

