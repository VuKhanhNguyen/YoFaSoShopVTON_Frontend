"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  adminOrderTotal,
  voucherError,
  type AdminOrder,
  type AdminOrderStatus,
  type AdminVoucher,
  type AdminReview,
  type VoucherKind,
} from "@/lib/admin";
import { vnd } from "@/lib/pos";
import { api, catalogImage } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import { vnLabel } from "@/lib/vietnamese-labels";
import { Badge, Confirm, Field, PageHeading, SubTabs, TablePagination, inputClass } from "./shared";

type View = "orders" | "vouchers" | "reviews" | "customers";

const STATUS: Record<AdminOrderStatus, string> = {
  CHO_XAC_NHAN: "Chờ xác nhận",
  DANG_DONG_GOI: "Đang đóng gói",
  DANG_GIAO_HANG: "Đang giao hàng",
  HOAN_TAT: "Hoàn tất",
  DA_HUY: "Đã hủy",
  TRA_HANG: "Trả hàng",
};

export interface AdminCustomer {
  userId: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  dateOfBirth?: string;
  points: number;
  membership: "DONG" | "BAC" | "VANG" | "KIM_CUONG" | string;
  gender: "NAM" | "NU" | "KHAC" | string;
  status: "HOAT_DONG" | "KHOA_TAM_THOI" | string;
}

const MEMBERSHIP_LABELS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" }> = {
  DONG: { label: "Đồng", tone: "neutral" },
  BAC: { label: "Bạc", tone: "info" },
  VANG: { label: "Vàng", tone: "warning" },
  KIM_CUONG: { label: "Kim Cương", tone: "success" },
};

const GENDER_LABELS: Record<string, string> = {
  NAM: "Nam",
  NU: "Nữ",
  KHAC: "Khác",
};

export function formatBirthDate(dob?: string): string {
  if (!dob) return "—";
  const clean = dob.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return dob;
}

