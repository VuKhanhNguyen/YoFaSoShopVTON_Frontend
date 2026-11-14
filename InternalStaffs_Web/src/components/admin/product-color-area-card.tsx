"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Minus, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge, Field, inputClass } from "@/components/admin/shared";
import {
  ALL_SIZES,
  VARIANT_STATUS_OPTIONS,
  buildSku,
  type KMeansColor,
  type VariantSize,
  type VariantStatus,
} from "@/lib/product-catalog-meta";

export interface AreaVariantRow {
  variantId?: string;
  size: VariantSize;
  sku: string;
  price: string;
  salePrice: string;
  stock: string;
  shelf: string;
  status: VariantStatus;
}

export interface ProductColorArea {
  areaId: string;
  imageId?: string;
  assetId: string;
  cutoutAssetId?: string | null;
  originalUrl: string;
  cutoutUrl?: string | null;
  colorName: string;
  dominantHex: string;
  palette: KMeansColor[];
  cover: boolean;
  materialNote?: string;
  variants: AreaVariantRow[];
}

interface ProductColorAreaCardProps {
  area: ProductColorArea;
  index: number;
  productName: string;
  shelfOptions: string[];
  onChange: (updated: ProductColorArea) => void;
  onRemoveArea: () => void;
  onDeletePersistedVariant?: (variantId: string) => Promise<boolean>;
  onRedetectColor?: () => Promise<void>;
}

