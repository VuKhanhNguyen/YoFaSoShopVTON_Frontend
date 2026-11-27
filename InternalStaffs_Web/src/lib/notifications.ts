import { api } from "@/lib/api";
import type { Role } from "@/lib/auth";

export type NotifType =
  | "CANH_BAO_KHO"
  | "DON_HANG"
  | "THU_DO_VTON"
  | "KHUYEN_MAI"
  | "HE_THONG";

export type NotifTab = "all" | "stock" | "orders" | "approvals";

export interface StaffNotification {
  id: string;
  type: NotifType;
  tab: Exclude<NotifTab, "all">;
  title: string;
  body: string;
  time: string;
  fullTime: string;
  createdAtRaw?: string;
  link?: string;
  read: boolean;
  urgent?: boolean;
}

export interface ApiNotificationRow {
  notificationId: string;
  title?: string;
  /** Backend trả `message`; giữ fallback `content` để tương thích ngược */
  message?: string;
  content?: string;
  type?: string;
  link?: string | null;
  /** Backend trả `readStatus`; giữ fallback `read` để tương thích ngược */
  readStatus?: boolean;
  read?: boolean;
  createdAt?: string;
}

export const NOTIF_TYPE_LABELS: Record<NotifType, string> = {
  CANH_BAO_KHO: "Cảnh báo kho",
  DON_HANG: "Đơn hàng",
  THU_DO_VTON: "Thử đồ VTON",
  KHUYEN_MAI: "Khuyến mãi",
  HE_THONG: "Hệ thống / Phê duyệt",
};

