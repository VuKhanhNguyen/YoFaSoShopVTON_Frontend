"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { registerStaffLogoutCleanup, useAuth } from "@/lib/auth";
import { pushToast } from "@/lib/feedback";
import {
  getExistingWebPushSubscription,
  isWebPushSupported,
  mapApiNotification,
  markAllRead as markAllReadLocal,
  markRead as markReadLocal,
  playNotificationChime,
  registerStaffServiceWorker,
  resolveStaffNotificationLink,
  subscribeWebPush,
  unreadCount as countUnreadLocal,
  unsubscribeWebPush,
  type ApiNotificationRow,
  type StaffNotification,
} from "@/lib/notifications";

export type WebPushState = "unsupported" | "unavailable" | "disabled" | "enabled" | "denied";

const SOUND_STORAGE_KEY = "yofaso-staff-notif-sound";

interface StaffNotificationContextValue {
  items: StaffNotification[];
  unreadCount: number;
  loading: boolean;
  sseConnected: boolean;
  webPushState: WebPushState;
  webPushBusy: boolean;
  soundEnabled: boolean;
  chatPingCount: number;
  refresh: (silent?: boolean) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  enableWebPush: () => Promise<void>;
  disableWebPush: () => Promise<void>;
  toggleSound: () => void;
}

const StaffNotificationContext = createContext<StaffNotificationContextValue | null>(null);

