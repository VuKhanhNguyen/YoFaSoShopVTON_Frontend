"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  ScanBarcode,
  Minus,
  Plus,
  Trash2,
  Ticket,
  Save,
  X,
  ArrowRight,
  Clock,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loyalty } from "@/components/pos/loyalty";
import { O2O } from "@/components/pos/o2o";
import { Payment } from "@/components/pos/payment";
import { Operations } from "@/components/pos/operations";
import { Receipt } from "@/components/pos/receipt";
import { StaffNotificationPopover } from "@/components/staff-notifications";
import { RoleSwitcher } from "@/components/role-switcher";
import { useRequireAuth } from "@/lib/auth";
import { pushToast } from "@/lib/feedback";
import { PRODUCTS } from "@/lib/catalog";
import {
  CUSTOMERS,
  birthdayDiscount,
  birthdayEligible,
  redeemedPoints,
  loadSet,
  exchangeOrder,
  type Customer,
  type Method,
  type Order,
} from "@/lib/pos-workflows";
import { type BienThe, type Dong, themVaoDon, thanhTien, tongTienHang, tongThanhToan, VOUCHERS, vnd } from "@/lib/pos";

const NHOM = [
  { k: "ALL", l: "Tất cả" },
  { k: "AO", l: "Áo sơ mi" },
  { k: "QUAN", l: "Quần âu" },
  { k: "VAY", l: "Chân váy" },
  { k: "DAM", l: "Đầm liền" },
] as const;

const SHORTCUTS = [
  ["F1", "Tra cứu O2O"],
  ["F2", "Khách thân thiết"],
  ["F8", "Kiểm tồn"],
  ["F9", "Thanh toán"],
  ["F12", "Kết ca"],
] as const;

