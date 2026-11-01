"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MapPin, Printer, Sparkles, ScanLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(false);
  const [error, setError] = useState("");
  const set = products.filter((p) => ["O2O-SILK-M", "O2O-PANTS-M"].includes(p.maQuanLy));
  const loadRef = useRef({ found, set, onLoad });
  loadRef.current = { found, set, onLoad };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const state = loadRef.current;
      if (e.key === "Enter" && state.found && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (!state.onLoad(state.set)) setError("Set đồ không đủ tồn khả dụng; chưa thêm món nào vào đơn.");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const lookup = () => {
    const hit = ["TD00000001", "0912345789"].includes(query.trim().toUpperCase());
    setFound(hit);
    setError(hit ? "" : "Không tìm thấy phiên thử đồ.");
  };

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <Input
          autoFocus
          aria-label="Mã phiên thử đồ"
          placeholder="TD00000001 / Số điện thoại 0912345789"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFound(false);
            setError("");
          }}
          className="h-12 font-mono text-base"
        />
        <Button className="h-12 px-5 gap-2" type="submit">
          <ScanLine className="h-4 w-4" />
          Tra cứu
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      {!found && !error && (
        <p className="text-sm text-muted-foreground">
          Mã phiên mẫu tra cứu: <span className="font-mono text-foreground font-semibold">TD00000001</span>
        </p>
      )}

      {found && (
        <>
          <div className="grid gap-5 md:grid-cols-[2fr_3fr]">
            <div>
              <div className="relative max-h-96 w-full overflow-hidden rounded-xl bg-muted border border-border">
                <Image
                  src="/assets/vton-fitting.jpg"
                  alt="Ảnh thử đồ mẫu VTON: áo lụa trắng và quần suông đen"
                  width={768}
                  height={1024}
                  className="max-h-96 w-full object-contain"
                />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-success-subtle p-3 text-success border border-success/30">
                <span className="font-mono text-2xl font-bold">94/100</span>
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  RECOMMENDED
                </span>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-bold">Vị trí lấy đồ tại quầy YoFaSo</h2>
              {set.map((p, i) => (
                <div key={p.maQuanLy} className="space-y-1.5 border-b border-border py-3">
                  <h3 className="text-base font-semibold">{p.ten}</h3>
                  <p className="text-xs text-muted-foreground">
                    Size <b className="text-foreground">{p.size}</b> · Màu <b className="text-foreground">{p.mau}</b>
                  </p>
                  <p className="flex items-center gap-2 font-mono text-base font-bold text-accent-hover">
                    <MapPin className="h-4 w-4" />
                    {i === 0 ? "Kệ Áo A-01" : "Kệ Quần B-03"} · Tầng {i === 0 ? 2 : 1}
                  </p>
                  <p className={p.ton > 0 ? "text-xs font-semibold text-success" : "text-xs font-semibold text-destructive"}>
                    {p.ton > 0 ? `✓ Tồn tại quầy: ${p.ton} chiếc` : "Hết hàng"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <section className="space-y-2 rounded-xl border border-accent bg-accent-subtle p-4">
            <h3 className="flex items-center gap-2 font-bold text-accent-hover">
              <Sparkles className="h-4 w-4" />
              Kịch bản tư vấn AI Stylist
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Set đồ đạt 94 điểm nhờ phối màu Đen–Trắng kinh điển và tỉ lệ 1/3–2/3. Gợi ý khách lấy thêm Thắt lưng da bản nhỏ màu đen (Kệ Phụ kiện C-01) để nhấn eo rõ nét hơn!
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" />
              In phiếu lấy đồ thử
            </Button>
            <Button
              className="h-auto min-h-12 flex-1 whitespace-normal py-3 text-sm font-bold"
              onClick={() => {
                if (!onLoad(set)) setError("Set đồ không đủ tồn khả dụng; chưa thêm món nào vào đơn.");
              }}
            >
              Nạp toàn bộ set đồ vào hóa đơn (Enter)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