function parseDateSafe(raw?: string): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRelativeTime(raw?: string): string {
  if (!raw) return "Vừa xong";
  const parsed = parseDateSafe(raw);
  if (!parsed) return raw;
  const diffMin = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(raw?: string): string {
  const parsed = parseDateSafe(raw) ?? new Date();
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapApiNotification(row: ApiNotificationRow): StaffNotification {
  const rawType = (row.type || "HE_THONG").toUpperCase();
  const type: NotifType =
    rawType === "CANH_BAO_KHO" ||
    rawType === "DON_HANG" ||
    rawType === "THU_DO_VTON" ||
    rawType === "KHUYEN_MAI"
      ? (rawType as NotifType)
      : "HE_THONG";
  const tab: Exclude<NotifTab, "all"> =
    type === "CANH_BAO_KHO"
      ? "stock"
      : type === "DON_HANG"
        ? "orders"
        : "approvals";
  const title = row.title || "Thông báo hệ thống";
  const body = String(row.message ?? row.content ?? "");
  const isRead = Boolean(row.readStatus ?? row.read ?? false);
  const lowerTitle = title.toLowerCase();
  const urgent =
    type === "CANH_BAO_KHO" ||
    lowerTitle.includes("chờ duyệt") ||
    lowerTitle.includes("cảnh báo") ||
    lowerTitle.includes("thất bại") ||
    lowerTitle.includes("hủy");

  return {
    id: row.notificationId,
    type,
    tab,
    title,
    body,
    time: formatRelativeTime(row.createdAt),
    fullTime: formatFullDateTime(row.createdAt),
    createdAtRaw: row.createdAt,
    link: row.link || undefined,
    read: isRead,
    urgent,
  };
}

/**
 * Chuẩn hóa toàn bộ LienKetDieuHuong từ DB / Backend sang route Next.js thực tế theo vai trò,
 * đảm bảo bấm CTA từ thông báo không bao giờ rơi vào trang 404.
 */
export function resolveStaffNotificationLink(
  rawLink: string | undefined | null,
  type: NotifType | string | undefined,
  role: Role,
): string | null {
  const link = (rawLink || "").trim();

  if (link.startsWith("/admin/dashboard")) {
    return role === "ROLE_SHOP_ADMIN" ? link : roleDefaultLink(role, type);
  }
  if (link.startsWith("/warehouse/fulfillment")) {
    return role === "ROLE_STAFF_WAREHOUSE" || role === "ROLE_SHOP_ADMIN"
      ? link
      : roleDefaultLink(role, type);
  }
  if (link.startsWith("/shipper/deliveries")) {
    return role === "ROLE_STAFF_SHIPPER" || role === "ROLE_SHOP_ADMIN"
      ? link
      : roleDefaultLink(role, type);
  }
  if (link.startsWith("/pos/terminal")) {
    return role === "ROLE_STAFF_CASHIER" || role === "ROLE_SHOP_ADMIN"
      ? link
      : roleDefaultLink(role, type);
  }

  // Ánh xạ các link cũ (legacy seed URL) hoặc link rút gọn
  if (link.startsWith("/admin/inventory")) {
    return role === "ROLE_STAFF_WAREHOUSE"
      ? "/warehouse/fulfillment?tab=audit"
      : role === "ROLE_SHOP_ADMIN"
        ? "/admin/dashboard?tab=governance&view=stock"
        : roleDefaultLink(role, type);
  }
  if (link.startsWith("/admin/shifts")) {
    return role === "ROLE_STAFF_CASHIER"
      ? "/pos/terminal?panel=shift"
      : role === "ROLE_SHOP_ADMIN"
        ? "/admin/dashboard?tab=governance&view=shift"
        : roleDefaultLink(role, type);
  }
  if (link.startsWith("/admin/fulfillment")) {
    return role === "ROLE_STAFF_WAREHOUSE"
      ? "/warehouse/fulfillment?tab=pick"
      : role === "ROLE_SHOP_ADMIN"
        ? "/admin/dashboard?tab=operations&view=orders"
        : roleDefaultLink(role, type);
  }
  if (link.startsWith("/admin/reports")) {
    return role === "ROLE_SHOP_ADMIN" ? "/admin/dashboard?tab=finance" : roleDefaultLink(role, type);
  }
  if (link.startsWith("/admin/reviews")) {
    return role === "ROLE_SHOP_ADMIN"
      ? "/admin/dashboard?tab=operations&view=reviews"
      : roleDefaultLink(role, type);
  }
  if (link.startsWith("/admin/livechat") || link === "/chat" || link.startsWith("/chat?")) {
    return role === "ROLE_SHOP_ADMIN" ? "/admin/dashboard?tab=livechat" : null;
  }
  if (link.startsWith("/shipper/tasks")) {
    return role === "ROLE_STAFF_SHIPPER" || role === "ROLE_SHOP_ADMIN"
      ? "/shipper/deliveries"
      : roleDefaultLink(role, type);
  }
  if (link.startsWith("/pos/shift")) {
    return role === "ROLE_STAFF_CASHIER" || role === "ROLE_SHOP_ADMIN"
      ? "/pos/terminal?panel=shift"
      : roleDefaultLink(role, type);
  }

  const orderMatch = link.match(/^\/orders?\/([A-Za-z0-9_-]+)/i);
  if (orderMatch) {
    const orderId = encodeURIComponent(orderMatch[1]);
    switch (role) {
      case "ROLE_SHOP_ADMIN":
        return `/admin/dashboard?tab=operations&view=orders&order=${orderId}`;
      case "ROLE_STAFF_WAREHOUSE":
        return `/warehouse/fulfillment?tab=pick&order=${orderId}`;
      case "ROLE_STAFF_SHIPPER":
        return `/shipper/deliveries?order=${orderId}`;
      case "ROLE_STAFF_CASHIER":
        return "/pos/terminal";
    }
  }

  if (link.startsWith("/promotions") || link.startsWith("/voucher")) {
    return role === "ROLE_SHOP_ADMIN" ? "/admin/dashboard?tab=operations&view=vouchers" : null;
  }

  if (!link) return roleDefaultLink(role, type);
  return roleDefaultLink(role, type);
}

function roleDefaultLink(role: Role, type?: string): string | null {
  switch (role) {
    case "ROLE_SHOP_ADMIN":
      if (type === "CANH_BAO_KHO") return "/admin/dashboard?tab=governance&view=stock";
      if (type === "DON_HANG") return "/admin/dashboard?tab=operations&view=orders";
      if (type === "KHUYEN_MAI") return "/admin/dashboard?tab=operations&view=vouchers";
      return "/admin/dashboard?tab=governance&view=shift";
    case "ROLE_STAFF_WAREHOUSE":
      return type === "CANH_BAO_KHO"
        ? "/warehouse/fulfillment?tab=audit"
        : "/warehouse/fulfillment?tab=pick";
    case "ROLE_STAFF_SHIPPER":
      return "/shipper/deliveries";
    case "ROLE_STAFF_CASHIER":
      return type === "HE_THONG" ? "/pos/terminal?panel=shift" : "/pos/terminal";
    default:
      return null;
  }
}

export function visibleForRole(list: StaffNotification[], role: Role): StaffNotification[] {
  return role ? list : list;
}

export function filterByTab(list: StaffNotification[], tab: NotifTab): StaffNotification[] {
  return tab === "all" ? list : list.filter((n) => n.tab === tab);
}

export function markAllRead(list: StaffNotification[]): StaffNotification[] {
  return list.map((n) => ({ ...n, read: true }));
}

export function markRead(list: StaffNotification[], id: string): StaffNotification[] {
  return list.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function unreadCount(list: StaffNotification[]): number {
  return list.filter((n) => !n.read).length;
}

/* ==================== Web Push (VAPID) & Sound Helpers ==================== */

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function registerStaffServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    return reg;
  } catch {
    return null;
  }
}

export async function getExistingWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeWebPush(): Promise<{
  ok: boolean;
  reason?: "unsupported" | "denied" | "unavailable" | "error";
  message: string;
}> {
  if (!isWebPushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Trình duyệt hiện tại không hỗ trợ Web Push (cần HTTPS hoặc localhost).",
    };
  }

  let keyRes: { enabled: boolean; publicKey: string };
  try {
    keyRes = await api<{ enabled: boolean; publicKey: string }>("/notifications/web-push/public-key");
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Không thể kết nối máy chủ để lấy khóa công khai Web Push.",
    };
  }

  if (!keyRes?.enabled || !keyRes.publicKey) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        "Máy chủ chưa cấu hình WEB_PUSH_VAPID_PUBLIC_KEY / PRIVATE_KEY. Thông báo SSE vẫn hoạt động khi mở tab.",
    };
  }

  const perm =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (perm !== "granted") {
    return {
      ok: false,
      reason: "denied",
      message: "Bạn đã chặn quyền thông báo trên trình duyệt. Hãy bật lại trong cài đặt trang web.",
    };
  }

  try {
    const reg = (await registerStaffServiceWorker()) ?? (await navigator.serviceWorker.ready);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey),
      });
    }
    const p256dh = arrayBufferToBase64Url(sub.getKey("p256dh"));
    const auth = arrayBufferToBase64Url(sub.getKey("auth"));
    const deviceName =
      typeof navigator !== "undefined"
        ? `Web (${navigator.userAgent.slice(0, 80)})`
        : "Trình duyệt nội bộ";

    await api("/notifications/devices", "POST", {
      platform: "TRINH_DUYET",
      token: sub.endpoint,
      p256dh,
      auth,
      deviceName,
    });
    return { ok: true, message: "Đã bật thông báo đẩy trình duyệt (Web Push)." };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message:
        err instanceof Error ? err.message : "Không thể đăng ký Web Push trên trình duyệt này.",
    };
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await api("/notifications/devices/unregister", "POST", { token: sub.endpoint }).catch(
        () => {},
      );
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // Bỏ qua lỗi khi trình duyệt không có subscription
  }
}

/** Âm báo nhẹ 2 nốt bằng Web Audio API (không cần file MP3 ngoài). */
export function playNotificationChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, now); // G5
    osc.frequency.setValueAtTime(1046.5, now + 0.09); // C6
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    window.setTimeout(() => void ctx.close().catch(() => {}), 400);
  } catch {
    // Trình duyệt chưa cho phép autoplay audio trước khi có tương tác người dùng
  }
}