export function PosTerminal() {
  const { user, ready } = useRequireAuth(["ROLE_STAFF_CASHIER", "ROLE_SHOP_ADMIN"]);
  const [SP, setProducts] = useState(PRODUCTS);
  const [panel, setPanel] = useState<"loyalty" | "o2o" | "payment" | "operations" | "stock" | null>(null);
  const [operationsTab, setOperationsTab] = useState<"orders" | "shift">("orders");
  const [customers, setCustomers] = useState(CUSTOMERS);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [birthday, setBirthday] = useState(false);
  const [pointRequest, setPointRequest] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shiftStatus, setShiftStatus] = useState("DANG_MO");
  const [stockMovements, setStockMovements] = useState<{ code: string; quantity: number; kind: string }[]>([]);
  const [closingRequest, setClosingRequest] = useState<{ counts: Record<number, number>; note: string } | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printPicking, setPrintPicking] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [nhom, setNhom] = useState<string>("ALL");
  const [don, setDon] = useState<Dong[]>(() => [
    ...SP.slice(0, 1).map((p) => ({ ...pick(p), soLuong: 2 })),
  ]);
  const [voucher, setVoucher] = useState("YOFASO50");
  const [voucherInput, setVoucherInput] = useState("");
  const [toast, setToast] = useState<{ t: string; ok: boolean } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [soDon, setSoDon] = useState(1042);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const tong = tongTienHang(don);
  const selectedVoucher = VOUCHERS[voucher];
  const customer = customers.find((c) => c.id === customerId);
  const birthdayActive = birthday && customer && now && birthdayEligible(customer, now);
  const voucherDiscount = birthdayActive
    ? birthdayDiscount(tong)
    : selectedVoucher && tong > 0
    ? Math.min(tong, selectedVoucher.tinh(tong))
    : 0;
  const pointsUsed = redeemedPoints(customer?.points ?? 0, pointRequest, tong - voucherDiscount);
  const giam = Math.min(tong, voucherDiscount + pointsUsed * 100);
  const tt = tongThanhToan(don, giam);
  const index = useMemo(
    () => new Map(SP.map((p) => [p.maQuanLy, p] as const).concat(SP.map((p) => [p.sku, p] as const))),
    [SP]
  );
  const list = nhom === "ALL" ? SP : SP.filter((p) => p.nhom === nhom);
  const tonCon = (p: BienThe) => p.ton - (don.find((d) => d.maQuanLy === p.maQuanLy)?.soLuong ?? 0);

  const add = (p: BienThe) => {
    if (shiftStatus !== "DANG_MO") return setToast({ t: "Ca đã đóng; không thể tạo giao dịch mới.", ok: false });
    if (tonCon(p) <= 0) return setToast({ t: `${p.sku} hết tồn khả dụng`, ok: false });
    setDon((ds) => themVaoDon(ds, p));
    setToast({ t: `+1 ${p.ten} (${p.size})`, ok: true });
  };

  const scan = () => {
    const p = index.get(code.trim().toUpperCase()) ?? index.get(code.trim());
    if (p) add(p);
    else if (code.trim()) setToast({ t: `Không tìm thấy mã SKU/Barcode: ${code}`, ok: false });
    setCode("");
    scanRef.current?.focus();
  };

  const setQty = (ma: string, delta: number) => {
    const p = SP.find((x) => x.maQuanLy === ma);
    if (!p) return;
    setDon((ds) =>
      ds
        .map((d) => (d.maQuanLy === ma ? { ...d, soLuong: Math.min(p.ton, d.soLuong + delta) } : d))
        .filter((d) => d.soLuong > 0)
    );
  };

  const reset = (msg: string) => {
    setDon([]);
    setCustomerId(null);
    setBirthday(false);
    setPointRequest(0);
    setVoucher("");
    setSoDon((n) => n + 1);
    setToast({ t: msg, ok: true });
    scanRef.current?.focus();
  };

  const pay = () => {
    if (shiftStatus !== "DANG_MO") return setToast({ t: "Ca đã đóng", ok: false });
    if (!don.length) return setToast({ t: "Giỏ hàng trống", ok: false });
    setPanel("payment");
  };

  const openOperations = (tab: "orders" | "shift") => {
    setOperationsTab(tab);
    setPanel("operations");
  };

  const closePanel = () => {
    setPanel(null);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const assign = (c: Customer, birthdayVoucher: boolean, points: number) => {
    setCustomerId(c.id);
    setBirthday(birthdayVoucher);
    if (birthdayVoucher) setVoucher("");
    setPointRequest(points);
    closePanel();
  };

  const load = (set: BienThe[]) => {
    if (shiftStatus !== "DANG_MO") return false;
    const loaded = loadSet(don, set);
    if (!loaded) return false;
    setDon(loaded);
    closePanel();
    setToast({ t: "Đã nạp set đồ O2O vào hóa đơn", ok: true });
    return true;
  };

  const draft: Order = {
    id: soDon,
    created: now?.toISOString() ?? "2026-10-19T16:05:00Z",
    lines: don,
    discount: giam,
    pointsUsed,
    customerId: customerId ?? undefined,
    method: "CASH",
    tendered: 0,
    channel: "TAI_QUAY_POS",
    exchanges: [],
  };

  const complete = (method: Method, tendered: number) => {
    const order = { ...draft, created: new Date().toISOString(), method, tendered };
    setOrders((ds) => [...ds, order]);
    setProducts((ps) =>
      ps.map((p) => ({ ...p, ton: p.ton - (don.find((d) => d.maQuanLy === p.maQuanLy)?.soLuong ?? 0) }))
    );
    setStockMovements((ms) => [...ms, ...don.map((d) => ({ code: d.maQuanLy, quantity: -d.soLuong, kind: "XUAT_BAN" }))]);
    if (customer)
      setCustomers((cs) =>
        cs.map((c) =>
          c.id === customer.id
            ? {
                ...c,
                points: c.points - pointsUsed,
                birthdayUsedYear: birthdayActive ? new Date().getFullYear() : c.birthdayUsedYear,
              }
            : c
        )
      );
    reset(`Đã hoàn tất thanh toán ${vnd(tt)}`);
    pushToast({
      tone: "success",
      title: `Đã in hóa đơn nhiệt K80 thành công cho đơn #POS-${order.id} · Tồn kho đã trừ tự động`,
      detail: "Hóa đơn POS tại quầy YoFaSo Shop",
    });
    return order;
  };

  const exchange = (id: number, from: string, to: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return "Không tìm thấy hóa đơn";
    const reservedCatalog = SP.map((p) => ({ ...p, ton: tonCon(p) }));
    const result = exchangeOrder(order, reservedCatalog, from, to, new Date());
    if (!result || result.difference !== 0) return "Không thể đổi biến thể này";
    setOrders((ds) => ds.map((o) => (o.id === id ? result.order : o)));
    setProducts((ps) =>
      ps.map((p) => ({ ...p, ton: p.ton + (p.maQuanLy === from ? 1 : p.maQuanLy === to ? -1 : 0) }))
    );
    setStockMovements((ms) => [...ms, ...result.movements]);
    return "Đã đổi hàng thành công; hoàn tồn cũ và xuất tồn mới.";
  };

  const print = (order?: Order) => {
    setPrintOrder(order ?? null);
    setPrintPicking(!order);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  const applyVoucher = () => {
    const v = voucherInput.trim().toUpperCase();
    if (v in VOUCHERS) {
      setBirthday(false);
      setVoucher(v);
      setToast({ t: `Áp dụng ${v}`, ok: true });
    } else setToast({ t: "Voucher không hợp lệ", ok: false });
    setVoucherInput("");
  };

  const handlers = useRef({ pay, openOperations, panel });
  handlers.current = { pay, openOperations, panel };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = handlers.current;
      if (h.panel) return;
      const map: Record<string, () => void> = {
        F1: () => setPanel("o2o"),
        F2: () => setPanel("loyalty"),
        F8: () => setPanel("stock"),
        F9: h.pay,
        F12: () => h.openOperations("shift"),
        Escape: () => scanRef.current?.focus(),
      };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]?.();
      } else if (e.key.length === 1 && !(document.activeElement instanceof HTMLInputElement)) {
        scanRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-canvas text-foreground">
      {/* Top status bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/logo.png"
            alt="YoFaSo Shop"
            width={110}
            height={36}
            className="h-8 w-auto object-contain"
            priority
          />
          <span className="text-base font-bold tracking-wide text-accent">POS</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-foreground font-bold">{user.code}</span> {user.name}
          </span>
          <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-foreground">
            CA000001{shiftStatus !== "DANG_MO" ? " · CHỜ DUYỆT" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            Sẵn sàng bán hàng
          </span>
          <span className="flex items-center gap-1.5 font-mono text-foreground">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {now ? now.toLocaleTimeString("vi-VN") : "--:--:--"}
          </span>
        </div>
        <nav className="ml-auto flex flex-wrap items-center gap-2" aria-label="Phím tắt POS">
          <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openOperations("orders")}>
            Đơn hàng
          </Button>
          {SHORTCUTS.map(([k, l]) => (
            <Button
              variant="outline"
              key={k}
              className="h-8 rounded-full px-2.5 text-xs gap-1.5"
              onClick={() => {
                if (k === "F1") setPanel("o2o");
                if (k === "F2") setPanel("loyalty");
                if (k === "F8") setPanel("stock");
                if (k === "F9") pay();
                if (k === "F12") openOperations("shift");
              }}
            >
              <kbd className="font-mono font-bold text-accent-hover">{k}</kbd>
              {l}
            </Button>
          ))}
          <StaffNotificationPopover role={user.role} />
          <RoleSwitcher />
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Left 60% */}
        <section className="flex w-full min-w-0 shrink-0 flex-col gap-4 border-b border-border p-4 md:w-3/5 md:shrink md:border-b-0 md:border-r">
          <div className="relative">
            <ScanBarcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-primary" />
            <input
              ref={scanRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") scan();
              }}
              placeholder="Quét mã vạch / nhập SKU rồi nhấn Enter…"
              className="h-14 w-full rounded-md border-2 border-primary bg-surface-muted pl-14 pr-4 font-mono text-sm xl:pr-40 xl:text-lg outline-none placeholder:text-muted-foreground focus:bg-surface focus:border-accent"
            />
            <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 font-mono xl:block text-[11px] text-muted-foreground">
              BARCODE · ENTER
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {NHOM.map((n) => (
              <Button
                variant={nhom === n.k ? "default" : "outline"}
                key={n.k}
                onClick={() => {
                  setNhom(n.k);
                  scanRef.current?.focus();
                }}
                aria-pressed={nhom === n.k}
                className="h-9 rounded-full px-4 text-xs"
              >
                {n.l}
              </Button>
            ))}
            <span className="ml-auto self-center font-mono text-xs text-muted-foreground">
              {list.length} biến thể
            </span>
          </div>

          <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto md:pr-1 xl:grid-cols-4">
            {list.map((p) => {
              const c = tonCon(p);
              return (
                <Button
                  variant="catalog"
                  key={p.maQuanLy}
                  onClick={() => add(p)}
                  disabled={c <= 0}
                  className="group transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div className="relative aspect-square w-full bg-surface-muted">
                    <img
                      src={p.img}
                      alt={p.ten}
                      loading="lazy"
                      className="h-full w-full object-contain p-2 mix-blend-multiply"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 border-t border-border p-3">
                    <p className="line-clamp-1 text-sm font-semibold">{p.ten}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                    <p className="text-xs text-muted-foreground">
                      Size <b className="text-foreground">{p.size}</b> · {p.mau}
                    </p>
                    <div className="mt-auto flex items-end justify-between pt-1">
                      <span className="font-mono text-sm font-bold text-accent-hover">{vnd(p.donGia)}</span>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                        c <= 0 ? "text-destructive" : c <= 5 ? "text-warning" : "text-success"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {c <= 0 ? "Hết hàng" : <>Còn <span className="font-mono">{c}</span> chiếc</>}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </section>

        {/* Right 40% */}
        <aside className="flex w-full min-w-0 shrink-0 flex-col bg-surface md:w-2/5 md:shrink">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h1 className="text-base font-semibold leading-snug">
                Hóa đơn bán lẻ tại quầy <span className="block break-words font-mono text-sm text-accent-hover">#POS-2026-{soDon}</span>
              </h1>
              <p className="font-mono text-[11px] text-muted-foreground">KenhBanHang = TAI_QUAY_POS · {don.length} dòng</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Tra cứu khách hàng"
              aria-label="Tra cứu khách hàng"
              onClick={() => setPanel("loyalty")}
            >
              <User className="h-5 w-5" />
            </Button>
          </div>

          {customer && (
            <div className="flex items-center justify-between border-b border-border bg-accent-subtle px-4 py-2 text-sm">
              <span>
                <b>{customer.name}</b> · {customer.tier.replace("_", " ")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Bỏ khách hàng"
                onClick={() => {
                  setCustomerId(null);
                  setBirthday(false);
                  setPointRequest(0);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="min-h-40 flex-1 overflow-auto md:min-h-0">
            <table className="w-full min-w-[400px] text-xs">
              <thead className="sticky top-0 bg-surface-muted text-left text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">SKU / Sản phẩm</th>
                  <th className="px-2 py-2 text-right">Đơn giá</th>
                  <th className="px-2 py-2 text-center">SL</th>
                  <th className="px-2 py-2 text-right">Thành tiền</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {don.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                      Quét mã vạch hoặc bấm chọn sản phẩm để thêm vào giỏ
                    </td>
                  </tr>
                )}
                {don.map((d) => (
                  <tr key={d.maQuanLy} className="border-b border-border hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[11px] text-muted-foreground">{d.sku}</p>
                      <p className="font-semibold text-foreground">{d.ten}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {d.size} / {d.mau}
                      </p>
                    </td>
                    <td className="px-2 text-right font-mono">{vnd(d.donGia)}</td>
                    <td className="px-2">
                      <div className="mx-auto flex w-fit items-center rounded-md border border-border">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Giảm"
                          aria-label="Giảm"
                          onClick={() => setQty(d.maQuanLy, -1)}
                          className="h-7 w-7 rounded-sm p-1"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center font-mono font-bold text-sm">{d.soLuong}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Tăng"
                          aria-label="Tăng"
                          onClick={() => setQty(d.maQuanLy, 1)}
                          className="h-7 w-7 rounded-sm p-1"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-2 text-right font-mono font-bold text-foreground">{vnd(thanhTien(d))}</td>
                    <td className="pr-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Xóa"
                        aria-label="Xóa"
                        onClick={() => setQty(d.maQuanLy, -999)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-danger-subtle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 border-t border-border p-4 bg-surface">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
                <input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                  placeholder="Mã voucher (YOFASO50, VIP10)"
                  className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 font-mono text-sm uppercase outline-none focus:border-primary"
                />
              </div>
              <Button variant="outline" onClick={applyVoucher} className="h-10 border-primary px-4 font-semibold">
                Áp dụng
              </Button>
            </div>

            {voucher && (
              <div className="flex items-center justify-between rounded-md bg-accent-subtle px-3 py-1.5 text-xs">
                <span>
                  <b className="font-mono text-accent-hover">{voucher}</b> — {VOUCHERS[voucher]?.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Bỏ voucher"
                  aria-label="Bỏ voucher"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setVoucher("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {birthdayActive && (
              <div className="flex items-center justify-between bg-accent-subtle px-3 py-2 text-sm rounded-md">
                <span className="font-semibold text-accent-hover">🎂 Ưu đãi sinh nhật −15%</span>
                <Button variant="ghost" size="icon" aria-label="Bỏ ưu đãi sinh nhật" onClick={() => setBirthday(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {pointsUsed > 0 && (
              <div className="text-sm font-semibold text-accent-hover">
                Đổi {pointsUsed} điểm · −{vnd(pointsUsed * 100)}
              </div>
            )}

            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tổng tiền hàng</dt>
                <dd className="font-mono font-semibold">{vnd(tong)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Giảm giá voucher / Chiết khấu</dt>
                <dd className="font-mono text-destructive font-semibold">-{vnd(giam)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-dashed border-border pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TỔNG THANH TOÁN</span>
              <span className="font-mono text-[28px] font-bold leading-tight text-accent-hover">{vnd(tt)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => don.length && reset("Đã lưu tạm đơn")}
                className="h-9 font-semibold text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Lưu tạm
              </Button>
              <Button
                variant="outline"
                onClick={() => don.length && reset("Đã hủy đơn")}
                className="h-9 font-semibold text-xs text-destructive hover:bg-danger-subtle hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Hủy đơn
              </Button>
            </div>

            <Button
              variant="default"
              disabled={shiftStatus !== "DANG_MO"}
              onClick={pay}
              className="h-14 w-full gap-2 text-base font-bold shadow-md hover:opacity-95"
            >
              THANH TOÁN <kbd className="font-mono text-xs opacity-75">(F9)</kbd>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      </main>

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) closePanel();
        }}
      >
        <DialogContent className={panel === "loyalty" ? "max-w-xl" : "max-w-4xl"}>
          <DialogTitle className="pr-10 text-lg leading-snug">
            {panel === "loyalty"
              ? "Tra cứu khách hàng & Chương trình thân thiết (F2)"
              : panel === "o2o"
              ? "Tra cứu phiên thử đồ ảo O2O (F1)"
              : panel === "payment"
              ? "Thanh toán bán lẻ tại quầy (F9)"
              : panel === "stock"
              ? "Kiểm tồn Single Pool (F8)"
              : "Quản lý đơn & Kết ca"}
          </DialogTitle>
          <DialogDescription>YoFaSo Shop · POS Terminal · {user.code}</DialogDescription>

          {panel === "loyalty" && <Loyalty customers={customers} payable={tong} onAssign={assign} />}
          {panel === "o2o" && (
            <O2O products={SP.map((p) => ({ ...p, ton: tonCon(p) }))} onLoad={load} onPrint={() => print()} />
          )}
          {panel === "payment" && <Payment draft={draft} onComplete={complete} onPrint={print} />}
          {panel === "operations" && (
            <Operations
              initialTab={operationsTab}
              orders={orders}
              catalog={SP.map((p) => ({ ...p, ton: tonCon(p) }))}
              shiftStatus={shiftStatus}
              onPrint={print}
              onExchange={exchange}
              onCloseShift={(counts, note) => {
                setClosingRequest({ counts, note });
                setShiftStatus("DA_DONG_CHO_DUYET");
                setToast({ t: "Đã gửi yêu cầu kết ca; chờ chủ shop phê duyệt.", ok: true });
              }}
            />
          )}
          {panel === "stock" && (
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th>Sản phẩm</th>
                    <th className="text-right p-3">Khả dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {SP.map((p) => (
                    <tr key={p.maQuanLy} className="border-b border-border">
                      <td className="p-3 font-mono">{p.sku}</td>
                      <td>
                        {p.ten} · {p.size}
                      </td>
                      <td className="text-right p-3 font-mono font-bold text-accent-hover">{tonCon(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-muted-foreground">
                {stockMovements.length} biến động tồn trong ca làm việc
                {closingRequest ? " · Đã ghi nhận bàn giao ca" : ""}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {now &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="print-sheet">
            {printOrder && <Receipt order={printOrder} />}
            {printPicking && (
              <article className="picking-slip">
                <h2>YOFASO · PHIẾU LẤY ĐỒ THỬ</h2>
                <p>Phiên TD00000001</p>
                <p>Áo sơ mi lụa Trắng · M</p>
                <p>Kệ Áo A-01 / Tầng 2</p>
                <p>Quần tây suông Đen · M</p>
                <p>Kệ Quần B-03 / Tầng 1</p>
              </article>
            )}
          </div>,
          document.body
        )}

      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-50 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium shadow-floating-toast backdrop-blur-md ${
            toast.ok ? "text-success border-success/30" : "text-destructive border-destructive/30"
          }`}
        >
          {toast.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{toast.t}</span>
        </div>
      )}
    </div>
  );
}

function pick(p: BienThe) {
  const { maQuanLy, sku, ten, size, mau, donGia } = p;
  return { maQuanLy, sku, ten, size, mau, donGia };
}
