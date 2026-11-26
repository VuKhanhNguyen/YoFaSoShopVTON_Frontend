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
  link?: string;
  read: boolean;
  urgent?: boolean;
}

export interface ApiNotificationRow {
  notificationId: string;
  title?: string;
  content?: string;
  type?: string;
  link?: string | null;
  read?: boolean;
  createdAt?: string;
}

export function formatRelativeTime(raw?: string): string {
  if (!raw) return "Vừa xong";
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;
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
  const urgent =
    type === "CANH_BAO_KHO" ||
    (row.title || "").toLowerCase().includes("chờ duyệt") ||
    (row.title || "").toLowerCase().includes("cảnh báo");
  return {
    id: row.notificationId,
    type,
    tab,
    title: row.title || "Thông báo hệ thống",
    body: row.content || "",
    time: formatRelativeTime(row.createdAt),
    link: row.link || undefined,
    read: Boolean(row.read),
    urgent,
  };
}

export function visibleForRole(list: StaffNotification[], _role: Role): StaffNotification[] {
  return list;
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
