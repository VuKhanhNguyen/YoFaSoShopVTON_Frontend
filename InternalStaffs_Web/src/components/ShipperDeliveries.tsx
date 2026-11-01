"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Camera,
  CheckCircle2,
  Download,
  MapPin,
  Navigation,
  Phone,
  PackageCheck,
  Plus,
  RotateCcw,
  ScanLine,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffHeader } from "@/components/staff-header";
import { useRequireAuth } from "@/lib/auth";
import { vnd } from "@/lib/pos";
import {
  FAIL_REASONS,
  MAX_ATTEMPTS,
  PENDING_PARCELS,
  ROUTE_HAI_CHAU,
  completeDelivery,
  failDelivery,
  mapsUrl,
  maskPhone,
  scanParcel,
  settlement,
  type FailReason,
  type ShipStatus,
  type Stop,
} from "@/lib/shipper";

type View = "route" | "scan" | "stop" | "settle";

const STATUS_UI: Record<ShipStatus, { label: string; cls: string }> = {
  DANG_GIAO_HANG: { label: "ĐANG ĐI GIAO", cls: "bg-info-subtle text-info" },
  HOAN_TAT: { label: "HOÀN TẤT", cls: "bg-success-subtle text-success" },
  HEN_LAI: { label: "HẸN GIAO LẠI", cls: "bg-warning-subtle text-warning" },
  HOAN_TRA: { label: "HOÀN TRẢ KHO", cls: "bg-danger-subtle text-destructive" },
};

