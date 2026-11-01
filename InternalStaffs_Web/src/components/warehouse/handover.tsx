import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PackageCheck, RotateCcw, ScanBarcode, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RETURN_CASES, returnDecision, type WhOrder } from "@/lib/warehouse";
import { vnd } from "@/lib/pos";

const SHIPPERS = [
  { id: "ND00000003", name: "Nguyễn Văn Hùng", route: "Quận Hải Châu" },
  { id: "ND00000004", name: "Lê Văn Hải", route: "Quận Thanh Khê" },
] as const;

const CHECKLIST = [
  "Hộp niêm phong còn nguyên vẹn?",
  "Quần áo còn nguyên tem thẻ bài và túi zip?",
  "Vải không dơ bẩn, không có mùi lạ?",
] as const;

/** UC_LOG_HANDOVER + UC_LOG_RETURN — Bàn giao kiện hàng cho shipper & tiếp nhận hàng hoàn về kho. */
export function HandoverReturn({ orders, onHandover }: { orders: WhOrder[]; onHandover?: (ids: string[]) => void }) {
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
      {tab === "handover" ? <Handover orders={orders} onHandover={onHandover} /> : <ReturnIntake orders={orders} />}
    </div>
  );
}

function Handover({ orders, onHandover }: { orders: WhOrder[]; onHandover?: ((ids: string[]) => void) | undefined }) {
  const ready = orders.filter((o) => o.status === "CHO_SHIPPER");
  const [shipper, setShipper] = useState<string>(SHIPPERS[0].id);
  const [code, setCode] = useState("");
  const [scanned, setScanned] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  const scan = () => {
    const c = code.trim().toUpperCase().replace(/^#/, "").replace(/^YFS/, "");
    const order = ready.find((o) => o.id === c || o.id.endsWith(c));
    if (!order) {
      setError(`Kiện ${code} không nằm trong danh sách chờ bàn giao`);
    } else if (scanned.includes(order.id)) {
      setError(`Kiện #${order.id} đã quét rồi`);
    } else {
      setScanned((ds) => [...ds, order.id]);
      setError("");
    }
    setCode("");
    scanRef.current?.focus();
  };

  const scannedOrders = ready.filter((o) => scanned.includes(o.id));
  const shipperInfo = SHIPPERS.find((s) => s.id === shipper) ?? SHIPPERS[0];

  const confirm = () => {
    if (scanned.length === 0) return;
    onHandover?.(scanned);
    setConfirmed(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Chọn nhân viên Shipper nội bộ</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SHIPPERS.map((s) => (
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
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quét liên tục mã tem kiện hàng trên bàn giao</p>
        <div className="relative mt-2">
          <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <input
            ref={scanRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="Quét mã vận đơn trên tem kiện hàng…"
            disabled={confirmed}
            className="h-12 w-full rounded-md border-2 border-primary bg-muted pl-11 pr-4 font-mono text-sm outline-none focus:bg-surface disabled:opacity-50"
          />
        </div>
        {error && <p role="alert" className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Kiện chờ bàn giao: {ready.length > 0 ? ready.map((o) => `#${o.id}`).join(" · ") : "không còn"}
        </p>

        {scannedOrders.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Mã đơn</th><th className="px-3 py-2">Người nhận</th><th className="px-3 py-2 text-right">Tiền thu hộ COD</th><th className="px-3 py-2 text-right">Thời gian quét</th></tr>
            </thead>
            <tbody>
              {scannedOrders.map((o, i) => (
                <tr key={o.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-bold">#{o.id}</td>
                  <td className="px-3 py-2">{o.receiver}</td>
                  <td className="px-3 py-2 text-right font-mono">{o.cod > 0 ? vnd(o.cod) : "0 đ"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{new Date(Date.now() - (scannedOrders.length - i) * 15000).toLocaleTimeString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {confirmed ? (
          <p className="mt-4 flex items-center gap-2 rounded-md bg-success-subtle px-3 py-3 text-sm font-bold text-success">
            <CheckCircle2 className="h-5 w-5" />
            Đã bàn giao {scanned.length} kiện cho {shipperInfo.name} — toàn bộ đơn chuyển sang DANG_GIAO_HANG (mô phỏng).
          </p>
        ) : (
          <Button variant="success" disabled={scanned.length === 0} onClick={confirm} className="mt-4 h-14 w-full gap-2 text-base font-bold">
            <PackageCheck className="h-5 w-5" />
            XÁC NHẬN BÀN GIAO {scanned.length} KIỆN HÀNG CHO SHIPPER (ENTER)
          </Button>
        )}
      </div>
    </div>
  );
}

function ReturnIntake({ orders }: { orders: WhOrder[] }) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [decision, setDecision] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const scan = () => {
    const c = code.trim().toUpperCase().replace(/^#/, "").replace(/^YFS/, "");
    const key = Object.keys(RETURN_CASES).find((k) => k === c || k.endsWith(c));
    if (key) {
      setFound(key);
      setError("");
      setDecision(null);
      setChecks([false, false, false]);
    } else {
      setFound(null);
      setError(`Không tìm thấy kiện hoàn ${code} trong danh sách giao thất bại`);
    }
    setCode("");
    scanRef.current?.focus();
  };

  const allChecked = checks.every(Boolean);
  const info = found ? RETURN_CASES[found] : null;
  const original = found ? orders.find((o) => o.id === found) : null;

  const decide = (restock: boolean) => {
    const d = returnDecision(restock);
    setDecision(
      d.restoreStock
        ? `Đã ghi sổ BienDongKho loại NHAP_KHO_HANG_HOAN và phục hồi tồn khả dụng (mô phỏng).`
        : `Đã chuyển kiện sang kho hàng lỗi / chờ thanh lý (NHAP_KHO_HANG_LOI, mô phỏng).`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quét mã kiện hàng shipper mang về</p>
        <div className="relative mt-2">
          <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
          <input
            ref={scanRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
            placeholder="Quét mã kiện hàng giao thất bại… (VD: DH00000007)"
            className="h-12 w-full rounded-md border-2 border-primary bg-muted pl-11 pr-4 font-mono text-sm outline-none focus:bg-surface"
          />
        </div>
        {error && <p role="alert" className="mt-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
      </div>

      {info && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-bold">
            Đơn gốc <span className="font-mono">#{info.orderId}</span> — Người nhận: {info.receiver}
          </h3>
          <p className="mt-1 rounded-md bg-warning-subtle px-3 py-2 text-sm font-medium text-warning">
            Lý do shipper trả về: “{info.reason}”
          </p>
          {original && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nội dung: {original.lines.map((l) => `${l.ten} (${l.size}) ×${l.qty}`).join("; ")}
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
              NHẬP LẠI KHO BÁN HÀNG (+ Phục hồi tồn kho CSDL)
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