export function ProductColorAreaCard({
  area,
  index,
  productName,
  shelfOptions,
  onChange,
  onRemoveArea,
  onDeletePersistedVariant,
  onRedetectColor,
}: ProductColorAreaCardProps) {
  const [showNoteOverride, setShowNoteOverride] = useState(Boolean(area.materialNote));
  const [customShelves, setCustomShelves] = useState<Record<number, boolean>>({});
  const [detecting, setDetecting] = useState(false);

  const checkedSizes = new Set(area.variants.map((v) => v.size));
  const totalAreaStock = area.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  const toggleSize = async (size: VariantSize, nextChecked: boolean) => {
    if (nextChecked) {
      if (checkedSizes.has(size)) return;
      const fallbackPrice = area.variants[0]?.price || "350000";
      const fallbackShelf = area.variants[0]?.shelf || shelfOptions[0] || "KE-F01";
      const nextRow: AreaVariantRow = {
        size,
        sku: buildSku(productName, area.colorName, size, area.variants.length + 1),
        price: fallbackPrice,
        salePrice: "",
        stock: "10",
        shelf: fallbackShelf,
        status: "DANG_BAN",
      };
      onChange({ ...area, variants: [...area.variants, nextRow] });
      return;
    }

    const existing = area.variants.find((v) => v.size === size);
    if (existing?.variantId && onDeletePersistedVariant) {
      const ok = await onDeletePersistedVariant(existing.variantId);
      if (!ok) return;
    }
    onChange({
      ...area,
      variants: area.variants.filter((v) => v.size !== size),
    });
  };

  const addNextAvailableSize = () => {
    const nextSize = ALL_SIZES.find((s) => !checkedSizes.has(s));
    if (nextSize) void toggleSize(nextSize, true);
  };

  const updateVariant = (rowIdx: number, patch: Partial<AreaVariantRow>) => {
    const next = area.variants.map((v, i) => (i === rowIdx ? { ...v, ...patch } : v));
    onChange({ ...area, variants: next });
  };

  const handleColorNameChange = (colorName: string) => {
    const updatedPalette = area.palette.length
      ? area.palette.map((c, idx) => (idx === 0 ? { ...c, name: colorName } : c))
      : [{ name: colorName, hex: area.dominantHex, share: 1 }];
    onChange({ ...area, colorName, palette: updatedPalette });
  };

  const handleHexChange = (hex: string) => {
    const normalized = hex.startsWith("#") ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
    const updatedPalette = area.palette.length
      ? area.palette.map((c, idx) => (idx === 0 ? { ...c, hex: normalized } : c))
      : [{ name: area.colorName, hex: normalized, share: 1 }];
    onChange({ ...area, dominantHex: normalized, palette: updatedPalette });
  };

  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      {/* Header Area: Ảnh gốc + Swatch màu đại diện (% cao nhất) */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-canvas">
            <img
              src={area.originalUrl}
              alt={`Ảnh sản phẩm màu ${area.colorName}`}
              className="h-full w-full object-cover"
            />
            {area.cover && (
              <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
                Ảnh bìa
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-accent-hover">
                Biến thể #{index + 1} · Nhóm màu
              </span>
              <Badge tone="neutral">
                {area.variants.length} size · {totalAreaStock} tồn
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Swatch màu đại diện với tỷ lệ % cao nhất */}
              <div className="flex items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-1.5">
                <input
                  type="color"
                  aria-label={`Chọn mã màu HEX cho Area ${index + 1}`}
                  value={/^#[0-9A-Fa-f]{6}$/.test(area.dominantHex) ? area.dominantHex : "#1F2937"}
                  onChange={(e) => handleHexChange(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border border-border bg-transparent p-0"
                />
                <span className="font-mono text-xs font-semibold text-foreground">
                  {area.dominantHex}
                </span>
                {area.palette[0] && (
                  <span className="text-[11px] text-muted-foreground">
                    ({Math.round(area.palette[0].share * 100)}% chủ đạo)
                  </span>
                )}
              </div>

              <input
                type="text"
                aria-label={`Tên màu Area ${index + 1}`}
                placeholder="Tên màu (VD: Kem, Đen, Xanh navy)"
                value={area.colorName}
                onChange={(e) => handleColorNameChange(e.target.value)}
                className={`${inputClass} w-48`}
                maxLength={100}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRedetectColor && (
            <Button
              variant="outline"
              size="sm"
              disabled={detecting || !area.assetId || area.assetId.startsWith("local-")}
              onClick={async () => {
                setDetecting(true);
                try {
                  await onRedetectColor();
                } finally {
                  setDetecting(false);
                }
              }}
              className="text-xs"
            >
              {detecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
              )}
              AI Quét lại màu
            </Button>
          )}
          <Button
            variant={area.cover ? "accent" : "outline"}
            size="sm"
            onClick={() => onChange({ ...area, cover: true })}
          >
            <Star className="h-3.5 w-3.5" />
            {area.cover ? "Đang là ảnh đại diện" : "Đặt làm ảnh đại diện"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-danger-subtle hover:text-destructive"
            onClick={onRemoveArea}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa ảnh
          </Button>
        </div>
      </div>

      {/* Tick chọn Size khả dụng */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            Chọn Size khả dụng cho màu <span className="text-accent-hover">{area.colorName || "này"}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={checkedSizes.size >= ALL_SIZES.length}
            onClick={addNextAvailableSize}
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm size
          </Button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {ALL_SIZES.map((size) => {
            const isChecked = checkedSizes.has(size);
            return (
              <label
                key={size}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isChecked
                    ? "border-primary bg-accent-subtle text-foreground"
                    : "border-border bg-canvas text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  aria-label={`Chọn size ${size} cho màu ${area.colorName}`}
                  onCheckedChange={(checked) => void toggleSize(size, checked)}
                />
                <span className="font-mono">{size}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Bảng nhập chi tiết biến thể cho các size đã tick */}
      {area.variants.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Mã SKU (Barcode)</th>
                <th>Số lượng tồn</th>
                <th>Giá niêm yết (đ)</th>
                <th>Giá khuyến mãi (đ)</th>
                <th>Vị trí giá kệ</th>
                <th>Trạng thái</th>
                <th className="text-right">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {area.variants.map((row, rowIdx) => {
                const isCustomShelf =
                  customShelves[rowIdx] ||
                  (row.shelf !== "" && !shelfOptions.includes(row.shelf));
                const priceNum = Number(row.price);
                const saleNum = Number(row.salePrice);
                const invalidSale =
                  row.salePrice.trim() !== "" &&
                  Number.isFinite(saleNum) &&
                  Number.isFinite(priceNum) &&
                  saleNum > priceNum;

                return (
                  <tr key={`${row.size}-${rowIdx}`}>
                    <td className="font-mono font-bold text-foreground">{row.size}</td>
                    <td>
                      <input
                        type="text"
                        aria-label={`Mã SKU size ${row.size}`}
                        value={row.sku}
                        onChange={(e) => updateVariant(rowIdx, { sku: e.target.value })}
                        className={`${inputClass} min-w-44 font-mono text-xs`}
                        maxLength={50}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`Số lượng tồn size ${row.size}`}
                        value={row.stock}
                        onChange={(e) => updateVariant(rowIdx, { stock: e.target.value })}
                        className={`${inputClass} w-24 font-mono`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        aria-label={`Giá niêm yết size ${row.size}`}
                        value={row.price}
                        onChange={(e) => updateVariant(rowIdx, { price: e.target.value })}
                        className={`${inputClass} w-32 font-mono`}
                      />
                    </td>
                    <td>
                      <div className="space-y-1">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="Không KM"
                          aria-label={`Giá khuyến mãi size ${row.size}`}
                          value={row.salePrice}
                          onChange={(e) => updateVariant(rowIdx, { salePrice: e.target.value })}
                          className={`${inputClass} w-32 font-mono ${
                            invalidSale ? "border-destructive focus:ring-destructive" : ""
                          }`}
                        />
                        {invalidSale && (
                          <p className="text-[10px] text-destructive">Không vượt giá niêm yết</p>
                        )}
                      </div>
                    </td>
                    <td>
                      {!isCustomShelf ? (
                        <select
                          aria-label={`Vị trí kệ size ${row.size}`}
                          className={`${inputClass} min-w-28 font-mono text-xs`}
                          value={shelfOptions.includes(row.shelf) ? row.shelf : ""}
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setCustomShelves((prev) => ({ ...prev, [rowIdx]: true }));
                              updateVariant(rowIdx, { shelf: "" });
                            } else {
                              updateVariant(rowIdx, { shelf: e.target.value });
                            }
                          }}
                        >
                          <option value="">-- Chọn kệ --</option>
                          {shelfOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          <option value="__CUSTOM__">+ Nhập vị trí khác…</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="VD: KE-F09"
                            aria-label={`Nhập vị trí kệ khác cho size ${row.size}`}
                            value={row.shelf}
                            onChange={(e) => updateVariant(rowIdx, { shelf: e.target.value })}
                            className={`${inputClass} w-28 font-mono text-xs`}
                            maxLength={50}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px]"
                            onClick={() => {
                              setCustomShelves((prev) => ({ ...prev, [rowIdx]: false }));
                              updateVariant(rowIdx, { shelf: shelfOptions[0] || "KE-F01" });
                            }}
                          >
                            Danh sách
                          </Button>
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={`Trạng thái SKU size ${row.size}`}
                        className={`${inputClass} min-w-28 text-xs`}
                        value={row.status}
                        onChange={(e) =>
                          updateVariant(rowIdx, { status: e.target.value as VariantStatus })
                        }
                      >
                        {VARIANT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa size ${row.size}`}
                        className="text-destructive hover:bg-danger-subtle hover:text-destructive"
                        onClick={() => void toggleSize(row.size, false)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border bg-canvas px-3 py-3 text-xs text-muted-foreground">
          Hãy tick ít nhất một size ở trên (hoặc bấm <strong>+ Thêm size</strong>) để nhập số lượng tồn, giá bán và vị trí giá kệ cho màu này.
        </p>
      )}

      {/* Ghi chú chất liệu / đặc thù riêng của màu (tùy chọn gọn theo Option A) */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowNoteOverride((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {showNoteOverride ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Ghi chú riêng cho phiên bản màu này (tùy chọn)
        </button>
        {showNoteOverride && (
          <div className="mt-2">
            <Field label="Ghi chú chất liệu / lưu ý phối màu riêng">
              <textarea
                rows={2}
                placeholder="VD: Màu trắng có thêm lớp lót chống xuyên thấu, giặt riêng lần đầu..."
                value={area.materialNote || ""}
                onChange={(e) => onChange({ ...area, materialNote: e.target.value })}
                className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        )}
      </div>
    </article>
  );
}

