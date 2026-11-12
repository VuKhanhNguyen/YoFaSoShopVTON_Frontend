"use client";

import { useState } from "react";
import { MapPin, Printer, Sparkles, ScanLine, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { BienThe } from "@/lib/pos";

export function O2O({
  products,
  onLoad,
  onPrint,
}: {
  products: BienThe[];
  onLoad: (set: BienThe[]) => boolean;
  onPrint: () => void;
}) {
  const [sessionId, setSessionId] = useState("TD00000001");
  const [phone, setPhone] = useState("0912345678");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    sessionId: string;
    variantId: string;
    status: string;
    total: number;
    advice: string;
    recommendations: { recommendationId: string; variantId: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [resolvedItems, setResolvedItems] = useState<BienThe[]>([]);

  const lookup = async () => {
    const cleanSession = sessionId.trim().toUpperCase();
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (!cleanSession || !cleanPhone) {
      setError("Vui lòng nhập cả mã phiên thử đồ (VD: TD00000001) và số điện thoại khách.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    setResolvedItems([]);
    try {
      const res = await api<{
        sessionId: string;
        variantId: string;
        status: string;
        total: number;
        advice: string;
        recommendations: { recommendationId: string; variantId: string; reason: string }[];
      }>(`/pos/try-on/sessions/${encodeURIComponent(cleanSession)}?phone=${encodeURIComponent(cleanPhone)}`);

      if (res && res.sessionId) {
        setData(res);
        // Resolve variants from database
        const variantIds = [res.variantId, ...(res.recommendations || []).map((r) => r.variantId)];
        const items: BienThe[] = [];
        for (const vid of variantIds) {
          try {
            const v = await api<any>(`/staff/variants/by-sku?sku=${encodeURIComponent(vid)}`);
            if (v && (v.variantId || v.sku)) {
              items.push({
                variantId: v.variantId || vid,
                maQuanLy: v.sku || vid,
                sku: v.sku || vid,
                productId: v.productId,
                ten: v.productName || v.name || "Sản phẩm O2O",
                size: v.size || "M",
                mau: v.colorName || "Chuẩn",
                donGia: Number(v.salePrice || v.price) || 350000,
                ton: Number(v.stock) || 10,
                shelf: v.shelf || "Kệ A1",
              });
            }
          } catch {
            // fallback
            const local = products.find((p) => p.variantId === vid || p.sku === vid);
            if (local) items.push(local);
          }
        }
        setResolvedItems(items);
      } else {
        setError("Không tìm thấy phiên thử đồ tương ứng trong hệ thống.");
      }
    } catch {
      setError("Phiên thử đồ không tồn tại hoặc sai số điện thoại khách hàng.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!resolvedItems.length) return;
    const ok = onLoad(resolvedItems);
    if (!ok) setError("Một số sản phẩm trong set đồ không đủ tồn khả dụng trong kho.");
  };

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <label className="space-y-1 text-xs font-semibold">
          Mã phiên thử đồ (Pass)
          <Input
            autoFocus
            aria-label="Mã phiên thử đồ"
            placeholder="TD00000001"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setData(null);
              setError("");
            }}
            className="h-11 font-mono uppercase"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Số điện thoại khách hàng
          <Input
            aria-label="Số điện thoại khách hàng"
            placeholder="0912345678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setData(null);
              setError("");
            }}
            className="h-11 font-mono"
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="button" disabled={loading} onClick={lookup} className="h-10 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Tra cứu phiên O2O
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-4 rounded-xl border border-accent bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">Phiên: {data.sessionId}</p>
              <h3 className="text-base font-bold text-accent-hover">Điểm thẩm mỹ VTON: {data.total}/100</h3>
            </div>
            <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-bold text-success">
              ĐÃ XÁC THỰC TẠI QUẦY
            </span>
          </div>

          {data.advice && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-accent pl-3">
              Stylist AI nhận xét: "{data.advice}"
            </p>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Danh sách sản phẩm trong set đồ ({resolvedItems.length} món)
            </h4>
            <div className="space-y-2">
              {resolvedItems.map((item) => (
                <div
                  key={item.variantId || item.maQuanLy}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{item.ten}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Size {item.size} · {item.mau} · SKU: {item.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-accent-hover">{item.donGia.toLocaleString("vi-VN")} đ</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <MapPin className="h-3 w-3" />
                      {item.shelf || "Kệ trưng bày"} · Còn {item.ton}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleApply} className="flex-1 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Nạp toàn bộ set đồ vào Hóa đơn POS
            </Button>
            <Button variant="outline" onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" />
              In phiếu lấy đồ thử
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
