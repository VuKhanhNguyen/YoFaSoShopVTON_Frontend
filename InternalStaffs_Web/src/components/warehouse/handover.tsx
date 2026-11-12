import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PackageCheck, RotateCcw, ScanBarcode, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type WhOrder } from "@/lib/warehouse";
import { vnd } from "@/lib/pos";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { pushToast } from "@/lib/feedback";

interface ShipperItem {
  id: string;
  name: string;
  phone: string;
  route: string;
}

const DEFAULT_SHIPPERS: ShipperItem[] = [
  { id: "ND00000013", name: "Nguyễn Văn Hùng", phone: "0912345678", route: "Tuyến Quận Hải Châu, Đà Nẵng" },
  { id: "ND00000014", name: "Lê Văn Hải", phone: "0923456789", route: "Tuyến Quận Thanh Khê, Đà Nẵng" },
];

const CHECKLIST = [
  "Hộp niêm phong còn nguyên vẹn?",
  "Quần áo còn nguyên tem thẻ bài và túi zip?",
  "Vải không dơ bẩn, không có mùi lạ?",
] as const;

/** UC_LOG_HANDOVER + UC_LOG_RETURN — Bàn giao kiện hàng cho shipper & tiếp nhận hàng hoàn về kho. */
export function HandoverReturn({
  orders,
  onRefresh,
}: {
  orders: WhOrder[];
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<"handover" | "return">("handover");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "handover" ? "default" : "outline"} aria-pressed={tab === "handover"} onClick={() => setTab("handover")} className="h-11 rounded-full px-5">
          <Truck className="h-4 w-4" /> Bàn giao kiện hàng cho Shipper
        </Button>
        <Button variant={tab === "return" ? "default" : "outline"} aria-pressed={tab === "return"} onClick={() => setTab("return")} className="h-11 rounded-full px-5">
          <RotateCcw className="h-4 w-4" /> Tiếp nhận hàng hoàn về kho
        </Button>
      </div>
      {tab === "handover" ? <Handover orders={orders} onRefresh={onRefresh} /> : <ReturnIntake orders={orders} onRefresh={onRefresh} />}
    </div>
  );
}