export function StaffNotificationProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const userKey = user ? `${user.code || user.email}:${user.role}` : null;

  const [items, setItems] = useState<StaffNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [webPushState, setWebPushState] = useState<WebPushState>("disabled");
  const [webPushBusy, setWebPushBusy] = useState(false);
  const [chatPingCount, setChatPingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return saved === null ? true : saved !== "0";
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(
    async (silent = false) => {
      if (!userKey) {
        setItems([]);
        setUnread(0);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const [rows, countRes] = await Promise.all([
          api<ApiNotificationRow[]>("/notifications?page=0&size=40"),
          api<{ unreadCount: number }>("/notifications/unread-count").catch(() => null),
        ]);
        if (Array.isArray(rows)) {
          const mapped = rows.map(mapApiNotification);
          setItems(mapped);
          setUnread(
            countRes && typeof countRes.unreadCount === "number"
              ? countRes.unreadCount
              : countUnreadLocal(mapped),
          );
        }
      } catch {
        // Giữ danh sách hiện có khi mất mạng tạm thời
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userKey],
  );

  // Đăng ký Service Worker & lắng nghe sự kiện bấm thông báo từ SW
  useEffect(() => {
    if (typeof window === "undefined") return;
    void registerStaffServiceWorker();

    if (!("serviceWorker" in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "YOFASO_NOTIFICATION_CLICK" && typeof event.data.url === "string") {
        const target = user
          ? resolveStaffNotificationLink(event.data.url, undefined, user.role) || event.data.url
          : event.data.url;
        if (target.startsWith("/")) {
          router.push(target);
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [router, user]);

  // Kiểm tra trạng thái Web Push hiện tại khi nhân viên đăng nhập
  const syncWebPushStatus = useCallback(async () => {
    if (!isWebPushSupported()) {
      setWebPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setWebPushState("denied");
      return;
    }
    try {
      const keyRes = await api<{ enabled: boolean; publicKey: string }>(
        "/notifications/web-push/public-key",
      );
      if (!keyRes?.enabled || !keyRes.publicKey) {
        setWebPushState("unavailable");
        return;
      }
    } catch {
      setWebPushState("unavailable");
      return;
    }
    const existing = await getExistingWebPushSubscription();
    setWebPushState(existing ? "enabled" : "disabled");
  }, []);

  // Đăng ký cleanup trước khi logout
  useEffect(() => {
    return registerStaffLogoutCleanup(async () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSseConnected(false);
      await unsubscribeWebPush();
      setItems([]);
      setUnread(0);
    });
  }, []);

  // Tải hộp thư + kết nối SSE realtime khi có nhân viên đăng nhập
  useEffect(() => {
    if (!ready || !userKey) {
      let active = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      void Promise.resolve().then(() => {
        if (!active) return;
        setSseConnected(false);
        setItems([]);
        setUnread(0);
      });
      return () => {
        active = false;
      };
    }

    let closed = false;
    void Promise.resolve().then(() => {
      if (closed) return;
      void refresh(false);
      void syncWebPushStatus();
    });

    let reconnectTimer: number | null = null;
    let sseFailureCount = 0;

    const connectSse = () => {
      if (closed || typeof window === "undefined" || typeof EventSource === "undefined") return;
      eventSourceRef.current?.close();
      const es = new EventSource("/api/backend/notifications/stream", {
        withCredentials: true,
      });
      eventSourceRef.current = es;

      es.addEventListener("connected", (evt) => {
        sseFailureCount = 0;
        setSseConnected(true);
        try {
          const payload = JSON.parse((evt as MessageEvent).data || "{}");
          if (typeof payload.unreadCount === "number") {
            setUnread(payload.unreadCount);
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("notification", (evt) => {
        try {
          const payload = JSON.parse((evt as MessageEvent).data || "{}") as ApiNotificationRow & {
            unreadCount?: number;
          };
          const mapped = mapApiNotification(payload);
          setItems((prev) => {
            if (prev.some((item) => item.id === mapped.id)) return prev;
            return [mapped, ...prev].slice(0, 60);
          });
          setUnread((prev) =>
            typeof payload.unreadCount === "number" ? payload.unreadCount : prev + 1,
          );
          pushToast({
            tone: mapped.urgent ? "warning" : "info",
            title: mapped.title,
            detail: mapped.body || undefined,
          });
          if (soundEnabledRef.current) {
            playNotificationChime();
          }
        } catch {
          void refresh(true);
        }
      });

      es.addEventListener("read", (evt) => {
        try {
          const payload = JSON.parse((evt as MessageEvent).data || "{}") as {
            notificationId?: string;
            unreadCount?: number;
          };
          if (payload.notificationId) {
            setItems((prev) => markReadLocal(prev, payload.notificationId!));
          }
          if (typeof payload.unreadCount === "number") {
            setUnread(payload.unreadCount);
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("read-all", () => {
        setItems((prev) => markAllReadLocal(prev));
        setUnread(0);
      });

      es.addEventListener("chat", (evt) => {
        setChatPingCount((c) => c + 1);
        try {
          const payload = JSON.parse((evt as MessageEvent).data || "{}") as {
            title?: string;
            message?: string;
          };
          pushToast({
            tone: "info",
            title: payload.title || "Tin nhắn mới từ khách hàng",
            detail: payload.message || undefined,
          });
          if (soundEnabledRef.current) {
            playNotificationChime();
          }
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        if (closed) return;
        sseFailureCount += 1;
        const delayMs = Math.min(30000, 2500 * Math.pow(1.6, Math.min(sseFailureCount, 5)));
        reconnectTimer = window.setTimeout(connectSse, delayMs);
      };
    };

    connectSse();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Fallback nhẹ mỗi 60 giây phòng trường hợp proxy trung gian ngắt SSE
    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    }, 60000);

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.clearInterval(fallbackTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    };
  }, [ready, userKey, refresh, syncWebPushStatus]);

  const markRead = useCallback(
    async (id: string) => {
      let wasUnread = false;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id && !item.read) {
            wasUnread = true;
            return { ...item, read: true };
          }
          return item;
        }),
      );
      if (wasUnread) {
        setUnread((prev) => Math.max(0, prev - 1));
      }
      try {
        const res = await api<{ unreadCount?: number }>(
          `/notifications/${encodeURIComponent(id)}/read`,
          "POST",
          {},
        );
        if (res && typeof res.unreadCount === "number") {
          setUnread(res.unreadCount);
        }
      } catch {
        void refresh(true);
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => markAllReadLocal(prev));
    setUnread(0);
    try {
      await api("/notifications/read-all", "POST", {});
      pushToast({ tone: "success", title: "Đã đánh dấu tất cả thông báo là đã đọc" });
    } catch (err) {
      pushToast({
        tone: "error",
        title: err instanceof Error ? err.message : "Không thể cập nhật trạng thái thông báo.",
      });
      void refresh(true);
    }
  }, [refresh]);

  const enableWebPush = useCallback(async () => {
    setWebPushBusy(true);
    try {
      const res = await subscribeWebPush();
      if (res.ok) {
        setWebPushState("enabled");
        pushToast({ tone: "success", title: res.message });
      } else {
        if (res.reason === "denied") setWebPushState("denied");
        else if (res.reason === "unavailable") setWebPushState("unavailable");
        else if (res.reason === "unsupported") setWebPushState("unsupported");
        pushToast({ tone: "warning", title: res.message });
      }
    } finally {
      setWebPushBusy(false);
    }
  }, []);

  const disableWebPush = useCallback(async () => {
    setWebPushBusy(true);
    try {
      await unsubscribeWebPush();
      setWebPushState("disabled");
      pushToast({ tone: "info", title: "Đã tắt thông báo đẩy trình duyệt trên thiết bị này." });
    } finally {
      setWebPushBusy(false);
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const value = useMemo<StaffNotificationContextValue>(
    () => ({
      items,
      unreadCount: unread,
      loading,
      sseConnected,
      webPushState,
      webPushBusy,
      soundEnabled,
      chatPingCount,
      refresh,
      markRead,
      markAllRead,
      enableWebPush,
      disableWebPush,
      toggleSound,
    }),
    [
      items,
      unread,
      loading,
      sseConnected,
      webPushState,
      webPushBusy,
      soundEnabled,
      chatPingCount,
      refresh,
      markRead,
      markAllRead,
      enableWebPush,
      disableWebPush,
      toggleSound,
    ],
  );

  return (
    <StaffNotificationContext.Provider value={value}>
      {children}
    </StaffNotificationContext.Provider>
  );
}

export function useStaffNotifications(): StaffNotificationContextValue {
  const ctx = useContext(StaffNotificationContext);
  if (!ctx) {
    throw new Error("useStaffNotifications phải dùng bên trong StaffNotificationProvider");
  }
  return ctx;
}