export function ShipperDeliveries() {
  const { user, ready } = useRequireAuth(["ROLE_STAFF_SHIPPER", "ROLE_SHOP_ADMIN"]);
  const [route, setRoute] = useState<Stop[]>(() => ROUTE_HAI_CHAU.map((s) => ({ ...s })));
  const [view, setView] = useState<View>("route");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  const sum = settlement(route);
  const active = route.find((r) => r.maDon === activeId) ?? null;
  const update = (s: Stop) => setRoute((rs) => rs.map((r) => (r.maDon === s.maDon ? s : r)));

  return (
    <div className="min-h-dvh bg-surface-muted">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-canvas shadow-modal">
        <StaffHeader title="GIAO VẬN" />
        <PwaBanner />
        {view === "route" && (
          <RouteView
            route={route}
            sum={sum}
            onScan={() => setView("scan")}
            onSettle={() => setView("settle")}
            onOpen={(id) => {
              setActiveId(id);
              setView("stop");
            }}
          />
        )}
        {view === "scan" && (
          <ScanView
            route={route}
            onAdd={(s) => setRoute((rs) => [...rs, s])}
            onBack={() => setView("route")}
          />
        )}
        {view === "stop" && active && (
          <StopView
            stop={active}
            onBack={() => setView("route")}
            onSave={(s) => {
              update(s);
              setView("route");
            }}
          />
        )}
        {view === "settle" && (
          <SettleView
            route={route}
            settled={settled}
            onConfirm={() => setSettled(true)}
            onBack={() => setView("route")}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- PWA banner (manifest-only install) ---------- */
type InstallEvt = Event & { prompt: () => Promise<void> };

function PwaBanner() {
  const [evt, setEvt] = useState<InstallEvt | null>(null);
  const [hidden, setHidden] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvt);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (hidden) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-primary px-3 py-2 text-primary-foreground">
      <Download className="h-4 w-4 shrink-0 text-accent" />
      <p className="flex-1 text-xs font-semibold">
        {hint ? "Mở menu trình duyệt → “Thêm vào màn hình chính”." : "Cài đặt App Shipper về màn hình chính (PWA)"}
      </p>
      <Button
        size="sm"
        variant="accent"
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setHidden(true);
          } else {
            setHint(true);
          }
        }}
      >
        Cài đặt
      </Button>
      <button aria-label="Ẩn" onClick={() => setHidden(true)} className="p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- Route dashboard ---------- */
function RouteView({
  route,
  sum,
  onScan,
  onOpen,
  onSettle,
}: {
  route: Stop[];
  sum: ReturnType<typeof settlement>;
  onScan: () => void;
  onOpen: (id: string) => void;
  onSettle: () => void;
}) {
  return (
    <main className="flex-1 space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">LỘ TRÌNH GIAO HÀNG HÔM NAY</h1>
        <p className="text-sm text-muted-foreground">
          Shipper: <b className="text-foreground">Lê Văn Hải</b> (<span className="font-mono">NV-04</span>) · Tuyến Quận Hải Châu
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="font-mono text-3xl font-bold">{sum.total}</p>
          <p className="text-xs font-semibold text-muted-foreground">Kiện hàng cần giao</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="font-mono text-xl font-bold">{vnd(sum.codExpected)}</p>
          <p className="text-xs font-semibold text-muted-foreground">Tổng COD cần thu</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button className="h-14 text-base" onClick={onScan}>
          <Plus className="h-5 w-5" /> Quét nhận thêm kiện
        </Button>
        <Button variant="outline" className="h-14 text-base" onClick={onSettle}>
          <Banknote className="h-5 w-5" /> Quyết toán ca
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Đã xong {sum.delivered + sum.returns}/{sum.total} điểm · Dữ liệu mô phỏng
      </p>
      <ol className="space-y-3">
        {route.map((s, i) => {
          const st = STATUS_UI[s.status];
          const open = s.status === "DANG_GIAO_HANG" || s.status === "HEN_LAI";
          return (
            <li key={s.maDon} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-base font-bold">{s.khach}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      #{s.maDon} · {maskPhone(s.sdt)}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
              </div>
              <p className="mt-2 flex gap-1.5 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {s.diaChi}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.ghiChu}</span>
                <span className="font-mono text-lg font-bold">{s.soTienThuHo > 0 ? vnd(s.soTienThuHo) : "0 đ"}</span>
              </div>
              {s.soLanGiao > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Số lần giao: {s.soLanGiao}/{MAX_ATTEMPTS}
                  {s.lyDo ? ` · ${FAIL_REASONS[s.lyDo]}` : ""}
                </p>
              )}
              {open && (
                <div className="mt-3 grid grid-cols-[56px_56px_1fr] gap-2">
                  <a
                    href={`tel:${s.sdt}`}
                    aria-label={`Gọi ${s.khach}`}
                    className="flex h-14 items-center justify-center rounded-full bg-success text-success-foreground"
                  >
                    <Phone className="h-6 w-6" />
                  </a>
                  <a
                    href={mapsUrl(s.diaChi)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Mở Google Maps"
                    className="flex h-14 items-center justify-center rounded-full bg-info text-primary-foreground"
                  >
                    <Navigation className="h-6 w-6" />
                  </a>
                  <Button className="h-14 text-sm font-bold" onClick={() => onOpen(s.maDon)}>
                    CẬP NHẬT KẾT QUẢ GIAO <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/* ---------- Camera helper ---------- */
function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = st;
      if (videoRef.current) {
        videoRef.current.srcObject = st;
        await videoRef.current.play();
      }
      setOn(true);
      setErr(null);
    } catch {
      setErr("Không mở được camera — dùng ô nhập mã / ảnh mô phỏng.");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  };

  const snap = (): string | null => {
    const v = videoRef.current;
    if (!v || !on) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 320;
    c.height = v.videoHeight || 240;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  };

  useEffect(() => () => stop(), []);
  return { videoRef, on, err, start, stop, snap };
}

/* ---------- Scan intake ---------- */
function ScanView({
  route,
  onAdd,
  onBack,
}: {
  route: Stop[];
  onAdd: (s: Stop) => void;
  onBack: () => void;
}) {
  const cam = useCamera();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (raw: string) => {
    const r = scanParcel(route, PENDING_PARCELS, raw);
    if (r.kind === "added") {
      onAdd(r.stop);
      setMsg({ ok: true, text: `Đã nạp #${r.stop.maDon} — ${r.stop.khach}` });
    } else {
      setMsg({
        ok: false,
        text: r.kind === "duplicate" ? "Kiện đã có trong chuyến đi." : "Mã vận đơn không thuộc lô bàn giao.",
      });
    }
    setCode("");
  };

  const remaining = PENDING_PARCELS.filter((p) => !route.some((r) => r.maDon === p.maDon));

  return (
    <main className="flex-1 space-y-4 p-4">
      <BackBar title="Tiếp nhận kiện hàng xuất kho" onBack={onBack} />
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-primary">
        <video
          ref={cam.videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${cam.on ? "" : "hidden"}`}
        />
        {!cam.on && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-primary-foreground">
            <ScanLine className="h-12 w-12 text-accent" />
            <p className="text-sm">Hướng camera vào mã vạch vận đơn</p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 bg-destructive" />
      </div>
      {cam.err && <p className="text-sm text-warning">{cam.err}</p>}
      <Button variant="outline" className="h-14 w-full text-base" onClick={cam.on ? cam.stop : cam.start}>
        <Camera className="h-5 w-5" /> {cam.on ? "Tắt camera" : "Bật camera quét"}
      </Button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) submit(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Nhập / quét mã vận đơn (VD: DH00000013)"
          className="h-14 flex-1 rounded-md border border-input bg-surface px-3 font-mono text-base"
        />
        <Button type="submit" className="h-14 px-5">
          Nạp
        </Button>
      </form>
      {msg && (
        <p
          className={`rounded-md p-3 text-sm font-semibold ${
            msg.ok ? "bg-success-subtle text-success" : "bg-danger-subtle text-destructive"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-xs font-bold text-muted-foreground">KIỆN CHỜ BÀN GIAO TỪ THỦ KHO (mô phỏng quét)</p>
        {remaining.length === 0 ? (
          <p className="mt-2 text-sm">Đã nhận hết kiện.</p>
        ) : (
          remaining.map((p) => (
            <button
              key={p.maDon}
              onClick={() => submit(p.maDon)}
              className="mt-2 flex h-14 w-full items-center justify-between rounded-md border border-border px-3 text-left"
            >
              <span className="font-mono text-sm font-bold">{p.maDon}</span>
              <span className="text-sm">{p.khach}</span>
            </button>
          ))
        )}
      </div>
      <Button className="h-14 w-full text-base" onClick={onBack}>
        Xong — về lộ trình ({route.length} kiện)
      </Button>
    </main>
  );
}

/* ---------- Stop result ---------- */
function StopView({
  stop,
  onBack,
  onSave,
}: {
  stop: Stop;
  onBack: () => void;
  onSave: (s: Stop) => void;
}) {
  const [mode, setMode] = useState<"choose" | "ok" | "fail">("choose");
  const [cash, setCash] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>();
  const [reason, setReason] = useState<FailReason | null>(null);
  const cam = useCamera();
  const k = stop.soTienThuHo > 0 ? `THU ${Math.round(stop.soTienThuHo / 1000)}K` : "ĐÃ TRẢ ONLINE";
  const needCash = stop.soTienThuHo > 0;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <BackBar title={`Điểm giao #${stop.maDon}`} onBack={onBack} />
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-lg font-bold">{stop.khach}</p>
        <p className="text-sm text-muted-foreground">{stop.diaChi}</p>
        <p className="mt-2 text-sm">
          Tiền thu COD: <span className="font-mono text-2xl font-bold">{vnd(stop.soTienThuHo)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Số lần đã giao: {stop.soLanGiao}/{MAX_ATTEMPTS} lần
        </p>
      </div>

      {mode === "choose" && (
        <div className="grid flex-1 grid-cols-2 gap-3">
          <button
            onClick={() => setMode("ok")}
            className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-success p-3 text-center text-lg font-extrabold text-success-foreground"
          >
            <CheckCircle2 className="h-10 w-10" />
            GIAO THÀNH CÔNG ({k})
          </button>
          <button
            onClick={() => setMode("fail")}
            className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-warning p-3 text-center text-lg font-extrabold text-primary-foreground"
          >
            <RotateCcw className="h-10 w-10" />
            GIAO THẤT BẠI / HẸN LẠI
          </button>
        </div>
      )}

      {mode === "ok" && (
        <div className="space-y-3 rounded-lg border-2 border-success bg-surface p-4">
          {needCash && (
            <label className="flex min-h-14 items-center gap-3 rounded-md bg-success-subtle p-3 text-base font-semibold">
              <input
                type="checkbox"
                checked={cash}
                onChange={(e) => setCash(e.target.checked)}
                className="h-6 w-6 accent-[var(--success)]"
              />
              Đã thu đủ {vnd(stop.soTienThuHo)} tiền mặt từ khách
            </label>
          )}
          <p className="text-sm font-bold">Ảnh bằng chứng giao hàng (POD)</p>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-primary">
            {photo ? (
              <img src={photo} alt="Ảnh POD" className="h-full w-full object-cover" />
            ) : (
              <>
                <video
                  ref={cam.videoRef}
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cam.on ? "" : "hidden"}`}
                />
                {!cam.on && (
                  <div className="flex h-full items-center justify-center text-primary-foreground">
                    <Camera className="h-10 w-10 text-accent" />
                  </div>
                )}
              </>
            )}
          </div>
          {cam.err && <p className="text-xs text-warning">{cam.err}</p>}
          <div className="grid grid-cols-2 gap-2">
            {!photo && !cam.on && (
              <Button variant="outline" className="h-14" onClick={cam.start}>
                <Camera className="h-5 w-5" /> Mở camera
              </Button>
            )}
            {!photo && cam.on && (
              <Button
                variant="outline"
                className="h-14"
                onClick={() => {
                  const p = cam.snap();
                  if (p) {
                    setPhoto(p);
                    cam.stop();
                  }
                }}
              >
                <Camera className="h-5 w-5" /> Chụp
              </Button>
            )}
            {!photo && (
              <Button variant="outline" className="h-14" onClick={() => setPhoto(simulatedPod(stop.maDon))}>
                Ảnh mô phỏng
              </Button>
            )}
            {photo && (
              <Button variant="outline" className="col-span-2 h-14" onClick={() => setPhoto(undefined)}>
                Chụp lại
              </Button>
            )}
          </div>
          <Button
            variant="success"
            className="h-14 w-full text-base font-bold"
            disabled={(needCash && !cash) || !photo}
            onClick={() => onSave(completeDelivery(stop, cash, photo))}
          >
            <PackageCheck className="h-5 w-5" /> XÁC NHẬN HOÀN TẤT ĐƠN HÀNG
          </Button>
          <Button variant="ghost" className="h-12 w-full" onClick={() => setMode("choose")}>
            Quay lại
          </Button>
        </div>
      )}

      {mode === "fail" && (
        <div className="space-y-3 rounded-lg border-2 border-warning bg-surface p-4">
          <p className="text-sm font-bold">Chọn lý do</p>
          {(Object.keys(FAIL_REASONS) as FailReason[]).map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`flex min-h-14 w-full items-center rounded-md border-2 px-3 text-left text-base font-semibold ${
                reason === r ? "border-warning bg-warning-subtle" : "border-border"
              }`}
            >
              {FAIL_REASONS[r]}
            </button>
          ))}
          <p className="text-sm">
            Số lần đã giao: <b className="font-mono">{stop.soLanGiao + 1}/{MAX_ATTEMPTS}</b> lần
            {reason && failDelivery(stop, reason).status === "HOAN_TRA" && (
              <span className="ml-1 font-bold text-destructive">→ tự động chuyển HOÀN TRẢ KHO</span>
            )}
          </p>
          <Button
            className="h-14 w-full bg-warning text-base font-bold text-primary-foreground hover:bg-warning/90"
            disabled={!reason}
            onClick={() => reason && onSave(failDelivery(stop, reason))}
          >
            LƯU TRẠNG THÁI & CHUYỂN ĐIỂM TIẾP THEO
          </Button>
          <Button variant="ghost" className="h-12 w-full" onClick={() => setMode("choose")}>
            Quay lại
          </Button>
        </div>
      )}
    </main>
  );
}

function simulatedPod(id: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#C5A880"/><rect x="120" y="90" width="160" height="120" fill="#FAFAF9" stroke="#0F172A" stroke-width="4"/><text x="200" y="160" font-family="monospace" font-size="18" text-anchor="middle" fill="#0F172A">POD ${id}</text><text x="200" y="250" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#0F172A">Ảnh mô phỏng</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ---------- End-of-shift settlement ---------- */
function SettleView({
  route,
  settled,
  onConfirm,
  onBack,
}: {
  route: Stop[];
  settled: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const s = settlement(route);
  const returns = route.filter((r) => r.status === "HOAN_TRA");
  const done = route.filter((r) => r.status === "HOAN_TAT" && r.soTienThuHo > 0);

  return (
    <main className="flex-1 space-y-4 p-4">
      <BackBar title="Quyết toán cuối ca" onBack={onBack} />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="font-mono text-2xl font-bold text-success">{s.delivered}/{s.total}</p>
          <p className="text-xs font-semibold text-muted-foreground">Đơn giao thành công</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="font-mono text-2xl font-bold text-destructive">{s.returns}</p>
          <p className="text-xs font-semibold text-muted-foreground">Kiện hoàn cần trả kho</p>
        </div>
      </div>
      <div className="rounded-lg bg-primary p-4 text-primary-foreground">
        <p className="text-xs font-bold tracking-wide text-accent">TỔNG TIỀN COD ĐÃ THU CẦN NỘP</p>
        <p className="font-mono text-4xl font-bold">{vnd(s.codCollected)}</p>
        {(s.pending > 0 || s.rescheduled > 0) && (
          <p className="mt-1 text-xs">
            Còn {s.pending} điểm chưa giao · {s.rescheduled} điểm hẹn lại
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <p className="border-b border-border px-3 py-2 text-xs font-bold text-muted-foreground">CHI TIẾT COD ĐÃ THU</p>
        {done.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Chưa thu đơn COD nào.</p>
        ) : (
          done.map((r) => (
            <div key={r.maDon} className="flex justify-between px-3 py-2 text-sm">
              <span className="font-mono">#{r.maDon}</span>
              <span className="font-mono font-bold">{vnd(r.soTienThuHo)}</span>
            </div>
          ))
        )}
      </div>
      {returns.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <p className="border-b border-border px-3 py-2 text-xs font-bold text-muted-foreground">KIỆN HOÀN TRẢ KHO</p>
          {returns.map((r) => (
            <div key={r.maDon} className="flex justify-between px-3 py-2 text-sm">
              <span className="font-mono">#{r.maDon}</span>
              <span>{r.lyDo ? FAIL_REASONS[r.lyDo] : `Quá ${MAX_ATTEMPTS} lần giao`}</span>
            </div>
          ))}
        </div>
      )}
      {settled ? (
        <p className="flex items-center gap-2 rounded-md bg-success-subtle p-4 text-base font-bold text-success">
          <CheckCircle2 className="h-5 w-5" /> Đã bàn giao {vnd(s.codCollected)} và {s.returns} kiện hoàn — chờ thu ngân xác nhận (mô phỏng).
        </p>
      ) : (
        <Button variant="success" className="h-16 w-full text-base font-bold" onClick={onConfirm}>
          <Undo2 className="h-5 w-5" /> XÁC NHẬN BÀN GIAO TIỀN COD CHO THU NGÂN
        </Button>
      )}
    </main>
  );
}

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="h-14 w-14 shrink-0" onClick={onBack} aria-label="Quay lại">
        <ArrowRight className="h-5 w-5 rotate-180" />
      </Button>
      <h1 className="text-lg font-extrabold">{title}</h1>
    </div>
  );
}
