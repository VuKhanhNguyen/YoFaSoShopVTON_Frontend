import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUDIT_ZONES, XNT, auditSummary, variance, LOW_STOCK_THRESHOLD, type AuditItem } from "@/lib/warehouse";
import { useResource } from "@/hooks/use-resource";
import { api, requestKey } from "@/lib/api";
import { pushToast } from "@/lib/feedback";

/** UC_WH_AUDIT + UC_WH_REPORT + UC_LOW_STOCK — Kiểm kê theo dãy kệ, báo cáo XNT, cảnh báo tồn tối thiểu. */
export function AuditReport({ onRefresh }: { onRefresh?: () => void }) {
  const { data: remoteZones, reload: reloadZones } = useResource<Record<string, { label: string; items: AuditItem[] }>>("/staff/inventory/audit-zones");
  const { data: remoteSummary, reload: reloadSummary } = useResource<{ tonDau: number; nhapMoi: number; xuatBan: number; tonCuoi: number }>("/staff/inventory/summary");
  const { data: remoteLows, reload: reloadLows } = useResource<any[]>("/staff/inventory/low-stock?threshold=5");

  const zones = remoteZones && Object.keys(remoteZones).length > 0 ? remoteZones : AUDIT_ZONES;
  const zoneKeys = Object.keys(zones);
  const [zone, setZone] = useState<string>(zoneKeys[0] ?? "A");

  useEffect(() => {
    if (zoneKeys.length > 0 && !zones[zone]) {
      setZone(zoneKeys[0]);
    }
  }, [zones, zoneKeys, zone]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const zoneData = zones[zone] ?? { label: "Dãy kệ", items: [] };
  const summary = useMemo(() => auditSummary(zoneData.items, counts), [zoneData, counts]);

  const xnt = remoteSummary ?? XNT;
  const lows = remoteLows ?? [];

  const setCount = (sku: string, v: string) => {
    const n = v === "" ? NaN : Math.max(0, Math.floor(Number(v)));
    setCounts((c) => ({ ...c, [sku]: n }));
  };

  const submit = async () => {
    if (summary.checked === 0 || (summary.mismatched > 0 && !reason.trim())) return;
    setSubmitting(true);
    let adjusted = 0;
    try {
      for (const item of zoneData.items) {
        const c = counts[item.sku];
        if (c !== undefined && !Number.isNaN(c)) {
          const diff = variance(item.book, c);
          if (diff !== 0 && item.variantId) {
            await api(
              "/staff/inventory/adjustments",
              "POST",
              { variantId: item.variantId, delta: diff, reason: reason.trim() },
              requestKey(),
            );
            adjusted++;
          }
        }
      }
      setSent(true);
      pushToast({
        tone: "success",
        title: adjusted > 0
          ? `Đã cập nhật ${adjusted} SKU chênh lệch và ghi sổ biến động kho thành công!`
          : "Kiểm kê trùng khớp hoàn toàn!",
      });
      reloadZones();
      reloadSummary();
      reloadLows();
      onRefresh?.();
    } catch (e: any) {
      pushToast({ tone: "error", title: e.message || "Không thể lưu phiếu điều chỉnh kiểm kê." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Kiểm kê theo dãy kệ */}
      <section className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <ClipboardCheck className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold">KIỂM KÊ KHO — {zoneData.label}</h2>
          <div className="ml-auto flex gap-2">
            {zoneKeys.map((z) => (
              <Button key={z} variant={zone === z ? "default" : "outline"} size="sm" aria-pressed={zone === z} onClick={() => { setZone(z); setSent(false); }} className="rounded-full">
                Dãy {z}
              </Button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Vị trí kệ</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">Tên hàng</th>
              <th className="px-3 py-2.5 text-right">Tồn sổ sách</th>
              <th className="px-3 py-2.5 text-center">Số thực đếm</th>
              <th className="px-3 py-2.5 text-right">Chênh lệch</th>
              <th className="px-4 py-2.5">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {zoneData.items.map((item) => {
              const c = counts[item.sku];
              const hasCount = c !== undefined && !Number.isNaN(c);
              const diff = hasCount ? variance(item.book, c) : null;
              return (
                <tr key={item.sku} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-xs">Kệ {item.ke}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-2.5">{item.ten} <span className="text-xs text-muted-foreground">({item.size} / {item.mau})</span></td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{item.book}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Số thực đếm ${item.sku}`}
                      value={hasCount ? c : ""}
                      onChange={(e) => setCount(item.sku, e.target.value)}
                      className="mx-auto block h-10 w-20 rounded-md border border-border bg-background text-center font-mono text-sm font-bold outline-none focus:border-primary"
                    />
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-bold ${diff === null ? "" : diff === 0 ? "text-success" : "text-destructive"}`}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-4 py-2.5">
                    {diff === null ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Chưa đếm</span>
                    ) : diff === 0 ? (
                      <span className="rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-bold text-success">Khớp 100%</span>
                    ) : (
                      <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-[11px] font-bold text-destructive">
                        {diff > 0 ? `Thừa ${diff}` : `Thiếu ${-diff}`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="space-y-3 border-t border-border p-4">
          <p className="text-sm">
            Tổng SKU đã kiểm: <b className="font-mono">{summary.checked}</b>/{zoneData.items.length} — Khớp:{" "}
            <b className="font-mono text-success">{summary.matched}</b> — Lệch:{" "}
            <b className="font-mono text-destructive">{summary.mismatched}</b>
            {summary.totalDiff !== 0 && <> (Tổng lệch: <b className="font-mono text-destructive">{summary.totalDiff > 0 ? `+${summary.totalDiff}` : summary.totalDiff}</b>)</>}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do giải trình: VD 1 áo polo size L bị rách khuy áo khi thử đồ tại shop đã chuyển kho hủy…"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {sent ? (
            <p className="flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Đã cập nhật số liệu kiểm kê và ghi sổ biến động kho thành công!
            </p>
          ) : (
            <Button
              disabled={summary.checked === 0 || (summary.mismatched > 0 && !reason.trim()) || submitting}
              onClick={submit}
              className="h-12 w-full gap-2 text-sm font-bold sm:w-auto sm:px-8"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Đang lưu…" : "GHI NHẬN KIỂM KÊ VÀO HỆ THỐNG"}
            </Button>
          )}
          {summary.mismatched > 0 && !reason.trim() && !sent && (
            <p className="text-xs text-warning">Có SKU lệch — bắt buộc nhập lý do giải trình trước khi gửi.</p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Báo cáo XNT */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">Báo cáo Xuất — Nhập — Tồn </h2>
          <div className="mt-4 flex items-end justify-around gap-3">
            {[
              { label: "Tồn đầu kỳ", value: xnt.tonDau, cls: "bg-primary" },
              { label: "Nhập mới", value: xnt.nhapMoi, cls: "bg-success" },
              { label: "Xuất bán", value: xnt.xuatBan, cls: "bg-warning" },
              { label: "Tồn cuối kỳ", value: xnt.tonCuoi, cls: "bg-accent" },
            ].map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-sm font-bold">{b.value}</span>
                <div
                  className={`w-full max-w-16 rounded-t-md ${b.cls}`}
                  style={{
                    height: `${Math.max(16, Math.min(140, Math.round(((b.value || 1) / Math.max(xnt.tonDau || 1, xnt.tonCuoi || 1, 100)) * 120)))}px`,
                  }}
                />
                <span className="text-center text-[11px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Số liệu tự động đối soát từ sổ cái biến động kho BienDongKho và bảng tồn kho BienTheSanPham.
          </p>
        </section>

        {/* Cảnh báo tồn tối thiểu */}
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Cảnh báo tồn tối thiểu (≤ {LOW_STOCK_THRESHOLD} chiếc)
          </h2>
          <ul className="mt-3 space-y-2">
            {lows.map((p: any) => {
              const name = p.productName || p.name || p.ten || "Sản phẩm";
              const sku = p.sku || p.barcode || p.variantId;
              const size = p.size || p.kichCo || "M";
              const stock = p.stock ?? p.ton ?? p.quantity ?? 0;
              return (
                <li key={sku} className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{name} (Size {size})</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{sku}</p>
                  </div>
                  <span className="text-right">
                    <span className="block font-mono text-sm font-bold text-warning">Còn {stock}</span>
                    <span className="block text-[11px] text-muted-foreground">Ngưỡng an toàn: {LOW_STOCK_THRESHOLD}</span>
                  </span>
                </li>
              );
            })}
            {lows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Không có SKU nào dưới ngưỡng an toàn.</p>}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Danh sách biến thể cần bổ sung hàng lấy trực tiếp.</p>
        </section>
      </div>
    </div>
  );
}