export function AdminOperations({
  orders,
  setOrders,
  vouchers,
  setVouchers,
  reviews,
  setReviews,
  log,
  initialView,
  highlightOrderId,
}: {
  orders: AdminOrder[];
  setOrders: Dispatch<SetStateAction<AdminOrder[]>>;
  vouchers: AdminVoucher[];
  setVouchers: Dispatch<SetStateAction<AdminVoucher[]>>;
  reviews: AdminReview[];
  setReviews: Dispatch<SetStateAction<AdminReview[]>>;
  log: (action: string, reason: string) => void;
  initialView?: View;
  highlightOrderId?: string | null;
}) {
  const [view, setView] = useState<View>(initialView || "orders");
  const [channel, setChannel] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState(highlightOrderId || "");

  // Admin Broadcast Notification Dialog
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastType, setBroadcastType] = useState<"KHUYEN_MAI" | "HE_THONG">("KHUYEN_MAI");
  const [broadcastTier, setBroadcastTier] = useState<"ALL" | "DONG" | "BAC" | "VANG" | "KIM_CUONG">("ALL");
  const [broadcastLink, setBroadcastLink] = useState("/promotions");
  const [broadcastSending, setBroadcastSending] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = broadcastTitle.trim();
    const content = broadcastContent.trim();
    if (!title || !content) {
      pushToast({ tone: "error", title: "Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo." });
      return;
    }
    setBroadcastSending(true);
    try {
      const res = await api<{ sentCount: number; targetTier: string }>(
        "/admin/notifications/broadcast",
        "POST",
        {
          title,
          content,
          type: broadcastType,
          targetTier: broadcastTier,
          link: broadcastLink.trim() || "/promotions",
        },
      );
      pushToast({
        tone: "success",
        title: `Đã gửi thông báo tới ${res.sentCount} khách hàng`,
        detail: `Nhóm đối tượng: ${res.targetTier === "ALL" ? "Toàn bộ khách hàng" : `Hạng ${res.targetTier}`}`,
      });
      log("Phát thông báo hàng loạt", `${title} (${res.sentCount} khách hàng · ${broadcastTier})`);
      setBroadcastOpen(false);
      setBroadcastTitle("");
      setBroadcastContent("");
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không thể phát thông báo hàng loạt",
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBroadcastSending(false);
    }
  };

  const [detail, setDetail] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState("");

  const [newVoucher, setNewVoucher] = useState(false);
  const [draft, setDraft] = useState<AdminVoucher>({
    code: "",
    name: "",
    kind: "PERCENT",
    value: 10,
    minimum: 500000,
    cap: 100000,
    quantity: 100,
    used: 0,
    expires: "2026-10-31",
  });

  const [photo, setPhoto] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [replySaved, setReplySaved] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [aiAssistingId, setAiAssistingId] = useState<string | null>(null);
  const [reviewAiMap, setReviewAiMap] = useState<
    Record<
      string,
      {
        sentiment: string;
        flags: string[];
        needsAttention: boolean;
        suggestedReplies: string[];
      }
    >
  >({});

  const handleReviewAiAssist = async (reviewId: string) => {
    setAiAssistingId(reviewId);
    try {
      const res = await api<{
        sentiment: string;
        flags: string[];
        needsAttention: boolean;
        suggestedReplies: string[];
      }>("/admin/ai/review-assist", "POST", { reviewId });
      setReviewAiMap((prev) => ({ ...prev, [reviewId]: res }));
      pushToast({ tone: "success", title: "AI đã phân tích đánh giá và gợi ý câu trả lời" });
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không phân tích được đánh giá bằng AI",
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAiAssistingId(null);
    }
  };

  // Customer Management state (MySQL DB integrated)
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("ALL");
  const [customerToToggle, setCustomerToToggle] = useState<AdminCustomer | null>(null);
  const [customerDetailModal, setCustomerDetailModal] = useState<AdminCustomer | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const CUSTOMER_PAGE_SIZE = 10;

  // Orders State & Filters
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderPage, setOrderPage] = useState(1);

  useEffect(() => {
    if (!initialView) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setView(initialView);
    });
    return () => {
      active = false;
    };
  }, [initialView]);

  useEffect(() => {
    if (!highlightOrderId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setView("orders");
      setSearch(highlightOrderId);
      setOrderPage(1);
    });
    return () => {
      active = false;
    };
  }, [highlightOrderId]);
  const ORDER_PAGE_SIZE = 10;
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [editRecipient, setEditRecipient] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNote, setEditNote] = useState("");
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [editOrderError, setEditOrderError] = useState("");

  // Vouchers State & Filters
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState("ALL");
  const [voucherKindFilter, setVoucherKindFilter] = useState("ALL");
  const [voucherPage, setVoucherPage] = useState(1);
  const VOUCHER_PAGE_SIZE = 10;

  // Reviews State & Filters
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("ALL");
  const [reviewStarsFilter, setReviewStarsFilter] = useState("ALL");
  const [reviewVerifiedFilter, setReviewVerifiedFilter] = useState("ALL");
  const [reviewStartDate, setReviewStartDate] = useState("");
  const [reviewEndDate, setReviewEndDate] = useState("");
  const [reviewPage, setReviewPage] = useState(1);
  const REVIEW_PAGE_SIZE = 10;

  // Sync Customers from MySQL
  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await api<AdminCustomer[]>("/admin/users?role=CUSTOMER");
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    } catch (err) {
      console.warn("Could not fetch real customers, retaining current state:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Sync Orders from MySQL
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await api<
        Array<{
          orderId: string;
          createdAt: string;
          channel: string;
          recipientName: string;
          phone: string;
          address: string;
          shipperId?: string;
          status: string;
          paymentStatus: string;
          paymentMethod?: string;
          discount?: number;
          subtotal?: number;
          collectAmount?: number;
        }>
      >("/staff/orders?page=0&size=100");
      if (Array.isArray(data) && data.length > 0) {
        const mapped: AdminOrder[] = data.map((o) => {
          const rawSubtotal = Number(o.subtotal || o.collectAmount || 0);
          const rawDiscount = Number(o.discount || 0);
          return {
            id: o.orderId,
            date: o.createdAt || new Date().toISOString(),
            channel: o.channel === "TAI_QUAY_POS" ? "TAI_QUAY_POS" : "ONLINE_APP",
            customer: o.recipientName || "Khách hàng",
            phone: o.phone || "—",
            address: o.address || "Nhận tại quầy",
            shipper: o.shipperId ? `Shipper ${o.shipperId}` : "Chưa bàn giao",
            status: (o.status || "CHO_XAC_NHAN") as AdminOrderStatus,
            paymentMethod: o.paymentMethod,
            paid: o.paymentStatus === "DA_THANH_TOAN",
            lines: [
              {
                name: "Sản phẩm đơn hàng",
                qty: 1,
                price: rawSubtotal > 0 ? rawSubtotal : rawDiscount,
              },
            ],
            discount: rawDiscount,
            history: [o.createdAt ? `Khởi tạo đơn lúc ${o.createdAt}` : "Đơn hàng khởi tạo"],
          };
        });
        setOrders(mapped);
      }
    } catch (err) {
      console.warn("Could not fetch real orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Sync Vouchers from MySQL
  const loadVouchers = async () => {
    setLoadingVouchers(true);
    try {
      const data = await api<
        Array<{
          code: string;
          name: string;
          type: string;
          value: number;
          minimumTotal: number;
          maxDiscount: number;
          quantity: number;
          used: number;
          expiresAt: string;
        }>
      >("/admin/promotions");
      if (Array.isArray(data) && data.length > 0) {
        const mapped: AdminVoucher[] = data.map((p) => ({
          code: p.code,
          name: p.name,
          kind:
            p.type === "PHAN_TRAM"
              ? "PERCENT"
              : p.type === "MIEN_PHI_VAN_CHUYEN"
              ? "SHIPPING"
              : "FIXED",
          value: Number(p.value || 0),
          minimum: Number(p.minimumTotal || 0),
          cap: Number(p.maxDiscount || 0),
          quantity: Number(p.quantity || 0),
          used: Number(p.used || 0),
          expires: (p.expiresAt || "").split("T")[0] || "2026-12-31",
        }));
        setVouchers(mapped);
      }
    } catch (err) {
      console.warn("Could not fetch real promotions:", err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  // Sync Reviews from MySQL
  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const data = await api<
        Array<{
          reviewId: string;
          customerName: string;
          lineId: string;
          orderId?: string;
          productName: string;
          stars: number;
          comment: string;
          reply: string;
          status: string;
          verified: boolean;
          photoUrl?: string | null;
          createdAt?: string;
        }>
      >("/admin/reviews?page=0&size=100");
      if (Array.isArray(data)) {
        const mapped: AdminReview[] = data.map((r) => ({
          id: r.reviewId,
          customer: r.customerName || "Khách hàng",
          lineId: r.lineId || "DH-REAL",
          orderId: r.orderId || (r.lineId?.startsWith("CTDH") ? `DH${r.lineId.slice(4).padStart(8, "0")}` : r.lineId),
          product: r.productName || "Sản phẩm thời trang",
          stars: r.stars || 5,
          comment: r.comment || "",
          reply: r.reply || "",
          status:
            r.status === "DA_HIEN_THI" || r.status === "HIEN_THI"
              ? "HIEN_THI"
              : r.status === "DA_AN_VI_PHAM" || r.status === "DA_AN"
              ? "DA_AN"
              : "CHO_DUYET",
          verified: Boolean(r.verified),
          photoUrl: r.photoUrl || null,
          createdAt: r.createdAt || undefined,
        }));
        setReviews(mapped);
      }
    } catch (err) {
      console.warn("Could not fetch real reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Sync all tabs on mount directly
  useEffect(() => {
    let active = true;

    api<AdminCustomer[]>("/admin/users?role=CUSTOMER")
      .then((data) => {
        if (active && Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {});

    api<
      Array<{
        orderId: string;
        createdAt: string;
        channel: string;
        recipientName: string;
        phone: string;
        address: string;
        shipperId?: string;
        status: string;
        paymentStatus: string;
        paymentMethod?: string;
        discount?: number;
        subtotal?: number;
        collectAmount?: number;
      }>
    >("/staff/orders?page=0&size=100")
      .then((data) => {
        if (!active || !Array.isArray(data) || data.length === 0) return;
        const mapped: AdminOrder[] = data.map((o) => {
          const rawSubtotal = Number(o.subtotal || o.collectAmount || 0);
          const rawDiscount = Number(o.discount || 0);
          return {
            id: o.orderId,
            date: o.createdAt || new Date().toISOString(),
            channel: o.channel === "TAI_QUAY_POS" ? "TAI_QUAY_POS" : "ONLINE_APP",
            customer: o.recipientName || "Khách hàng",
            phone: o.phone || "—",
            address: o.address || "Nhận tại quầy",
            shipper: o.shipperId ? `Shipper ${o.shipperId}` : "Chưa bàn giao",
            status: (o.status || "CHO_XAC_NHAN") as AdminOrderStatus,
            paymentMethod: o.paymentMethod,
            paid: o.paymentStatus === "DA_THANH_TOAN",
            lines: [
              {
                name: "Sản phẩm đơn hàng",
                qty: 1,
                price: rawSubtotal > 0 ? rawSubtotal : rawDiscount,
              },
            ],
            discount: rawDiscount,
            history: [o.createdAt ? `Khởi tạo đơn lúc ${o.createdAt}` : "Đơn hàng khởi tạo"],
          };
        });
        setOrders(mapped);
      })
      .catch(() => {});

    api<
      Array<{
        code: string;
        name: string;
        type: string;
        value: number;
        minimumTotal: number;
        maxDiscount: number;
        quantity: number;
        used: number;
        expiresAt: string;
      }>
    >("/admin/promotions")
      .then((data) => {
        if (!active || !Array.isArray(data) || data.length === 0) return;
        const mapped: AdminVoucher[] = data.map((p) => ({
          code: p.code,
          name: p.name,
          kind:
            p.type === "PHAN_TRAM"
              ? "PERCENT"
              : p.type === "MIEN_PHI_VAN_CHUYEN"
              ? "SHIPPING"
              : "FIXED",
          value: Number(p.value || 0),
          minimum: Number(p.minimumTotal || 0),
          cap: Number(p.maxDiscount || 0),
          quantity: Number(p.quantity || 0),
          used: Number(p.used || 0),
          expires: (p.expiresAt || "").split("T")[0] || "2026-12-31",
        }));
        setVouchers(mapped);
      })
      .catch(() => {});

    api<
      Array<{
        reviewId: string;
        customerName: string;
        lineId: string;
        productName: string;
        stars: number;
        comment: string;
        reply: string;
        status: string;
        verified: boolean;
        photoUrl?: string | null;
        createdAt?: string;
        orderId?: string;
      }>
    >("/admin/reviews?page=0&size=100")
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const mapped: AdminReview[] = data.map((r) => ({
          id: r.reviewId,
          customer: r.customerName || "Khách hàng",
          lineId: r.lineId || "DH-REAL",
          orderId: r.orderId || (r.lineId?.startsWith("CTDH") ? `DH${r.lineId.slice(4).padStart(8, "0")}` : r.lineId),
          product: r.productName || "Sản phẩm thời trang",
          stars: r.stars || 5,
          comment: r.comment || "",
          reply: r.reply || "",
          status:
            r.status === "DA_HIEN_THI" || r.status === "HIEN_THI"
              ? "HIEN_THI"
              : r.status === "DA_AN_VI_PHAM" || r.status === "DA_AN"
              ? "DA_AN"
              : "CHO_DUYET",
          verified: Boolean(r.verified),
          photoUrl: r.photoUrl || null,
          createdAt: r.createdAt || undefined,
        }));
        setReviews(mapped);
      })
      .catch((err) => {
        console.warn("Could not initial load reviews:", err);
      });

    return () => {
      active = false;
    };
  }, [setOrders, setReviews, setVouchers]);

  // Auto-sync tab data when switching subtabs
  useEffect(() => {
    if (view === "reviews") {
      void loadReviews();
    } else if (view === "customers") {
      void loadCustomers();
    } else if (view === "orders") {
      void loadOrders();
    } else if (view === "vouchers") {
      void loadVouchers();
    }
  }, [view]);

  // Sync order line details when detail dialog opens
  useEffect(() => {
    if (!detail) return;
    api<{
      items?: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
      }>;
    }>(`/staff/orders/${detail}`)
      .then((data) => {
        if (data?.items && data.items.length > 0) {
          const fetchedLines = data.items.map((it) => ({
            name: it.productName,
            qty: it.quantity,
            price: it.unitPrice,
          }));
          setOrders((prev) =>
            prev.map((o) => (o.id === detail ? { ...o, lines: fetchedLines } : o))
          );
        }
      })
      .catch(() => {});
  }, [detail, setOrders]);

  const handleToggleCustomerStatus = async () => {
    if (!customerToToggle) return;
    setTogglingStatus(true);
    const nextStatus = customerToToggle.status === "HOAT_DONG" ? "KHOA_TAM_THOI" : "HOAT_DONG";
    try {
      await api(`/admin/users/${customerToToggle.userId}/status`, "PATCH", {
        status: nextStatus,
      });
      setCustomers((prev) =>
        prev.map((c) => (c.userId === customerToToggle.userId ? { ...c, status: nextStatus } : c))
      );
      log(
        `${nextStatus === "KHOA_TAM_THOI" ? "Khóa" : "Mở khóa"} tài khoản khách hàng ${customerToToggle.username}`,
        `Cập nhật trạng thái người dùng ${customerToToggle.userId}`
      );
      pushToast({
        tone: "success",
        title: nextStatus === "KHOA_TAM_THOI" ? "Đã khóa tài khoản khách hàng" : "Đã mở khóa tài khoản khách hàng",
        detail: `${customerToToggle.fullName} (@${customerToToggle.username})`,
      });
      setCustomerToToggle(null);
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không cập nhật được trạng thái khách hàng",
        detail: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTogglingStatus(false);
    }
  };

  const selected = orders.find((o) => o.id === detail);
  const filtered = orders.filter(
    (o) =>
      (channel === "ALL" || channel === o.channel) &&
      (status === "ALL" || status === o.status) &&
      `${o.id} ${o.customer} ${o.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalOrderPages = Math.max(1, Math.ceil(filtered.length / ORDER_PAGE_SIZE));
  const safeOrderPage = Math.min(orderPage, totalOrderPages);
  const paginatedOrders = filtered.slice(
    (safeOrderPage - 1) * ORDER_PAGE_SIZE,
    safeOrderPage * ORDER_PAGE_SIZE
  );

  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setEditOrderError("");
    setUpdatingOrder(true);
    try {
      await api(`/admin/orders/${editingOrder.id}`, "PATCH", {
        recipientName: editRecipient.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        note: editNote.trim() || undefined,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id
            ? {
                ...o,
                customer: editRecipient.trim(),
                phone: editPhone.trim(),
                address: editAddress.trim(),
                        history: editNote.trim()
                  ? [...o.history, `[Quản trị viên sửa] ${editNote.trim()}`]
                  : o.history,
              }
            : o
        )
      );
      log(`Cập nhật đơn hàng #${editingOrder.id}`, `Người nhận: ${editRecipient.trim()}`);
      pushToast({ tone: "success", title: `Đã cập nhật đơn hàng #${editingOrder.id}` });
      setEditingOrder(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cập nhật đơn hàng thất bại.";
      setEditOrderError(msg);
      pushToast({ tone: "error", title: msg });
    } finally {
      setUpdatingOrder(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const getVoucherStatus = (v: AdminVoucher) => {
    if (v.expires < todayStr) return "HET_HAN";
    if (v.used >= v.quantity) return "HET_LUOT";
    return "DANG_DIEN_RA";
  };

  const filteredVouchers = vouchers.filter((v) => {
    const vStatus = getVoucherStatus(v);
    const matchStatus = voucherStatusFilter === "ALL" || vStatus === voucherStatusFilter;
    const matchKind = voucherKindFilter === "ALL" || v.kind === voucherKindFilter;
    const matchSearch = `${v.code} ${v.name}`.toLowerCase().includes(voucherSearch.toLowerCase());
    return matchStatus && matchKind && matchSearch;
  });

  const totalVoucherPages = Math.max(1, Math.ceil(filteredVouchers.length / VOUCHER_PAGE_SIZE));
  const safeVoucherPage = Math.min(voucherPage, totalVoucherPages);
  const paginatedVouchers = filteredVouchers.slice(
    (safeVoucherPage - 1) * VOUCHER_PAGE_SIZE,
    safeVoucherPage * VOUCHER_PAGE_SIZE
  );

  const filteredReviews = reviews.filter((r) => {
    const matchStatus = reviewStatusFilter === "ALL" || r.status === reviewStatusFilter;
    const matchStars = reviewStarsFilter === "ALL" || String(r.stars) === reviewStarsFilter;
    const matchVerified =
      reviewVerifiedFilter === "ALL" ||
      (reviewVerifiedFilter === "VERIFIED" && r.verified) ||
      (reviewVerifiedFilter === "UNVERIFIED" && !r.verified);
    const matchSearch = `${r.customer} ${r.product} ${r.comment} ${r.lineId} ${r.orderId || ""}`
      .toLowerCase()
      .includes(reviewSearch.toLowerCase());

    const reviewDate = r.createdAt ? r.createdAt.slice(0, 10) : "";
    const matchStartDate = !reviewStartDate || (Boolean(reviewDate) && reviewDate >= reviewStartDate);
    const matchEndDate = !reviewEndDate || (Boolean(reviewDate) && reviewDate <= reviewEndDate);

    return matchStatus && matchStars && matchVerified && matchSearch && matchStartDate && matchEndDate;
  });

  const totalReviewPages = Math.max(1, Math.ceil(filteredReviews.length / REVIEW_PAGE_SIZE));
  const safeReviewPage = Math.min(reviewPage, totalReviewPages);
  const paginatedReviews = filteredReviews.slice(
    (safeReviewPage - 1) * REVIEW_PAGE_SIZE,
    safeReviewPage * REVIEW_PAGE_SIZE
  );

  const filteredCustomers = customers.filter((c) => {
    const matchFilter = customerStatusFilter === "ALL" || c.status === customerStatusFilter;
    const matchSearch = `${c.username} ${c.fullName} ${c.phone} ${c.email}`
      .toLowerCase()
      .includes(customerSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalCustomerPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  const safeCustomerPage = Math.min(customerPage, totalCustomerPages);
  const paginatedCustomers = filteredCustomers.slice(
    (safeCustomerPage - 1) * CUSTOMER_PAGE_SIZE,
    safeCustomerPage * CUSTOMER_PAGE_SIZE
  );

  const updateReview = async (
    id: string,
    patch: Partial<AdminReview>,
    successTitle?: string
  ): Promise<boolean> => {
    setSavingReviewId(id);
    try {
      const target = reviews.find((r) => r.id === id);
      const nextStatus = patch.status
        ? patch.status === "HIEN_THI"
          ? "DA_HIEN_THI"
          : patch.status === "DA_AN"
          ? "DA_AN_VI_PHAM"
          : "CHO_DUYET"
        : target?.status === "HIEN_THI"
        ? "DA_HIEN_THI"
        : target?.status === "DA_AN"
        ? "DA_AN_VI_PHAM"
        : "CHO_DUYET";
      const nextReply = patch.reply !== undefined ? patch.reply : target?.reply || "";
      await api(`/admin/reviews/${id}`, "PATCH", {
        status: nextStatus,
        reply: nextReply,
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch, reply: nextReply } : r))
      );
      if (successTitle) {
        pushToast({ tone: "success", title: successTitle });
      }
      return true;
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không lưu được kiểm duyệt đánh giá",
        detail: err instanceof Error ? err.message : undefined,
      });
      return false;
    } finally {
      setSavingReviewId(null);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="Retail operations · Community"
        title="Đơn hàng, khuyến mãi & khách hàng"
        detail="Quản trị đa kênh · Quản lý đơn hàng, mã giảm giá, kiểm duyệt đánh giá và hồ sơ khách hàng"
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <SubTabs
          tabs={[
            { key: "orders", label: "Đơn hàng đa kênh" },
            { key: "vouchers", label: "Khuyến mãi & Voucher" },
            { key: "reviews", label: "Kiểm duyệt đánh giá" },
            { key: "customers", label: "Khách hàng" },
          ]}
          active={view}
          setActive={setView}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBroadcastOpen(true)}
          className="mb-4 gap-1.5"
        >
          <Megaphone className="h-3.5 w-3.5 text-accent-hover" />
          Phát thông báo khách hàng
        </Button>
      </div>

      {/* SUBTAB 1: ORDERS */}
      {view === "orders" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Đơn hàng đa kênh</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Quản lý đơn hàng trực tuyến và tại quầy POS, trạng thái thanh toán và phân công vận chuyển.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadOrders} disabled={loadingOrders}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
              Làm mới dữ liệu
            </Button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm đơn hàng"
                className={`${inputClass} pl-9`}
                placeholder="Mã đơn, khách hàng, SĐT..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOrderPage(1);
                }}
              />
            </div>
            <select
              aria-label="Kênh đơn hàng"
              className={inputClass}
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                setOrderPage(1);
              }}
            >
              <option value="ALL">Tất cả kênh</option>
              <option value="ONLINE_APP">Online (App)</option>
              <option value="TAI_QUAY_POS">Tại quầy thu ngân</option>
            </select>
            <select
              aria-label="Trạng thái đơn hàng"
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOrderPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(STATUS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã đơn / Thời gian</th>
                  <th>Kênh</th>
                  <th>Người nhận / SĐT</th>
                  <th>Shipper</th>
                  <th>Tổng thanh toán</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => {
                      setDetail(o.id);
                      setAddress(o.address);
                      setNote("");
                      setError("");
                    }}
                  >
                    <td>
                      <strong className="font-mono">{o.id}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">{o.date.replace("T", " ")}</p>
                    </td>
                    <td>
                      <Badge tone={o.channel === "ONLINE_APP" ? "info" : "neutral"}>
                        {vnLabel(o.channel)}
                      </Badge>
                    </td>
                    <td>
                      {o.customer}
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{o.phone}</p>
                    </td>
                    <td className="text-xs">{o.shipper}</td>
                    <td className="font-mono">{vnd(adminOrderTotal(o))}</td>
                    <td>
                      <Badge tone={o.paid ? "success" : "warning"}>
                        {vnLabel(o.paid ? "DA_THANH_TOAN" : "CHUA_THANH_TOAN")}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.status === "DA_HUY" || o.status === "TRA_HANG"
                            ? "danger"
                            : o.status === "HOAN_TAT"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {vnLabel(o.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          title="Xem chi tiết đơn hàng"
                          onClick={() => {
                            setDetail(o.id);
                            setAddress(o.address);
                            setNote("");
                            setError("");
                          }}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-foreground hover:bg-muted"
                          title="Chỉnh sửa đơn hàng"
                          onClick={() => {
                            setEditingOrder(o);
                            setEditRecipient(o.customer);
                            setEditPhone(o.phone);
                            setEditAddress(o.address);
                            setEditNote("");
                            setEditOrderError("");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {loadingOrders ? "Đang tải dữ liệu đơn hàng..." : "Không có đơn phù hợp bộ lọc."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={safeOrderPage}
            totalPages={totalOrderPages}
            totalItems={filtered.length}
            pageSize={ORDER_PAGE_SIZE}
            onPageChange={setOrderPage}
            unit="đơn hàng"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {filtered.length} đơn · Tổng thanh toán tính từ số lượng × đơn giá − giảm giá.
          </p>
        </>
      )}

      {/* SUBTAB 2: VOUCHERS */}
      {view === "vouchers" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Chương trình khuyến mãi & Voucher</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Quản lý các mã giảm giá, chiết khấu và ưu đãi miễn phí vận chuyển.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadVouchers} disabled={loadingVouchers}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingVouchers ? "animate-spin" : ""}`} />
                Làm mới dữ liệu
              </Button>
              <Button
                onClick={() => {
                  setError("");
                  setNewVoucher(true);
                }}
              >
                <Plus />
                Tạo Voucher mới
              </Button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm kiếm khuyến mãi"
                className={`${inputClass} pl-9`}
                placeholder="Tìm mã voucher, tên chương trình..."
                value={voucherSearch}
                onChange={(e) => {
                  setVoucherSearch(e.target.value);
                  setVoucherPage(1);
                }}
              />
            </div>
            <select
              aria-label="Lọc theo loại khuyến mãi"
              className={inputClass}
              value={voucherKindFilter}
              onChange={(e) => {
                setVoucherKindFilter(e.target.value);
                setVoucherPage(1);
              }}
            >
              <option value="ALL">Tất cả loại voucher</option>
              <option value="PERCENT">Phần trăm (%)</option>
              <option value="FIXED">Giảm tiền trực tiếp</option>
              <option value="SHIPPING">Miễn phí vận chuyển</option>
            </select>
            <select
              aria-label="Lọc theo trạng thái voucher"
              className={inputClass}
              value={voucherStatusFilter}
              onChange={(e) => {
                setVoucherStatusFilter(e.target.value);
                setVoucherPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DANG_DIEN_RA">Đang diễn ra</option>
              <option value="HET_LUOT">Hết lượt</option>
              <option value="HET_HAN">Hết hạn</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã / Tên chương trình</th>
                  <th>Điều kiện</th>
                  <th>Mức giảm</th>
                  <th>Đã dùng</th>
                  <th>Hạn sử dụng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVouchers.map((v) => {
                  const vStatus = getVoucherStatus(v);
                  return (
                    <tr key={v.code}>
                      <td>
                        <strong className="font-mono">{v.code}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">{v.name}</p>
                      </td>
                      <td>Từ {vnd(v.minimum)}</td>
                      <td>
                        {v.kind === "PERCENT"
                          ? `${v.value}%`
                          : v.kind === "SHIPPING"
                          ? vnLabel("MIEN_PHI_VAN_CHUYEN")
                          : vnd(v.value)}
                        <p className="mt-1 text-xs text-muted-foreground">Tối đa {vnd(v.cap)}</p>
                      </td>
                      <td className="font-mono">
                        {v.used}/{v.quantity}
                      </td>
                      <td className="font-mono text-xs">{v.expires.split("-").reverse().join("/")}</td>
                      <td>
                        <Badge
                          tone={
                            vStatus === "DANG_DIEN_RA"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {vnLabel(vStatus)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {loadingVouchers ? "Đang tải dữ liệu voucher..." : "Không tìm thấy chương trình khuyến mãi phù hợp."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={safeVoucherPage}
            totalPages={totalVoucherPages}
            totalItems={filteredVouchers.length}
            pageSize={VOUCHER_PAGE_SIZE}
            onPageChange={setVoucherPage}
            unit="chương trình"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredVouchers.length} chương trình · Dữ liệu đồng bộ trực tiếp từ bảng <code>KhuyenMai</code>.
          </p>
        </>
      )}

      {/* SUBTAB 3: REVIEWS */}
      {view === "reviews" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Đánh giá từ khách đã mua</h2>
              <Badge>{reviews.filter((r) => r.status === "CHO_DUYET").length} chờ duyệt</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={loadReviews} disabled={loadingReviews}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingReviews ? "animate-spin" : ""}`} />
              Làm mới dữ liệu
            </Button>
          </div>

          {/* Filters row: Search + Selects + Date Range (all on 1 horizontal row) */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-44 sm:w-52 shrink-0">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm kiếm đánh giá"
                className="h-10 w-full min-w-0 rounded-md border border-input bg-surface pl-9 pr-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="Tìm khách hàng, SP..."
                value={reviewSearch}
                onChange={(e) => {
                  setReviewSearch(e.target.value);
                  setReviewPage(1);
                }}
              />
            </div>
            <select
              aria-label="Lọc theo trạng thái duyệt"
              className="h-10 shrink-0 cursor-pointer rounded-md border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
              value={reviewStatusFilter}
              onChange={(e) => {
                setReviewStatusFilter(e.target.value);
                setReviewPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CHO_DUYET">Chờ duyệt</option>
              <option value="HIEN_THI">Đã hiển thị</option>
              <option value="DA_AN">Đã ẩn do vi phạm</option>
            </select>
            <select
              aria-label="Lọc theo số sao"
              className="h-10 shrink-0 cursor-pointer rounded-md border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
              value={reviewStarsFilter}
              onChange={(e) => {
                setReviewStarsFilter(e.target.value);
                setReviewPage(1);
              }}
            >
              <option value="ALL">Tất cả số sao</option>
              <option value="5">5 sao</option>
              <option value="4">4 sao</option>
              <option value="3">3 sao</option>
              <option value="2">2 sao</option>
              <option value="1">1 sao</option>
            </select>
            <select
              aria-label="Lọc theo xác thực mua hàng"
              className="h-10 shrink-0 cursor-pointer rounded-md border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
              value={reviewVerifiedFilter}
              onChange={(e) => {
                setReviewVerifiedFilter(e.target.value);
                setReviewPage(1);
              }}
            >
              <option value="ALL">Tất cả đánh giá</option>
              <option value="VERIFIED">Đã mua xác thực</option>
              <option value="UNVERIFIED">Chưa xác thực</option>
            </select>

            {/* Date range filter */}
            <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4 text-accent-hover shrink-0" />
              <span className="shrink-0 font-medium">Từ:</span>
              <input
                type="date"
                aria-label="Đánh giá từ ngày"
                className="h-7 w-[125px] rounded border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                value={reviewStartDate}
                onChange={(e) => {
                  setReviewStartDate(e.target.value);
                  setReviewPage(1);
                }}
              />
              <span className="shrink-0 font-medium">Đến:</span>
              <input
                type="date"
                aria-label="Đánh giá đến ngày"
                className="h-7 w-[125px] rounded border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                value={reviewEndDate}
                onChange={(e) => {
                  setReviewEndDate(e.target.value);
                  setReviewPage(1);
                }}
              />
              {(reviewStartDate || reviewEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Đặt lại ngày"
                  onClick={() => {
                    setReviewStartDate("");
                    setReviewEndDate("");
                    setReviewPage(1);
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {reviewStartDate && reviewEndDate && reviewStartDate > reviewEndDate && (
            <div className="mb-3 text-xs text-destructive font-medium">
              Khoảng ngày không hợp lệ (Từ ngày &gt; Đến ngày).
            </div>
          )}

          {paginatedReviews.map((r) => (
            <article key={r.id} className="mb-4 rounded-md border border-border bg-surface p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong>{r.customer}</strong>
                  <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{r.product}</span>
                    <span>·</span>
                    <span>Đơn hàng: <strong className="font-mono text-foreground">{r.orderId || "Chưa gắn đơn"}</strong></span>
                    {r.createdAt && (
                      <>
                        <span>·</span>
                        <span>Đánh giá lúc: <span className="font-mono text-foreground">{new Date(r.createdAt.replace(" ", "T")).toLocaleString("vi-VN")}</span></span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={r.verified ? "success" : "danger"}>
                    {r.verified ? "Đã mua hàng xác thực" : "Chưa xác thực"}
                  </Badge>
                  <Badge
                    tone={
                      r.status === "HIEN_THI"
                        ? "success"
                        : r.status === "DA_AN"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {r.status === "HIEN_THI"
                      ? "Đã hiển thị"
                      : r.status === "DA_AN"
                      ? "Đã ẩn vi phạm"
                      : "Chờ duyệt"}
                  </Badge>
                </div>
              </div>
              <div
                className="my-3 flex gap-1 text-accent-hover"
                aria-label={`${r.stars} sao`}
              >
                {Array.from({ length: r.stars }, (_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">“{r.comment}”</p>
              <div className="my-4 flex flex-wrap items-start gap-4">
                {r.photoUrl && (
                  <Button
                    variant="catalog"
                    className="h-auto p-1 shrink-0"
                    aria-label="Xem ảnh đánh giá thực tế"
                    onClick={() => {
                      setCurrentPhoto(catalogImage(r.photoUrl));
                      setPhoto(true);
                    }}
                  >
                    <img
                      src={catalogImage(r.photoUrl)}
                      alt="Ảnh thực tế sản phẩm"
                      className="h-[72px] w-[72px] rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <Field label="Phản hồi chính thức từ YoFaSo">
                    <textarea
                      className={`${inputClass} h-20 py-2 break-words`}
                      placeholder="Nhập phản hồi của shop dành cho khách hàng..."
                      value={replyDrafts[r.id] ?? r.reply}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                  </Field>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingReviewId === r.id || !(replyDrafts[r.id] ?? r.reply).trim()}
                      onClick={async () => {
                        const replyText = (replyDrafts[r.id] ?? r.reply).trim();
                        const ok = await updateReview(
                          r.id,
                          { reply: replyText },
                          "Đã gửi phản hồi đánh giá cho khách hàng"
                        );
                        if (ok) {
                          log(`Phản hồi đánh giá ${r.id}`, replyText);
                          setReplySaved(r.id);
                        }
                      }}
                    >
                      <MessageSquare />
                      Gửi phản hồi
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={aiAssistingId === r.id}
                      onClick={() => void handleReviewAiAssist(r.id)}
                    >
                      {aiAssistingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
                      )}
                      AI Kiểm tra & Gợi ý trả lời
                    </Button>
                    {replySaved === r.id && (
                      <span role="status" className="text-xs text-success">
                        Đã gửi phản hồi
                      </span>
                    )}
                  </div>
                  {reviewAiMap[r.id] && (
                    <div className="mt-3 rounded-lg border border-accent/35 bg-accent-subtle/40 p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            reviewAiMap[r.id].sentiment === "TICH_CUC"
                              ? "success"
                              : reviewAiMap[r.id].sentiment === "TIEU_CUC"
                              ? "danger"
                              : "warning"
                          }
                        >
                          Sắc thái:{" "}
                          {reviewAiMap[r.id].sentiment === "TICH_CUC"
                            ? "Tích cực"
                            : reviewAiMap[r.id].sentiment === "TIEU_CUC"
                            ? "Tiêu cực"
                            : "Trung lập"}
                        </Badge>
                        {reviewAiMap[r.id].needsAttention && (
                          <Badge tone="danger">Cần chú ý / Xử lý gấp</Badge>
                        )}
                      </div>
                      {reviewAiMap[r.id].flags.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-destructive">
                          {reviewAiMap[r.id].flags.map((flag, i) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      )}
                      {reviewAiMap[r.id].suggestedReplies.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="font-semibold text-muted-foreground">
                            Bấm vào mẫu câu bên dưới để điền vào ô phản hồi (Admin tự duyệt gửi):
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {reviewAiMap[r.id].suggestedReplies.map((sug, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() =>
                                  setReplyDrafts((prev) => ({ ...prev, [r.id]: sug }))
                                }
                                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-xs text-foreground hover:border-accent hover:bg-muted"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  disabled={savingReviewId === r.id || !r.verified || r.status === "HIEN_THI"}
                  onClick={async () => {
                    const replyText = (replyDrafts[r.id] ?? r.reply).trim();
                    const ok = await updateReview(
                      r.id,
                      { status: "HIEN_THI", ...(replyText ? { reply: replyText } : {}) },
                      `Đã duyệt hiển thị đánh giá ${r.id}`
                    );
                    if (ok) log(`Duyệt hiển thị đánh giá ${r.id}`, "Mua hàng xác thực");
                  }}
                >
                  Duyệt hiển thị
                </Button>
                <Button
                  variant="outline"
                  disabled={savingReviewId === r.id || r.status === "DA_AN"}
                  onClick={async () => {
                    const ok = await updateReview(
                      r.id,
                      { status: "DA_AN" },
                      `Đã ẩn đánh giá vi phạm ${r.id}`
                    );
                    if (ok) log(`Ẩn đánh giá ${r.id}`, "Kiểm duyệt vi phạm");
                  }}
                >
                  Ẩn vi phạm
                </Button>
              </div>
            </article>
          ))}
          {filteredReviews.length === 0 && (
            <div className="rounded-md border border-border bg-surface p-8 text-center text-muted-foreground">
              {loadingReviews ? "Đang tải dữ liệu đánh giá..." : "Không tìm thấy đánh giá phù hợp bộ lọc."}
            </div>
          )}

          <TablePagination
            page={safeReviewPage}
            totalPages={totalReviewPages}
            totalItems={filteredReviews.length}
            pageSize={REVIEW_PAGE_SIZE}
            onPageChange={setReviewPage}
            unit="đánh giá"
          />

          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredReviews.length} đánh giá · Dữ liệu đồng bộ trực tiếp từ bảng <code>DanhGiaSanPham</code>.
          </p>
        </>
      )}

      {/* SUBTAB 4: CUSTOMERS (MySQL Real DB Integration) */}
      {view === "customers" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Hồ sơ khách hàng đa kênh</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Dữ liệu cá nhân khách hàng được bảo vệ nghiêm ngặt: không hiển thị mật khẩu và không hỗ trợ sửa/xóa hồ sơ khách.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadCustomers} disabled={loadingCustomers}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingCustomers ? "animate-spin" : ""}`} />
              Làm mới dữ liệu
            </Button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm khách hàng"
                className={`${inputClass} pl-9`}
                placeholder="Tìm theo tên đăng nhập, họ tên, số điện thoại, email..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerPage(1);
                }}
              />
            </div>
            <select
              aria-label="Bộ lọc trạng thái khách hàng"
              className={inputClass}
              value={customerStatusFilter}
              onChange={(e) => {
                setCustomerStatusFilter(e.target.value);
                setCustomerPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="HOAT_DONG">Đang hoạt động</option>
              <option value="KHOA_TAM_THOI">Đã khóa tạm thời</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên tài khoản</th>
                  <th>Họ và tên</th>
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Địa chỉ nhận hàng mặc định</th>
                  <th>Ngày sinh</th>
                  <th>Điểm</th>
                  <th>Hạng thẻ</th>
                  <th>Giới tính</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c) => {
                  const mb = MEMBERSHIP_LABELS[c.membership] ?? { label: c.membership, tone: "neutral" };
                  const isLocked = c.status === "KHOA_TAM_THOI";
                  return (
                    <tr
                      key={c.userId}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setCustomerDetailModal(c)}
                    >
                      <td className="font-mono text-xs font-bold text-accent-hover">
                        @{c.username}
                      </td>
                      <td className="font-semibold text-foreground">{c.fullName}</td>
                      <td className="font-mono text-xs">{c.phone || "—"}</td>
                      <td className="font-mono text-xs text-muted-foreground">{c.email || "—"}</td>
                      <td className="max-w-[220px] truncate text-xs" title={c.address}>
                        {c.address || "Chưa thiết lập"}
                      </td>
                      <td className="font-mono text-xs">
                        {formatBirthDate(c.dateOfBirth)}
                      </td>
                      <td className="font-mono font-bold text-accent">{c.points.toLocaleString("vi-VN")}</td>
                      <td>
                        <Badge tone={mb.tone}>{mb.label}</Badge>
                      </td>
                      <td className="text-xs">{GENDER_LABELS[c.gender] || c.gender}</td>
                      <td>
                        <Badge tone={isLocked ? "danger" : "success"}>
                          {isLocked ? "Khóa tạm thời" : "Hoạt động"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant={isLocked ? "success" : "outline"}
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerToToggle(c);
                          }}
                        >
                          {isLocked ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              Mở khóa
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 text-destructive" />
                              Khóa
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-muted-foreground">
                      {loadingCustomers ? "Đang tải dữ liệu từ máy chủ..." : "Không tìm thấy khách hàng phù hợp."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={safeCustomerPage}
            totalPages={totalCustomerPages}
            totalItems={filteredCustomers.length}
            pageSize={CUSTOMER_PAGE_SIZE}
            onPageChange={setCustomerPage}
            unit="khách hàng"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Hiển thị {filteredCustomers.length} khách hàng · Dữ liệu đồng bộ trực tiếp từ bảng <code>NguoiDung</code> và <code>SoDiaChi</code>.
          </p>
        </>
      )}

      {/* Customer Lock/Unlock Confirmation Dialog */}
      {customerToToggle && (
        <ConfirmDialog
          open={Boolean(customerToToggle)}
          title={
            customerToToggle.status === "HOAT_DONG"
              ? `Xác nhận khóa tài khoản khách hàng?`
              : `Xác nhận mở khóa tài khoản khách hàng?`
          }
          description={
            customerToToggle.status === "HOAT_DONG" ? (
              <span>
                Tài khoản <strong>{customerToToggle.fullName}</strong> (@{customerToToggle.username} · {customerToToggle.phone ? `SĐT ${customerToToggle.phone}` : "Chưa có SĐT"}) sẽ bị chuyển sang trạng thái <code>KHOA_TAM_THOI</code>. Khách hàng sẽ không thể đăng nhập hoặc đặt đơn mới.
              </span>
            ) : (
              <span>
                Tài khoản <strong>{customerToToggle.fullName}</strong> (@{customerToToggle.username}) sẽ được kích hoạt lại trạng thái <code>HOAT_DONG</code>.
              </span>
            )
          }
          tone={customerToToggle.status === "HOAT_DONG" ? "danger" : "success"}
          confirmLabel={customerToToggle.status === "HOAT_DONG" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          loading={togglingStatus}
          onConfirm={handleToggleCustomerStatus}
          onClose={() => setCustomerToToggle(null)}
        />
      )}

      {/* Order Detail Modal */}
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogTitle>Đơn hàng {selected.id}</DialogTitle>
            <DialogDescription>
              {selected.customer} · {selected.phone} · {STATUS[selected.status]}
            </DialogDescription>
              {selected.paymentMethod === "VIETQR_CHUYEN_KHOAN_ONLINE" && !selected.paid && selected.status === "CHO_XAC_NHAN" && (
                <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const button = form.querySelector("button");
                  if (button) button.disabled = true;
                  try {
                    await api("/admin/orders/" + selected.id + "/confirm-payment", "POST", {
                      transactionRef: String(new FormData(form).get("reference") ?? "").trim(),
                    });
                    setOrders((rows) => rows.map((o) => o.id === selected.id ? { ...o, paid: true } : o));
                    pushToast({ tone: "success", title: "Đã xác nhận khoản tiền thực nhận." });
                  } catch (error) {
                    pushToast({ tone: "error", title: error instanceof Error ? error.message : "Không thể xác nhận thanh toán." });
                  } finally {
                    if (button) button.disabled = false;
                  }
                }}>
                  <input className={inputClass} name="reference" aria-label="Mã giao dịch ngân hàng" placeholder="Mã giao dịch ngân hàng" required maxLength={100} />
                  <Button type="submit">Xác nhận đã đối soát tiền về</Button>
                </form>
              )}
            <div className="space-y-2 border-y border-border py-3">
              {selected.lines.map((l) => (
                <div key={l.name} className="flex justify-between gap-3 text-sm">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span className="font-mono">{vnd(l.qty * l.price)}</span>
                </div>
              ))}
              <p className="text-right text-xs text-muted-foreground">
                Giảm giá {vnd(selected.discount)}
              </p>
              <p className="text-right font-mono text-lg font-bold">
                {vnd(adminOrderTotal(selected))}
              </p>
            </div>
            <Field label="Địa chỉ giao hàng">
              <textarea
                className={`${inputClass} h-20 py-2`}
                value={address}
                disabled={
                  selected.channel === "TAI_QUAY_POS" ||
                  ["DA_HUY", "HOAN_TAT"].includes(selected.status)
                }
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Field label="Giải trình / Khiếu nại">
              <textarea
                className={`${inputClass} h-20 py-2`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <h3 className="text-xs font-semibold">Lịch sử đơn hàng</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {selected.history.map((h, i) => (
                <li key={i} className="border-l-2 border-accent pl-3">
                  {h}
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="destructive"
                disabled={["DA_HUY", "HOAN_TAT"].includes(selected.status)}
                onClick={() => {
                  if (!note.trim()) {
                    setError("Nhập lý do hủy đơn.");
                    return;
                  }
                  setCancel(true);
                }}
              >
                Hủy đơn
              </Button>
              <Button
                disabled={!address.trim()}
                onClick={async () => {
                  if (!note.trim()) {
                    setError("Nhập giải trình cho thay đổi / khiếu nại.");
                    return;
                  }
                  try {
                    await api(`/admin/orders/${selected.id}`, "PATCH", {
                      recipientName: selected.customer,
                      phone: selected.phone,
                      address: address.trim(),
                      note: note.trim(),
                    });
                    setOrders(
                      orders.map((o) =>
                        o.id === selected.id
                          ? {
                              ...o,
                              address: address.trim(),
                              history: [...o.history, `Chủ shop cập nhật: ${note.trim()}`],
                            }
                          : o
                      )
                    );
                    log(`Cập nhật đơn ${selected.id}`, note.trim());
                    pushToast({ tone: "success", title: `Đã lưu can thiệp đơn ${selected.id}` });
                    setDetail(null);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Không thể cập nhật đơn hàng.";
                    setError(msg);
                    pushToast({ tone: "error", title: msg });
                  }
                }}
              >
                Lưu can thiệp
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {cancel && selected && (
        <Confirm
          title={`Xác nhận hủy ${selected.id}?`}
          detail={`Lý do: ${note}. ${
            selected.paid
              ? "Đơn đã thanh toán: ghi nhận yêu cầu hoàn tiền, không hoàn tiền thật."
              : "Đơn chưa thanh toán."
          }`}
          danger
          close={() => setCancel(false)}
          confirm={async () => {
            try {
              await api("/admin/orders/" + selected.id + "/cancel", "POST");
            } catch (error) {
              pushToast({ tone: "error", title: error instanceof Error ? error.message : "Không thể hủy đơn." });
              return;
            }
            setOrders(
              orders.map((o) =>
                o.id === selected.id
                  ? {
                      ...o,
                      status: "DA_HUY",
                      history: [
                        ...o.history,
                        `Hủy bởi chủ shop: ${note}`,
                        ...(o.paid ? ["Chờ xử lý hoàn tiền mô phỏng"] : []),
                      ],
                    }
                  : o
              )
            );
            log(`Hủy đơn ${selected.id}`, note);
            pushToast({ tone: "success", title: `Đã hủy đơn hàng ${selected.id}` });
            setCancel(false);
            setDetail(null);
          }}
        />
      )}

      {newVoucher && (
        <Dialog open onOpenChange={setNewVoucher}>
          <DialogContent>
            <DialogTitle>Tạo Voucher mới</DialogTitle>
            <DialogDescription>Khuyến mãi phát hành trên hệ thống YoFaSo.</DialogDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mã voucher">
                <input
                  className={inputClass}
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().trim() })}
                />
              </Field>
              <Field label="Tên chương trình">
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Loại giảm">
                <select
                  className={inputClass}
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as VoucherKind })}
                >
                  <option value="PERCENT">Phần trăm</option>
                  <option value="FIXED">Số tiền cố định</option>
                  <option value="SHIPPING">Phí vận chuyển</option>
                </select>
              </Field>
              {(
                [
                  { k: "value", l: draft.kind === "PERCENT" ? "Mức giảm (%)" : "Mức giảm (đ)" },
                  { k: "minimum", l: "Đơn tối thiểu (đ)" },
                  { k: "cap", l: "Giảm tối đa (đ)" },
                  { k: "quantity", l: "Số lượng phát hành" },
                ] as const
              ).map((f) => (
                <Field key={f.k} label={f.l}>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    value={draft[f.k]}
                    onChange={(e) => setDraft({ ...draft, [f.k]: Number(e.target.value) })}
                  />
                </Field>
              ))}
              <Field label="Hạn sử dụng">
                <input
                  className={inputClass}
                  type="date"
                  value={draft.expires}
                  onChange={(e) => setDraft({ ...draft, expires: e.target.value })}
                />
              </Field>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={async () => {
                const invalid = voucherError(draft, vouchers);
                if (invalid) {
                  setError(invalid);
                  return;
                }
                try {
                  const type =
                    draft.kind === "PERCENT"
                      ? "PHAN_TRAM"
                      : draft.kind === "SHIPPING"
                      ? "MIEN_PHI_VAN_CHUYEN"
                      : "TIEN_MAT_TRUC_TIEP";
                  await api("/admin/promotions", "POST", {
                    code: draft.code,
                    name: draft.name,
                    type,
                    value: draft.value,
                    minimumTotal: draft.minimum,
                    maxDiscount: draft.cap,
                    quantity: draft.quantity,
                    startsAt: new Date().toISOString(),
                    endsAt: new Date(draft.expires + "T23:59:59Z").toISOString(),
                  });
                  await loadVouchers();
                  log(`Tạo voucher ${draft.code}`, draft.name);
                  pushToast({ tone: "success", title: `Đã phát hành voucher ${draft.code}` });
                  setNewVoucher(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Không thể phát hành voucher.";
                  setError(msg);
                  pushToast({ tone: "error", title: msg });
                }
              }}
            >
              Phát hành voucher
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: CUSTOMER DETAIL */}
      {customerDetailModal && (
        <Dialog open onOpenChange={(open) => !open && setCustomerDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Hồ sơ khách hàng: {customerDetailModal.fullName}</DialogTitle>
            <DialogDescription>
              Thông tin chi tiết tài khoản khách hàng lưu trữ trong hệ thống YoFaSo.
            </DialogDescription>
            <div className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mã khách hàng</p>
                <p className="font-mono font-bold text-foreground">{customerDetailModal.userId}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Tên đăng nhập</p>
                <p className="font-mono font-bold text-accent">@{customerDetailModal.username}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Họ và tên</p>
                <p className="font-semibold text-foreground">{customerDetailModal.fullName}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Số điện thoại</p>
                <p className="font-mono text-foreground">{customerDetailModal.phone || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-foreground truncate">{customerDetailModal.email || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Giới tính</p>
                <p className="font-semibold text-foreground">{GENDER_LABELS[customerDetailModal.gender] || customerDetailModal.gender}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ngày sinh (dd/mm/yyyy)</p>
                <p className="font-mono font-bold text-foreground">{formatBirthDate(customerDetailModal.dateOfBirth)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Hạng thẻ & Điểm tích lũy</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={MEMBERSHIP_LABELS[customerDetailModal.membership]?.tone || "neutral"}>
                    {MEMBERSHIP_LABELS[customerDetailModal.membership]?.label || customerDetailModal.membership}
                  </Badge>
                  <span className="font-mono font-bold text-accent">{customerDetailModal.points.toLocaleString("vi-VN")} điểm</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Địa chỉ nhận hàng</p>
                <p className="text-foreground">{customerDetailModal.address || "Chưa thiết lập địa chỉ"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Trạng thái tài khoản</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={customerDetailModal.status === "KHOA_TAM_THOI" ? "danger" : "success"}>
                    {customerDetailModal.status === "KHOA_TAM_THOI" ? "Khóa tạm thời" : "Hoạt động bình thường"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setCustomerDetailModal(null)}>
                Đóng
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL: EDIT ORDER */}
      {editingOrder && (
        <Dialog open onOpenChange={(open) => !open && setEditingOrder(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Chỉnh sửa đơn hàng #{editingOrder.id}</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin giao vận và trạng thái đơn hàng trong hệ thống.
            </DialogDescription>

            <div className="rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="font-semibold mb-1">Quy chuẩn kế toán & Đạo đức nghề nghiệp:</p>
              Chủ shop và Quản trị viên chỉ được phép điều chỉnh thông tin người nhận, địa chỉ và trạng thái đơn. Các thông số giá trị sản phẩm, số lượng, voucher giảm giá và tổng tiền là <strong>bất biến</strong> để tránh gian lận tài chính và sai lệch kho.
            </div>

            {editOrderError && (
              <p role="alert" className="text-xs text-destructive font-medium">
                {editOrderError}
              </p>
            )}

            <form onSubmit={handleSaveOrderEdit} className="space-y-3 pt-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tên người nhận hàng">
                  <input
                    required
                    className={inputClass}
                    value={editRecipient}
                    onChange={(e) => setEditRecipient(e.target.value)}
                  />
                </Field>
                <Field label="Số điện thoại nhận hàng">
                  <input
                    required
                    type="tel"
                    className={inputClass}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Địa chỉ giao hàng">
                <textarea
                  required
                  rows={2}
                  className={`${inputClass} h-16 py-2`}
                  value={editAddress}
                  disabled={editingOrder.channel === "TAI_QUAY_POS"}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </Field>

              <Field label="Ghi chú cập nhật / Lý do điều chỉnh">
                <input
                  placeholder="vd: Khách yêu cầu đổi địa chỉ nhận do chuyển nhà"
                  className={inputClass}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </Field>

              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kênh bán:</span>
                  <span className="font-medium">{vnLabel(editingOrder.channel)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng tiền thanh toán (Read-only):</span>
                  <strong className="font-mono text-foreground">{vnd(adminOrderTotal(editingOrder))}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thanh toán:</span>
                  <span className="font-medium">{editingOrder.paid ? "Đã thanh toán" : "Chưa thanh toán"}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingOrder(null)} disabled={updatingOrder}>
                  Hủy
                </Button>
                <Button type="submit" disabled={updatingOrder}>
                  {updatingOrder ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {broadcastOpen && (
        <Dialog open onOpenChange={setBroadcastOpen}>
          <DialogContent className="max-w-lg">
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4.5 w-4.5 text-accent-hover" />
              Phát thông báo hàng loạt (Broadcast)
            </DialogTitle>
            <DialogDescription>
              Lưu vào bảng <code>ThongBao</code>, đồng bộ realtime và gửi Push Notification tới app khách hàng.
            </DialogDescription>
            <form onSubmit={handleSendBroadcast} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nhóm thông báo">
                  <select
                    className={inputClass}
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value as "KHUYEN_MAI" | "HE_THONG")}
                  >
                    <option value="KHUYEN_MAI">Khuyến mãi &amp; Ưu đãi</option>
                    <option value="HE_THONG">Thông báo hệ thống</option>
                  </select>
                </Field>
                <Field label="Đối tượng nhận">
                  <select
                    className={inputClass}
                    value={broadcastTier}
                    onChange={(e) =>
                      setBroadcastTier(
                        e.target.value as "ALL" | "DONG" | "BAC" | "VANG" | "KIM_CUONG",
                      )
                    }
                  >
                    <option value="ALL">Tất cả khách hàng</option>
                    <option value="DONG">Hạng Đồng</option>
                    <option value="BAC">Hạng Bạc</option>
                    <option value="VANG">Hạng Vàng</option>
                    <option value="KIM_CUONG">Hạng Kim Cương</option>
                  </select>
                </Field>
              </div>

              <Field label="Tiêu đề thông báo">
                <input
                  required
                  maxLength={150}
                  placeholder="vd: Ưu đãi cuối tuần — Giảm 15% BST mới"
                  className={inputClass}
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                />
              </Field>

              <Field label="Nội dung chi tiết">
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="Nhập nội dung đầy đủ hiển thị trong hộp thư khách hàng..."
                  className={`${inputClass} h-24 py-2`}
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                />
              </Field>

              <Field label="Đường dẫn điều hướng khi bấm vào (tùy chọn)">
                <input
                  placeholder="/promotions hoặc /product/SP00000001"
                  className={inputClass}
                  value={broadcastLink}
                  onChange={(e) => setBroadcastLink(e.target.value)}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBroadcastOpen(false)}
                  disabled={broadcastSending}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={broadcastSending} className="gap-1.5">
                  {broadcastSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {broadcastSending ? "Đang gửi..." : "Gửi thông báo ngay"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {photo && (
        <Dialog open onOpenChange={setPhoto}>
          <DialogContent className="max-w-2xl">
            <DialogTitle>Ảnh đánh giá thực tế</DialogTitle>
            <DialogDescription>Ảnh chụp thực tế từ khách hàng đánh giá đơn hàng.</DialogDescription>
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt="Ảnh đánh giá thực tế"
                className="mx-auto max-h-[75vh] w-auto max-w-full rounded-md object-contain"
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Không có ảnh đính kèm.</p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
