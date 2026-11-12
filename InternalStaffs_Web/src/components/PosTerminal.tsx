"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  GripVertical,
  Layers,
  ShoppingBag,
  Filter,
  Loader2,
  RotateCcw,
  Sparkles,
  MapPin,
  PlusCircle,
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
import { api, catalogImage } from "@/lib/api";
import { vnLabel } from "@/lib/vietnamese-labels";
import {
  birthdayDiscount,
  birthdayEligible,
  redeemedPoints,
  loadSet,
  type Customer,
  type Method,
  type Order,
} from "@/lib/pos-workflows";
import { type BienThe, type Dong, themVaoDon, thanhTien, tongTienHang, tongThanhToan, VOUCHERS, vnd } from "@/lib/pos";

const SHORTCUTS = [
  ["F1", "Tra cứu O2O"],
  ["F2", "Khách thân thiết"],
  ["F8", "Kiểm tồn kho"],
  ["F9", "Thanh toán"],
  ["F12", "Kết ca"],
] as const;

export function PosTerminal() {
  const { user, ready } = useRequireAuth(["ROLE_STAFF_CASHIER", "ROLE_SHOP_ADMIN"]);

  // 1. Resizable Split Ratio (Desktop: 60% Left - 40% Right)
  const [splitRatio, setSplitRatio] = useState<number>(60);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // Mobile / Small screen view switcher ("catalog" | "cart")
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");

  // 2. Real Data from Backend
  const [categories, setCategories] = useState<{ categoryId: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Variant selector popup
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<any | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [productVariants, setProductVariants] = useState<any[]>([]);

  // 3. Shift Management (Database)
  const [activeShift, setActiveShift] = useState<{
    shiftId: string;
    cashierId: string;
    openingCash: number;
    status: string;
  } | null>(null);
  const [shiftStatus, setShiftStatus] = useState<string>("DANG_MO");
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [openingAmountInput, setOpeningAmountInput] = useState("2000000");
  const [openingShiftLoading, setOpeningShiftLoading] = useState(false);

  // 4. Cart & Transaction state
  const [don, setDon] = useState<Dong[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [birthday, setBirthday] = useState(false);
  const [pointRequest, setPointRequest] = useState(0);
  const [voucher, setVoucher] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [code, setCode] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  // Parked orders (Lưu tạm đơn)
  const [parkedOrders, setParkedOrders] = useState<
    { id: string; time: string; lines: Dong[]; customer: Customer | null; voucher: string }[]
  >([]);

  // Modals & Panels
  const [panel, setPanel] = useState<"loyalty" | "o2o" | "payment" | "operations" | "stock" | null>(null);
  const [operationsTab, setOperationsTab] = useState<"orders" | "shift">("orders");
  const [stockLowList, setStockLowList] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Print & Receipt
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printPicking, setPrintPicking] = useState(false);
  const [toast, setToast] = useState<{ t: string; ok: boolean } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Load split ratio preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("yofaso_pos_split_ratio");
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 35 && val <= 75) setSplitRatio(val);
      }
      const savedParked = localStorage.getItem("yofaso_pos_parked_orders");
      if (savedParked) {
        setParkedOrders(JSON.parse(savedParked));
      }
    } catch {}
  }, []);

  // Clock
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Toast timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Initial focus
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  // 1. Fetch Categories from Database
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api<any[]>("/catalog/categories");
      if (Array.isArray(res)) {
        // Filter top-level or main categories
        setCategories(
          res.map((c) => ({
            categoryId: c.categoryId,
            name: c.name,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    }
  }, []);

  // 2. Fetch Products from Database (Public Catalog API from Mobile App)
  const fetchProducts = useCallback(async (catId = selectedCategory, q = searchQuery) => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "40");
      if (catId && catId !== "ALL") params.set("categoryId", catId);
      if (q.trim()) params.set("q", q.trim());
      const res = await api<{ items: any[]; total: number }>(`/catalog/products?${params.toString()}`);
      if (res && Array.isArray(res.items)) {
        setProducts(res.items);
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedCategory, searchQuery]);

  // 3. Fetch Active Shift from Database
  const fetchShift = useCallback(async () => {
    try {
      const shifts = await api<any[]>("/pos/shifts?status=DANG_MO");
      if (Array.isArray(shifts) && shifts.length > 0) {
        setActiveShift(shifts[0]);
        setShiftStatus("DANG_MO");
      } else {
        setActiveShift(null);
        setShiftStatus("CHUA_MO_CA");
      }
    } catch (e) {
      console.error("Failed to fetch shift:", e);
    }
  }, []);

  useEffect(() => {
    if (ready && user) {
      fetchCategories();
      fetchProducts();
      fetchShift();
    }
  }, [ready, user, fetchCategories, fetchProducts, fetchShift]);

  // Resizable Splitter handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (window.innerWidth < 768) return; // Disable dragging on mobile
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(75, Math.max(35, Math.round(newRatio)));
    setSplitRatio(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      localStorage.setItem("yofaso_pos_split_ratio", String(splitRatio));
    } catch {}
  };

  const resetSplitRatio = () => {
    setSplitRatio(60);
    localStorage.setItem("yofaso_pos_split_ratio", "60");
  };

  // Cart Calculations
  const tong = tongTienHang(don);
  const selectedVoucher = VOUCHERS[voucher];
  const birthdayActive = birthday && customer && now && birthdayEligible(customer, now);
  const voucherDiscount = birthdayActive
    ? birthdayDiscount(tong)
    : selectedVoucher && tong > 0
    ? Math.min(tong, selectedVoucher.tinh(tong))
    : 0;
  const pointsUsed = redeemedPoints(customer?.points ?? 0, pointRequest, tong - voucherDiscount);
  const giam = Math.min(tong, voucherDiscount + pointsUsed * 100);
  const tt = tongThanhToan(don, giam);

  const tonCon = (p: { ton?: number; stock?: number; maQuanLy?: string; variantId?: string }) => {
    const totalTon = Number(p.ton ?? p.stock ?? 0);
    const inCart = don.find(
      (d) => (p.variantId && d.variantId === p.variantId) || (p.maQuanLy && d.maQuanLy === p.maQuanLy)
    )?.soLuong ?? 0;
    return Math.max(0, totalTon - inCart);
  };

  // Open shift
  const handleOpenShift = async () => {
    const amt = parseFloat(openingAmountInput);
    if (isNaN(amt) || amt < 0) {
      alert("Số tiền mặt đầu ca không hợp lệ.");
      return;
    }
    setOpeningShiftLoading(true);
    try {
      const res = await api<any>("/pos/shifts", "POST", {
        amount: amt,
        note: "Mở ca bán lẻ tại quầy POS",
      });
      pushToast({
        tone: "success",
        title: `Đã mở ca làm việc #${res.shiftId} thành công!`,
        detail: `Tiền mặt đầu ca: ${vnd(amt)}`,
      });
      setOpenShiftModal(false);
      fetchShift();
    } catch (err: any) {
      alert(err.message || "Không thể mở ca làm việc. Vui lòng kiểm tra lại.");
    } finally {
      setOpeningShiftLoading(false);
    }
  };

  // Add a specific variant to cart
  const addVariantToCart = (v: any, parentProduct?: any) => {
    if (shiftStatus !== "DANG_MO") {
      setOpenShiftModal(true);
      return setToast({ t: "Ca chưa mở. Vui lòng mở ca làm việc trước khi bán hàng.", ok: false });
    }
    const stock = Number(v.stock ?? v.ton ?? 0);
    const remaining = tonCon({ ton: stock, variantId: v.variantId, maQuanLy: v.sku || v.maQuanLy });
    if (remaining <= 0) {
      return setToast({ t: `${v.sku || "Sản phẩm"} đã hết tồn khả dụng trong kho`, ok: false });
    }

    const bienThe: BienThe = {
      variantId: v.variantId,
      maQuanLy: v.sku || v.maQuanLy || v.variantId,
      sku: v.sku || v.variantId,
      productId: v.productId || parentProduct?.productId,
      ten: parentProduct?.name || v.productName || v.name || "Sản phẩm",
      size: v.size || "Free",
      mau: v.colorName || "Mặc định",
      donGia: Number(v.salePrice || v.price) || 350000,
      ton: stock,
      shelf: v.shelf,
    };

    setDon((ds) => themVaoDon(ds, bienThe));
    setToast({ t: `+1 ${bienThe.ten} (${bienThe.size})`, ok: true });
    setSelectedProductForVariant(null);
    setMobileTab("cart"); // On mobile, automatically show cart
  };

  // When clicking a product card from the grid
  const handleProductCardClick = async (p: any) => {
    setSelectedProductForVariant(p);
    setLoadingVariants(true);
    setProductVariants([]);
    try {
      const res = await api<any>(`/catalog/products/${encodeURIComponent(p.productId)}`);
      if (res && Array.isArray(res.variants) && res.variants.length > 0) {
        setProductVariants(res.variants);
        // If only 1 variant, add immediately
        if (res.variants.length === 1) {
          addVariantToCart(res.variants[0], p);
        }
      } else {
        // Fallback single variant
        const fallbackVariant = {
          variantId: p.sku || `VAR-${p.productId}`,
          sku: p.sku,
          size: "Free",
          colorName: "Mặc định",
          price: p.minPrice || 350000,
          stock: 20,
        };
        addVariantToCart(fallbackVariant, p);
      }
    } catch {
      // Direct add with representative SKU
      addVariantToCart({ variantId: p.sku, sku: p.sku, price: p.minPrice, stock: 10 }, p);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Barcode Scanning / Manual SKU Lookup from DB
  const scanBarcode = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    try {
      const v = await api<any>(`/staff/variants/by-sku?sku=${encodeURIComponent(cleanCode)}`);
      if (v && (v.variantId || v.sku)) {
        addVariantToCart(v);
        setCode("");
        scanRef.current?.focus();
        return;
      }
    } catch {}

    // Fallback: search in current loaded products
    const match = products.find((p) => p.sku === cleanCode || p.productId === cleanCode);
    if (match) {
      handleProductCardClick(match);
      setCode("");
      scanRef.current?.focus();
      return;
    }

    setToast({ t: `Không tìm thấy mã SKU / Barcode "${cleanCode}" trên hệ thống`, ok: false });
    setCode("");
    scanRef.current?.focus();
  };

  // Adjust quantity
  const setQty = (variantIdentifier: string, delta: number) => {
    setDon((ds) =>
      ds
        .map((d) => {
          if (d.variantId === variantIdentifier || d.maQuanLy === variantIdentifier) {
            const currentTon = d.ton ?? 99;
            const newQty = Math.min(currentTon, d.soLuong + delta);
            return { ...d, soLuong: newQty };
          }
          return d;
        })
        .filter((d) => d.soLuong > 0)
    );
  };

  // Reset order
  const resetOrder = (msg: string) => {
    setDon([]);
    setCustomerId(null);
    setCustomer(null);
    setBirthday(false);
    setPointRequest(0);
    setVoucher("");
    setVoucherInput("");
    setToast({ t: msg, ok: true });
    scanRef.current?.focus();
  };

  // Park current order (Lưu tạm đơn)
  const parkOrder = () => {
    if (!don.length) return;
    const newDraft = {
      id: `TMP-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString("vi-VN"),
      lines: don,
      customer,
      voucher,
    };
    const updated = [newDraft, ...parkedOrders];
    setParkedOrders(updated);
    localStorage.setItem("yofaso_pos_parked_orders", JSON.stringify(updated));
    resetOrder(`Đã lưu tạm đơn ${newDraft.id} vào hàng chờ.`);
  };

  // Restore parked order
  const restoreParkedOrder = (draft: (typeof parkedOrders)[0]) => {
    setDon(draft.lines);
    setCustomer(draft.customer);
    setCustomerId(draft.customer?.id ?? null);
    setVoucher(draft.voucher);
    const updated = parkedOrders.filter((p) => p.id !== draft.id);
    setParkedOrders(updated);
    localStorage.setItem("yofaso_pos_parked_orders", JSON.stringify(updated));
    setToast({ t: `Đã nạp lại đơn tạm ${draft.id}`, ok: true });
  };

  // Open Payment modal
  const handlePay = () => {
    if (shiftStatus !== "DANG_MO") {
      setOpenShiftModal(true);
      return setToast({ t: "Ca làm việc chưa mở", ok: false });
    }
    if (!don.length) return setToast({ t: "Giỏ hàng đang trống", ok: false });
    setPanel("payment");
  };

  // Complete Payment & Save to Database (POST /pos/orders)
  const completePayment = async (method: Method, tendered: number): Promise<Order | null> => {
    const key = crypto.randomUUID();
    const payload = {
      items: don.map((d) => ({
        variantId: d.variantId || d.maQuanLy,
        quantity: d.soLuong,
      })),
      customerId: customerId || undefined,
      voucher: voucher || undefined,
      cashReceived: tendered,
      paymentMethod: method === "QR" ? "VIETQR" : "COD",
    };

    try {
      const res = await api<any>("/pos/orders", "POST", payload, key);
      const createdOrderId = res.orderId || res.id || `POS-${Date.now().toString().slice(-4)}`;

      const createdOrder: Order = {
        id: createdOrderId,
        orderId: createdOrderId,
        created: new Date().toISOString(),
        lines: don,
        discount: giam,
        pointsUsed,
        customerId: customerId ?? undefined,
        customerName: customer?.name ?? "Khách tại quầy",
        customerPhone: customer?.phone ?? "",
        cashierId: user?.name || "Thu ngân",
        method,
        tendered,
        total: tt,
        status: "HOAN_TAT",
        channel: "TAI_QUAY_POS",
      };

      pushToast({
        tone: "success",
        title: `Đã tạo hóa đơn #${createdOrderId} thành công!`,
        detail: "Tồn kho Single Pool đã được trừ tự động & ghi nhận sổ cái kho",
      });

      // Update current shift sales
      fetchShift();
      // Reload products to refresh stock
      fetchProducts();

      // Reset cart
      setDon([]);
      setCustomerId(null);
      setCustomer(null);
      setBirthday(false);
      setPointRequest(0);
      setVoucher("");

      return createdOrder;
    } catch (err: any) {
      pushToast({
        tone: "error",
        title: "Lỗi tạo đơn hàng POS",
        detail: err.message || "Không thể hoàn tất đơn hàng",
      });
      return null;
    }
  };

  // Customer Loyalty Assign
  const assignCustomer = (c: Customer, birthdayVoucher: boolean, points: number) => {
    setCustomer(c);
    setCustomerId(c.id);
    setBirthday(birthdayVoucher);
    if (birthdayVoucher) setVoucher("");
    setPointRequest(points);
    setPanel(null);
    setToast({ t: `Đã gán khách hàng ${c.name} (${c.tier})`, ok: true });
  };

  // Load O2O Set
  const loadO2OSet = (setItems: BienThe[]) => {
    if (shiftStatus !== "DANG_MO") {
      setOpenShiftModal(true);
      return false;
    }
    const loaded = loadSet(don, setItems);
    if (!loaded) return false;
    setDon(loaded);
    setPanel(null);
    setToast({ t: "Đã nạp toàn bộ set đồ O2O vào hóa đơn", ok: true });
    return true;
  };

  // Low Stock Check (F8)
  const openStockCheck = async () => {
    setPanel("stock");
    setLoadingStock(true);
    try {
      const res = await api<any[]>("/staff/inventory/low-stock?threshold=20&limit=30");
      if (Array.isArray(res)) setStockLowList(res);
    } catch {}
    finally {
      setLoadingStock(false);
    }
  };

  // Print Receipt (K80 thermal receipt & Save as PDF simulation)
  const printReceipt = (order?: Order) => {
    const o = order ?? currentDraftOrder;
    setPrintOrder(o);
    setPrintPicking(!order);
    const prevTitle = typeof document !== "undefined" ? document.title : "";
    if (typeof document !== "undefined") {
      const orderCode = String(o?.orderId || o?.id || "POS").replace(/^#?POS-/, "POS-");
      document.title = `Hoa_Don_${orderCode}_YOFASO`;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        if (typeof document !== "undefined") {
          setTimeout(() => {
            document.title = prevTitle;
          }, 1500);
        }
      });
    });
  };

  // Apply Voucher
  const applyVoucher = () => {
    const v = voucherInput.trim().toUpperCase();
    if (!v) return;
    if (v in VOUCHERS) {
      setBirthday(false);
      setVoucher(v);
      setToast({ t: `Áp dụng voucher ${v}: ${VOUCHERS[v].label}`, ok: true });
    } else {
      // Allow custom voucher code for DB checking during checkout
      setBirthday(false);
      setVoucher(v);
      setToast({ t: `Đã nhập mã voucher ${v}`, ok: true });
    }
    setVoucherInput("");
  };

  // Keyboard Shortcuts
  const handlers = useRef({ handlePay, setPanel, openStockCheck });
  handlers.current = { handlePay, setPanel, openStockCheck };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = handlers.current;
      if (panel) return;
      const map: Record<string, () => void> = {
        F1: () => setPanel("o2o"),
        F2: () => setPanel("loyalty"),
        F8: h.openStockCheck,
        F9: h.handlePay,
        F12: () => {
          setOperationsTab("shift");
          setPanel("operations");
        },
        Escape: () => scanRef.current?.focus(),
      };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]?.();
      } else if (e.key.length === 1 && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
        scanRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        Đang xác thực quyền thu ngân POS…
      </div>
    );
  }

  const currentDraftOrder: Order = {
    id: activeShift ? `${activeShift.shiftId}-TMP` : "POS-DRAFT",
    created: now?.toISOString() ?? new Date().toISOString(),
    lines: don,
    discount: giam,
    pointsUsed,
    customerId: customerId ?? undefined,
    customerName: customer?.name ?? "Khách tại quầy",
    customerPhone: customer?.phone ?? "",
    cashierId: user.name || "Thu ngân",
    method: "CASH",
    tendered: tt,
    total: tt,
    channel: "TAI_QUAY_POS",
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-canvas text-foreground select-none">
      {/* Top Status Bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2 z-10">
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold text-foreground">{user.name}</span>
          </span>

          {activeShift ? (
            <span className="rounded-sm border border-success/40 bg-success-subtle px-2 py-0.5 font-mono text-success font-semibold">
              {activeShift.shiftId} · ĐANG MỞ
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenShiftModal(true)}
              className="h-6 rounded-sm border-warning/50 bg-warning-subtle text-warning text-[11px] font-semibold px-2"
            >
              CHƯA MỞ CA · BẤM ĐỂ MỞ
            </Button>
          )}

          <span className="flex items-center gap-1.5 font-mono text-foreground">
            <Clock className="h-3.5 w-3.5 text-accent" />
            {now ? now.toLocaleTimeString("vi-VN") : "--:--:--"}
          </span>

          {parkedOrders.length > 0 && (
            <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-bold text-accent-hover">
              {parkedOrders.length} đơn tạm
            </span>
          )}
        </div>

        {/* Mobile View Toggle */}
        <div className="flex md:hidden ml-auto items-center gap-1 bg-surface-muted rounded-full p-1 border border-border">
          <Button
            variant={mobileTab === "catalog" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMobileTab("catalog")}
            className="h-7 text-xs rounded-full px-3"
          >
            Sản phẩm
          </Button>
          <Button
            variant={mobileTab === "cart" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMobileTab("cart")}
            className="h-7 text-xs rounded-full px-3 gap-1"
          >
            Hóa đơn
            {don.length > 0 && (
              <span className="bg-accent text-accent-foreground rounded-full px-1.5 text-[10px] font-bold">
                {don.length}
              </span>
            )}
          </Button>
        </div>

        {/* Desktop Action Navigation */}
        <nav className="hidden md:flex ml-auto items-center gap-2" aria-label="Phím tắt POS">
          <Button
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => {
              setOperationsTab("orders");
              setPanel("operations");
            }}
          >
            Đơn hàng & Đổi trả
          </Button>

          {SHORTCUTS.map(([k, l]) => (
            <Button
              variant="outline"
              key={k}
              className="h-8 rounded-full px-2.5 text-xs gap-1.5"
              onClick={() => {
                if (k === "F1") setPanel("o2o");
                if (k === "F2") setPanel("loyalty");
                if (k === "F8") openStockCheck();
                if (k === "F9") handlePay();
                if (k === "F12") {
                  setOperationsTab("shift");
                  setPanel("operations");
                }
              }}
            >
              <kbd className="font-mono font-bold text-accent-hover">{k}</kbd>
              {l}
            </Button>
          ))}

          {/* Quick ratio reset button */}
          <Button
            variant="ghost"
            size="sm"
            title="Đặt lại tỉ lệ 60:40 (Hoặc double click vào thanh chia)"
            onClick={resetSplitRatio}
            className="h-8 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            {splitRatio}:{100 - splitRatio}
          </Button>

          <StaffNotificationPopover role={user.role} />
          <RoleSwitcher />
        </nav>
      </header>

      {/* Main Split Layout: Left Section (Products) & Right Section (Retail Bill) */}
      <main
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row relative"
      >
        {/* Left Side: Product Catalog & Barcode Scanner */}
        <section
          style={{ width: typeof window !== "undefined" && window.innerWidth >= 768 ? `${splitRatio}%` : "100%" }}
          className={`flex min-w-0 shrink-0 flex-col gap-3 p-4 border-border overflow-hidden md:border-r ${
            mobileTab === "catalog" ? "flex flex-1" : "hidden md:flex"
          }`}
        >
          {/* Barcode Search Box */}
          <div className="relative">
            <ScanBarcode className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <input
              ref={scanRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") scanBarcode();
              }}
              placeholder="Quét mã vạch barcode / nhập SKU rồi nhấn Enter…"
              className="h-12 w-full rounded-lg border-2 border-primary bg-surface-muted pl-12 pr-4 font-mono text-sm xl:pr-40 outline-none placeholder:text-muted-foreground focus:bg-surface focus:border-accent"
            />
            <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 font-mono xl:block text-[11px] text-muted-foreground">
              BARCODE · ENTER
            </span>
          </div>

          {/* Category Filter Pills (From Database) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Button
              variant={selectedCategory === "ALL" ? "default" : "outline"}
              onClick={() => {
                setSelectedCategory("ALL");
                fetchProducts("ALL", searchQuery);
              }}
              className="h-8 rounded-full px-3 text-xs shrink-0"
            >
              Tất cả ({products.length})
            </Button>
            {categories.map((cat) => (
              <Button
                variant={selectedCategory === cat.categoryId ? "default" : "outline"}
                key={cat.categoryId}
                onClick={() => {
                  setSelectedCategory(cat.categoryId);
                  fetchProducts(cat.categoryId, searchQuery);
                }}
                className="h-8 rounded-full px-3 text-xs shrink-0"
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Parked Orders Bar (if any) */}
          {parkedOrders.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-surface-muted p-2 border border-border text-xs">
              <span className="font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-accent" />
                Đơn tạm:
              </span>
              {parkedOrders.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  onClick={() => restoreParkedOrder(p)}
                  className="h-7 text-xs rounded-md border-accent/40 bg-surface gap-1 shrink-0"
                >
                  <span className="font-mono font-bold text-accent-hover">{p.id}</span>
                  <span className="text-muted-foreground">({p.lines.length} món)</span>
                </Button>
              ))}
            </div>
          )}

          {/* Product Cards Grid (Responsive auto-fitting to left panel width) */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                <span>Đang tải sản phẩm…</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mb-2 opacity-40" />
                <p>Không tìm thấy sản phẩm trong danh mục này.</p>
              </div>
            ) : (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${splitRatio >= 65 ? "200px" : "160px"}, 1fr))`,
                }}
              >
                {products.map((p) => {
                  const imgUrl = p.coverUrl ? catalogImage(p.coverUrl) : "/assets/p-shirt.jpg";
                  return (
                    <article
                      key={p.productId}
                      onClick={() => handleProductCardClick(p)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-md cursor-pointer"
                    >
                      {/* Product Thumbnail */}
                      <div className="relative aspect-square w-full bg-surface-muted overflow-hidden">
                        <img
                          src={imgUrl}
                          alt={p.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/assets/p-shirt.jpg";
                          }}
                          className="h-full w-full object-contain p-2 mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                        />
                        {p.hasDiscount && (
                          <span className="absolute top-2 left-2 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                            -{p.discountPercent}%
                          </span>
                        )}
                        {p.vtonCategoryLabel && (
                          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {p.vtonCategoryLabel}
                          </span>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <h3 className="line-clamp-2 text-xs font-semibold text-foreground leading-snug group-hover:text-accent-hover">
                          {p.name}
                        </h3>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>

                        <div className="mt-auto pt-2 flex items-baseline justify-between">
                          <span className="font-mono text-sm font-bold text-accent-hover">
                            {vnd(Number(p.minPrice || p.originalPrice || 0))}
                          </span>
                          {p.hasDiscount && p.originalPrice && (
                            <span className="font-mono text-[11px] text-muted-foreground line-through">
                              {vnd(Number(p.originalPrice))}
                            </span>
                          )}
                        </div>

                        {/* Quick action button */}
                        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                          <span>{p.soldCount ? `Đã bán ${p.soldCount}` : "Sẵn sàng"}</span>
                          <span className="flex items-center gap-1 font-semibold text-accent-hover">
                            <PlusCircle className="h-3.5 w-3.5" />
                            Chọn
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Resizable Divider Handle (Hidden on Mobile) */}
        <div
          role="separator"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onDoubleClick={resetSplitRatio}
          title="Kéo sang trái/phải để co giãn tỉ lệ. Nhấp đúp để đặt lại 60:40."
          className={`hidden md:flex w-2.5 items-center justify-center cursor-col-resize hover:bg-accent/20 active:bg-accent/40 transition-colors z-20 group relative border-x border-border ${
            isDragging ? "bg-accent/40" : "bg-surface-muted"
          }`}
        >
          <div className="h-10 w-1 rounded-full bg-muted-foreground/40 group-hover:bg-accent-hover transition-colors flex items-center justify-center">
            <GripVertical className="h-4 w-4 text-muted-foreground/60 group-hover:text-accent-hover -ml-1.5" />
          </div>
        </div>

        {/* Right Side: Retail Bill (Hóa đơn bán lẻ tại quầy) */}
        <aside
          style={{ width: typeof window !== "undefined" && window.innerWidth >= 768 ? `${100 - splitRatio}%` : "100%" }}
          className={`flex min-w-0 shrink-0 flex-col bg-surface border-border overflow-hidden ${
            mobileTab === "cart" ? "flex flex-1" : "hidden md:flex"
          }`}
        >
          {/* Bill Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-surface">
            <div>
              <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
                Hóa đơn bán lẻ tại quầy
                <span className="font-mono text-xs text-accent-hover">
                  #{activeShift ? `${activeShift.shiftId}-01` : "POS-NEW"}
                </span>
              </h1>
              <p className="font-mono text-[11px] text-muted-foreground">
                Kênh: {vnLabel("TAI_QUAY_POS")} · {don.length} mặt hàng ({don.reduce((s, d) => s + d.soLuong, 0)} chiếc)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              title="Tra cứu khách hàng thân thiết (F2)"
              aria-label="Tra cứu khách hàng thân thiết"
              onClick={() => setPanel("loyalty")}
              className="h-8 gap-1.5 text-xs rounded-full px-2.5"
            >
              <User className="h-3.5 w-3.5 text-accent" />
              {customer ? customer.name : "Khách CRM (F2)"}
            </Button>
          </div>

          {/* Assigned Customer Badge */}
          {customer && (
            <div className="flex items-center justify-between border-b border-border bg-accent-subtle px-4 py-2 text-xs">
              <span className="flex items-center gap-1.5">
                <b>{customer.name}</b> · {customer.phone} ·{" "}
                <span className="font-bold text-accent-hover">
                  {({ DONG: "Đồng", BAC: "Bạc", VANG: "Vàng", KIM_CUONG: "Kim Cương" })[customer.tier] || customer.tier}
                </span>{" "}
                ({customer.points} điểm)
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Bỏ khách hàng"
                onClick={() => {
                  setCustomerId(null);
                  setCustomer(null);
                  setBirthday(false);
                  setPointRequest(0);
                }}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Line Items Table */}
          <div className="min-h-40 flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-muted text-left text-[11px] uppercase text-muted-foreground z-10">
                <tr>
                  <th className="px-3 py-2">Sản phẩm / SKU</th>
                  <th className="px-2 py-2 text-right">Đơn giá</th>
                  <th className="px-2 py-2 text-center">SL</th>
                  <th className="px-2 py-2 text-right">Thành tiền</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {don.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-muted-foreground">
                      <Search className="mx-auto mb-2 h-6 w-6 opacity-40" />
                      Quét mã vạch hoặc bấm chọn sản phẩm bên trái để thêm vào hóa đơn
                    </td>
                  </tr>
                )}
                {don.map((d) => (
                  <tr key={d.variantId || d.maQuanLy} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-foreground line-clamp-1">{d.ten}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {d.sku} {d.size ? `· Size ${d.size}` : ""} {d.mau ? `· ${d.mau}` : ""}
                      </p>
                    </td>
                    <td className="px-2 text-right font-mono text-muted-foreground">{vnd(d.donGia)}</td>
                    <td className="px-2">
                      <div className="mx-auto flex w-fit items-center rounded-md border border-border bg-surface">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Giảm"
                          aria-label="Giảm"
                          onClick={() => setQty(d.variantId || d.maQuanLy, -1)}
                          className="h-6 w-6 rounded-sm p-1"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-mono font-bold text-xs">{d.soLuong}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Tăng"
                          aria-label="Tăng"
                          onClick={() => setQty(d.variantId || d.maQuanLy, 1)}
                          className="h-6 w-6 rounded-sm p-1"
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
                        onClick={() => setQty(d.variantId || d.maQuanLy, -999)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-danger-subtle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Checkout & Summary Area */}
          <div className="space-y-3 border-t border-border p-4 bg-surface">
            {/* Voucher input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
                <input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                  placeholder="Mã giảm giá (YOFASO10, FREESHIP50)"
                  className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 font-mono text-xs uppercase outline-none focus:border-primary"
                />
              </div>
              <Button variant="outline" onClick={applyVoucher} className="h-9 px-3 text-xs font-semibold">
                Áp dụng
              </Button>
            </div>

            {voucher && (
              <div className="flex items-center justify-between rounded-md bg-accent-subtle px-3 py-1.5 text-xs">
                <span>
                  <b className="font-mono text-accent-hover">{voucher}</b> — {VOUCHERS[voucher]?.label || "Mã ưu đãi"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Bỏ voucher"
                  aria-label="Bỏ voucher"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setVoucher("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {birthdayActive && (
              <div className="flex items-center justify-between bg-accent-subtle px-3 py-1.5 text-xs rounded-md">
                <span className="font-semibold text-accent-hover">🎂 Ưu đãi sinh nhật −15%</span>
                <Button variant="ghost" size="icon" aria-label="Bỏ ưu đãi sinh nhật" onClick={() => setBirthday(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {pointsUsed > 0 && (
              <div className="text-xs font-semibold text-accent-hover">
                Đổi {pointsUsed} điểm tích lũy · −{vnd(pointsUsed * 100)}
              </div>
            )}

            {/* Calculations Breakdown */}
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tổng tiền hàng</dt>
                <dd className="font-mono font-semibold">{vnd(tong)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Giảm giá / Chiết khấu</dt>
                <dd className="font-mono text-destructive font-semibold">-{vnd(giam)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-end justify-between gap-2 border-t-2 border-dashed border-border pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">TỔNG THANH TOÁN</span>
              <span className="font-mono text-2xl font-bold leading-tight text-accent-hover">{vnd(tt)}</span>
            </div>

            {/* Temporary order / Cancel actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                disabled={!don.length}
                onClick={parkOrder}
                className="h-8 font-semibold text-xs gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Lưu tạm đơn
              </Button>
              <Button
                variant="outline"
                disabled={!don.length}
                onClick={() => don.length && confirm("Xác nhận hủy giỏ hàng hiện tại?") && resetOrder("Đã hủy đơn hàng")}
                className="h-8 font-semibold text-xs text-destructive hover:bg-danger-subtle hover:text-destructive gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Hủy đơn
              </Button>
            </div>

            {/* Primary Payment Button (F9) */}
            <Button
              variant="default"
              disabled={shiftStatus !== "DANG_MO" || !don.length}
              onClick={handlePay}
              className="h-12 w-full gap-2 text-base font-bold shadow-md hover:opacity-95"
            >
              THANH TOÁN <kbd className="font-mono text-xs opacity-75">(F9)</kbd>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      </main>

      {/* Variant Selection Modal (When clicking a product card) */}
      <Dialog
        open={selectedProductForVariant !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProductForVariant(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="text-base font-bold leading-snug">
            Chọn biến thể size & màu sắc
          </DialogTitle>
          <DialogDescription className="text-xs">
            {selectedProductForVariant?.name} · SKU: {selectedProductForVariant?.sku}
          </DialogDescription>

          {loadingVariants ? (
            <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              Đang tải danh sách biến thể SKU…
            </div>
          ) : productVariants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có biến thể khả dụng cho sản phẩm này.
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Danh sách biến thể có sẵn trong kho ({productVariants.length}):
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {productVariants.map((v) => {
                  const rem = tonCon({ ton: v.stock, variantId: v.variantId, maQuanLy: v.sku });
                  const isOut = rem <= 0;
                  return (
                    <div
                      key={v.variantId || v.sku}
                      onClick={() => !isOut && addVariantToCart(v, selectedProductForVariant)}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                        isOut
                          ? "opacity-50 border-border bg-surface-muted cursor-not-allowed"
                          : "border-border bg-surface hover:border-accent hover:bg-accent-subtle cursor-pointer"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Size {v.size}</span>
                          <span className="text-xs text-muted-foreground">· Màu {v.colorName}</span>
                          {v.colors && (
                            <span
                              className="h-3 w-3 rounded-full border border-black/20"
                              style={{ backgroundColor: v.colors.split(",")[0] }}
                            />
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">SKU: {v.sku}</p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono font-bold text-sm text-accent-hover">
                          {vnd(Number(v.salePrice || v.price || 0))}
                        </p>
                        <span
                          className={`text-[11px] font-semibold flex items-center gap-1 justify-end ${
                            isOut ? "text-destructive" : rem <= 5 ? "text-warning" : "text-success"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {isOut ? "Hết hàng" : `Còn ${rem} chiếc`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Open Shift Modal (when shift is not yet opened in database) */}
      <Dialog open={openShiftModal} onOpenChange={setOpenShiftModal}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-bold">Mở ca làm việc thu ngân</DialogTitle>
          <DialogDescription className="text-xs">
            Hệ thống cơ sở dữ liệu yêu cầu mở ca để bắt đầu ghi nhận các giao dịch bán hàng POS.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOpenShift();
            }}
            className="space-y-4 pt-3"
          >
            <label className="block space-y-1.5 text-xs font-semibold">
              Tiền mặt đầu ca (VNĐ)
              <input
                type="number"
                min="0"
                step="1000"
                value={openingAmountInput}
                onChange={(e) => setOpeningAmountInput(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-lg font-bold outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-2">
              {[1000000, 2000000, 3000000].map((v) => (
                <Button
                  type="button"
                  variant="outline"
                  key={v}
                  onClick={() => setOpeningAmountInput(String(v))}
                  className="flex-1 text-xs"
                >
                  {v / 1000000} triệu
                </Button>
              ))}
            </div>
            <Button type="submit" disabled={openingShiftLoading} className="h-11 w-full gap-2 font-bold">
              {openingShiftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Xác nhận mở ca làm việc
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Action Dialogs (Loyalty, O2O, Payment, Operations, Stock) */}
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className={panel === "loyalty" ? "max-w-xl" : "max-w-4xl"}>
          <DialogTitle className="pr-10 text-lg leading-snug">
            {panel === "loyalty"
              ? "Tra cứu khách hàng CRM & Chương trình thân thiết (F2)"
              : panel === "o2o"
              ? "Tra cứu phiên thử đồ ảo O2O (F1)"
              : panel === "payment"
              ? "Thanh toán bán lẻ tại quầy (F9)"
              : panel === "stock"
              ? "Kiểm tồn kho (F8)"
              : "Quản lý đơn hàng & Kết ca"}
          </DialogTitle>
          <DialogDescription>
            YoFaSo Shop · POS Terminal · Thu ngân {user.name}
          </DialogDescription>

          {panel === "loyalty" && <Loyalty payable={tong} onAssign={assignCustomer} />}
          {panel === "o2o" && <O2O products={[]} onLoad={loadO2OSet} onPrint={() => printReceipt()} />}
          {panel === "payment" && (
            <Payment
              draft={currentDraftOrder}
              onComplete={completePayment}
              onPrint={printReceipt}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === "operations" && (
            <Operations
              initialTab={operationsTab}
              orders={[]}
              catalog={[]}
              shiftId={activeShift?.shiftId}
              shiftStatus={shiftStatus}
              onPrint={printReceipt}
              onCloseShift={async (counts, note) => {
                if (!activeShift) return;
                try {
                  const totalCounted = Object.entries(counts).reduce((sum, [d, c]) => sum + Number(d) * Number(c), 0);
                  await api(`/pos/shifts/${encodeURIComponent(activeShift.shiftId)}/close`, "POST", {
                    amount: totalCounted,
                    note,
                  });
                  setShiftStatus("DA_DONG_CHO_DUYET");
                  setPanel(null);
                  pushToast({
                    tone: "success",
                    title: `Đã nộp báo cáo kết ca ${activeShift.shiftId} thành công!`,
                    detail: "Ca đã chuyển trạng thái sang Chờ chủ shop phê duyệt",
                  });
                  fetchShift();
                } catch (err: any) {
                  alert(err.message || "Không thể kết ca.");
                }
              }}
              onOrderUpdated={() => {
                fetchProducts();
                fetchShift();
              }}
            />
          )}
          {panel === "stock" && (
            <div className="space-y-4">
              {loadingStock ? (
                <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                  Đang truy vấn dữ liệu tồn kho…
                </div>
              ) : stockLowList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Kho đang ở mức tồn an toàn, không có biến thể nào dưới ngưỡng cảnh báo.
                </p>
              ) : (
                <div className="overflow-auto max-h-96 rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-left sticky top-0">
                      <tr>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Kích cỡ / Màu</th>
                        <th className="p-3">Vị trí giá kệ</th>
                        <th className="p-3 text-right">Tồn kho Single Pool</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockLowList.map((p) => (
                        <tr key={p.variantId || p.sku} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3 font-mono font-bold">{p.sku}</td>
                          <td className="p-3">
                            Size {p.size} · {p.colorName}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-accent" />
                              {p.shelf || "Kệ chính"}
                            </span>
                          </td>
                          <td className="text-right p-3 font-mono font-bold text-destructive">
                            {p.stock ?? p.soLuongTonKho ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Printing Sheet */}
      {now &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="print-sheet">
            {printOrder && <Receipt order={printOrder} />}
            {printPicking && (
              <article className="picking-slip">
                <h2>YOFASO · PHIẾU LẤY ĐỒ THỬ</h2>
                <p>Mã phiên: TD00000001</p>
                <p>Áo polo cổ sen đen · M · Kệ A-01</p>
                <p>Quần jeans ống suông · M · Kệ B-03</p>
              </article>
            )}
          </div>,
          document.body
        )}

      {/* Toast Notification */}
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