function Handover({
  orders,
  onRefresh,
}: {
  orders: WhOrder[];
  onRefresh?: () => void;
}) {
  const { data: dbShippers } = useResource<ShipperItem[]>("/staff/shippers");
  const shippers = dbShippers && dbShippers.length > 0 ? dbShippers : DEFAULT_SHIPPERS;

  const ready = orders.filter(
    (o) =>
      o.status === "CHO_SHIPPER" ||
      (o.status === "DANG_DONG_GOI" && (!o.shipperId || o.shipper === "Chưa phân công")),
  );
  const [shipper, setShipper] = useState<string>(shippers[0]?.id ?? "ND00000013");
  const [code, setCode] = useState("");
  const [scanned, setScanned] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shippers[0]?.id && !shippers.some((s) => s.id === shipper)) {
      setShipper(shippers[0].id);
    }
  }, [shippers, shipper]);

  useEffect(() => { scanRef.current?.focus(); }, []);

  const scan = async () => {
    const raw = code.trim();
    if (!raw) return;
    const c = raw.toUpperCase().replace(/^#/, "").replace(/^YFS/, "");
    const numericId = c.match(/^\d+$/) ? `DH${c.padStart(8, "0")}` : "";

    // 1. Tìm trong danh sách chờ bàn giao theo mã đơn, đuôi mã đơn, hoặc mã SKU / Barcode
    let matched = ready.filter((o) => {
      const matchId =
        o.id.toUpperCase() === c ||
        o.id.toUpperCase().endsWith(c) ||
        (numericId && o.id.toUpperCase() === numericId);
      const matchSku = o.lines?.some(
        (l) =>
          l.sku?.toUpperCase() === c ||
          l.barcode?.toUpperCase() === c ||
          l.sku?.toUpperCase().includes(c) ||
          l.barcode?.toUpperCase().includes(c)
      );
      return matchId || matchSku;
    });

    // 2. Nếu chưa thấy ở danh sách cục bộ, tra cứu qua API /staff/orders/{c}
    if (matched.length === 0) {
      try {
        const remoteOrder = await api<WhOrder>(`/staff/orders/${c}`);
        if (remoteOrder && remoteOrder.id) {
          const inReady = ready.find((o) => o.id === remoteOrder.id);
          if (inReady) {
            matched = [inReady];
          } else {
            setError(
              `Đơn hàng #${remoteOrder.id} hiện ở trạng thái "${remoteOrder.status}", không phải trạng thái sẵn sàng bàn giao cho Shipper.`
            );
            setCode("");
            scanRef.current?.focus();
            return;
          }
        }
      } catch {
        // bỏ qua nếu không tìm thấy trên remote
      }
    }

    if (matched.length === 0) {
      setError(`Không tìm thấy kiện hàng nào khớp với "${raw}" (mã đơn hoặc mã SKU/Barcode) trong danh sách chờ bàn giao.`);
    } else {
      const unScanned = matched.filter((o) => !scanned.includes(o.id));
      if (unScanned.length === 0) {
        setError(`Tất cả kiện hàng khớp với "${raw}" (${matched.map((m) => `#${m.id}`).join(", ")}) đều đã được thêm trước đó.`);
      } else {
        const newlyAdded = unScanned.map((o) => o.id);
        setScanned((ds) => [...ds, ...newlyAdded]);
        setError("");
        pushToast({
          tone: "success",
          title: `Đã nạp ${newlyAdded.length} kiện (#${newlyAdded.join(", #")}) vào lô bàn giao`,
        });
      }
    }
    setCode("");
    scanRef.current?.focus();
  };

  const scannedOrders = ready.filter((o) => scanned.includes(o.id));
  const shipperInfo = shippers.find((s) => s.id === shipper) ?? shippers[0];

  const confirm = async () => {
    if (scanned.length === 0) return;
    setSaving(true);
    let successCount = 0;
    for (const id of scanned) {
      try {
        await api(`/staff/orders/${id}/assign`, "POST", { shipperId: shipper });
        successCount++;
      } catch (e: any) {
        console.error(e);
      }
    }
    setSaving(false);
    setConfirmed(true);
    pushToast({
      tone: "success",
      title: `Đã bàn giao ${successCount} kiện cho ${shipperInfo.name}!`,
    });
    onRefresh?.();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Chọn nhân viên Shipper nội bộ</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {shippers.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={shipper === s.id}
              onClick={() => setShipper(s.id)}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${shipper === s.id ? "border-primary bg-accent-subtle" : "border-border bg-surface hover:border-accent"}`}
            >
              <p className="text-sm font-bold">{s.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">MaNguoiGiaoHang: {s.id} · Tuyến: {s.route}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quét mã vạch hoặc nhập mã SKU / mã đơn hàng bàn giao</p>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              ref={scanRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scan()}
              placeholder="Quét mã vạch hoặc nhập mã SKU, mã vạch hoặc mã đơn hàng… (VD: DH00000001, 1, SKU-001)"
              disabled={confirmed}
              className="h-12 w-full rounded-md border-2 border-primary bg-muted pl-11 pr-4 font-mono text-sm outline-none focus:bg-surface disabled:opacity-50"
            />
          </div>
          <Button
            type="button"
            disabled={confirmed || !code.trim()}
            onClick={scan}
            className="h-12 px-6 font-bold shrink-0"
          >
            Thêm kiện
          </Button>
        </div>
        {error && <p role="alert" className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span>Kiện chờ bàn giao:</span>
          {ready.length === 0 && <span>Không còn kiện chờ bàn giao</span>}
          {ready.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                if (!scanned.includes(o.id)) {
                  setScanned((ds) => [...ds, o.id]);
                  setError("");
                }
              }}
              className="rounded bg-muted px-1.5 py-0.5 text-primary hover:bg-accent-subtle hover:underline font-bold"
            >
              #{o.id}
            </button>
          ))}
        </div>

        {scannedOrders.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Mã đơn</th><th className="px-3 py-2">Người nhận</th><th className="px-3 py-2 text-right">Tiền thu hộ COD</th><th className="px-3 py-2 text-right">Trạng thái</th></tr>
            </thead>
            <tbody>
              {scannedOrders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-bold">#{o.id}</td>
                  <td className="px-3 py-2">{o.receiver}</td>
                  <td className="px-3 py-2 text-right font-mono">{o.cod > 0 ? vnd(o.cod) : "0 đ"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">Sẵn sàng bàn giao</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {confirmed ? (
          <p className="mt-4 flex items-center gap-2 rounded-md bg-success-subtle px-3 py-3 text-sm font-bold text-success">
            <CheckCircle2 className="h-5 w-5" />
            Đã bàn giao {scanned.length} kiện cho {shipperInfo.name} — toàn bộ đơn đã chuyển sang ĐANG GIAO HÀNG.
          </p>
        ) : (
          <Button variant="success" disabled={scanned.length === 0 || saving} onClick={confirm} className="mt-4 h-14 w-full gap-2 text-base font-bold">
            <PackageCheck className="h-5 w-5" />
            {saving ? "Đang lưu…" : `XÁC NHẬN BÀN GIAO ${scanned.length} KIỆN HÀNG CHO SHIPPER (ENTER)`}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReturnIntake({
  orders,
  onRefresh,
}: {
  orders: WhOrder[];
  onRefresh?: () => void;
}) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<WhOrder | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [decision, setDecision] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const returnableOrders = orders.filter(
    (o) => o.status === "TRA_HANG" || o.status === "DANG_GIAO_HANG" || o.status === "CHO_SHIPPER"
  );

  const scan = async (explicitCode?: string) => {
    const raw = (explicitCode ?? code).trim();
    if (!raw) return;
    const c = raw.toUpperCase().replace(/^#/, "").replace(/^YFS/, "");
    const numericId = c.match(/^\d+$/) ? `DH${c.padStart(8, "0")}` : "";

    setError("");
    setDecision(null);
    setChecks([false, false, false]);
    setLoading(true);

    // 1. Kiểm tra đơn hàng có sẵn trong bộ nhớ theo mã đơn hoặc SKU / Barcode
    const localMatch = orders.find((o) => {
      const matchId =
        o.id.toUpperCase() === c ||
        o.id.toUpperCase().endsWith(c) ||
        (numericId && o.id.toUpperCase() === numericId);
      const matchSku = o.lines?.some(
        (l) =>
          l.sku?.toUpperCase() === c ||
          l.barcode?.toUpperCase() === c ||
          l.sku?.toUpperCase().includes(c) ||
          l.barcode?.toUpperCase().includes(c)
      );
      return matchId || matchSku;
    });

    const lookupTarget = localMatch ? localMatch.id : (numericId || c);

    try {
      const ord = await api<WhOrder>(`/staff/orders/${lookupTarget}`);
      const resolvedId = ord.id || ord.orderId || lookupTarget;
      setFound(resolvedId);
      setOrderDetail({
        ...ord,
        id: resolvedId,
      });
      pushToast({
        tone: "info",
        title: `Đã tìm thấy đơn hàng #${resolvedId} (${ord.receiver || "Khách hàng"})`,
      });
    } catch (e: any) {
      if (localMatch) {
        setFound(localMatch.id);
        setOrderDetail(localMatch);
        pushToast({
          tone: "info",
          title: `Đã tìm thấy đơn hàng #${localMatch.id} (${localMatch.receiver})`,
        });
      } else {
        setFound(null);
        setOrderDetail(null);
        setError(`Không tìm thấy đơn hàng nào khớp với "${raw}" (mã đơn hoặc mã SKU/Barcode): ${e.message || ""}`);
      }
    } finally {
      setLoading(false);
      setCode("");
      scanRef.current?.focus();
    }
  };

  const allChecked = checks.every(Boolean);

  const decide = async (restock: boolean) => {
    if (!found) return;
    try {
      await api(`/staff/orders/${found}/receive-return?restock=${restock}`, "POST");
      setDecision(
        restock
          ? `Đã ghi sổ BienDongKho loại NHAP_KHO_HANG_HOAN và phục hồi tồn khả dụng thành công!`
          : `Đã chuyển kiện sang kho hàng lỗi / chờ thanh lý thành công!`,
      );
      pushToast({
        tone: "success",
        title: restock ? "Đã nhập lại kho và hoàn tồn thành công!" : "Đã chuyển kho hàng lỗi thành công!",
      });
      onRefresh?.();
    } catch (e: any) {
      setError(e.message || "Không thể thực hiện nhận hoàn.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quét mã vạch hoặc nhập mã đơn hàng / mã SKU hàng hoàn về kho</p>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              ref={scanRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scan()}
              placeholder="Quét mã vạch hoặc nhập mã đơn hàng (VD: DH00000005, 5) hoặc mã SKU/Barcode…"
              className="h-12 w-full rounded-md border-2 border-primary bg-muted pl-11 pr-4 font-mono text-sm outline-none focus:bg-surface"
            />
          </div>
          <Button
            type="button"
            disabled={loading || !code.trim()}
            onClick={() => scan()}
            className="h-12 px-6 font-bold shrink-0"
          >
            {loading ? "Đang tìm…" : "Tra cứu"}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span>Đơn chờ hoàn kho / đang giao:</span>
          {returnableOrders.length === 0 && <span>Không có đơn trong danh sách hoàn</span>}
          {returnableOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => scan(o.id)}
              className="rounded bg-muted px-1.5 py-0.5 text-primary hover:bg-accent-subtle hover:underline font-bold"
            >
              #{o.id} ({o.receiver})
            </button>
          ))}
        </div>
        {loading && <p className="mt-2 text-xs text-muted-foreground animate-pulse">Đang tra cứu đơn hàng…</p>}
        {error && <p role="alert" className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
      </div>

      {orderDetail && found && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-bold">
            Đơn gốc <span className="font-mono">#{found}</span> — Người nhận: {orderDetail.receiver}
          </h3>
          <p className="mt-1 rounded-md bg-warning-subtle px-3 py-2 text-sm font-medium text-warning">
            Trạng thái hiện tại: {orderDetail.status} · Ghi chú: “{orderDetail.cancelReason || "Shipper trả hàng hoàn về kho"}”
          </p>
          {orderDetail.lines && orderDetail.lines.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nội dung: {orderDetail.lines.map((l) => `${l.ten} (${l.size}) ×${l.qty}`).join("; ")}
            </p>
          )}

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Checklist kiểm định hàng hoàn</p>
          <ul className="mt-2 space-y-2">
            {CHECKLIST.map((c, i) => (
              <li key={c}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((cs) => cs.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="h-6 w-6 accent-[var(--color-success)]"
                  />
                  {c}
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="success" disabled={!allChecked || decision !== null} onClick={() => decide(true)} className="h-14 gap-2 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5" />
              NHẬP LẠI KHO BÁN HÀNG (+ Phục hồi tồn kho)
            </Button>
            <Button variant="destructive" disabled={decision !== null} onClick={() => decide(false)} className="h-14 gap-2 text-sm font-bold">
              CHUYỂN KHO HÀNG LỖI / CHỜ THANH LÝ
            </Button>
          </div>
          {!allChecked && !decision && (
            <p className="mt-2 text-xs text-muted-foreground">Hoàn thành cả 3 mục checklist để mở nút nhập lại kho bán hàng.</p>
          )}
          {decision && (
            <p className="mt-3 flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {decision}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
