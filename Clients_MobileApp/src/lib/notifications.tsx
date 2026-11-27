import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
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
import { AppState, Platform } from "react-native";
import { api } from "./api";
import { useChatModal } from "./chat-context";
import type { Row } from "./models";
import { registerSignOutCleanup, useSession } from "./session";

export type NotificationType =
  | "DON_HANG"
  | "THU_DO_VTON"
  | "CANH_BAO_KHO"
  | "KHUYEN_MAI"
  | "HE_THONG";

export type NotificationPrefKey = NotificationType | "LIVE_CHAT";

export type NotificationPreferences = Record<NotificationPrefKey, boolean>;

export interface AppNotification {
  id: string;
  loai: NotificationType;
  tieuDe: string;
  noiDung: string;
  time: number;
  createdAtRaw?: string;
  daDoc: boolean;
  rawLink?: string;
}

export type ResolvedMobileTarget =
  | { kind: "route"; pathname: string; params?: Record<string, string>; label: string }
  | { kind: "chat"; label: string }
  | null;

const DEFAULT_PREFS: NotificationPreferences = {
  DON_HANG: true,
  THU_DO_VTON: true,
  CANH_BAO_KHO: true,
  KHUYEN_MAI: true,
  HE_THONG: true,
  LIVE_CHAT: true,
};

const PUSH_TOKEN_KEY = "yofaso.expo_push_token.v1";

/** Phát hiện Expo Go (từ Expo SDK 53+, Android Expo Go không hỗ trợ remote push). */
export function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}

/** Chuẩn hóa đường dẫn LienKetDieuHuong từ Backend/DB sang route hợp lệ của Expo Router. */
export function resolveMobileNotificationTarget(
  rawLink?: string | null,
  type?: string,
): ResolvedMobileTarget {
  const link = (rawLink || "").trim();
  if (type === "LIVE_CHAT" || link === "/chat" || link.startsWith("/chat?")) {
    return { kind: "chat", label: "Mở trò chuyện với Chủ shop" };
  }
  if (!link) return null;

  const orderMatch = link.match(/^\/orders?\/([A-Za-z0-9_-]+)/i);
  if (orderMatch) {
    return {
      kind: "route",
      pathname: "/order/[id]",
      params: { id: orderMatch[1] },
      label: `Xem đơn hàng #${orderMatch[1]}`,
    };
  }

  const vtonMatch = link.match(/^\/(?:vton|session|sessions)\/([A-Za-z0-9_-]+)/i);
  if (vtonMatch) {
    return {
      kind: "route",
      pathname: "/session/[id]",
      params: { id: vtonMatch[1] },
      label: "Xem kết quả thử đồ VTON",
    };
  }

  const productMatch = link.match(/^\/products?\/([A-Za-z0-9_-]+)/i);
  if (productMatch) {
    return {
      kind: "route",
      pathname: "/product/[id]",
      params: { id: productMatch[1] },
      label: "Xem chi tiết sản phẩm",
    };
  }

  if (link.startsWith("/promotions") || link.startsWith("/voucher") || link === "/cart") {
    return {
      kind: "route",
      pathname: "/cart",
      label: "Mở giỏ hàng & Ví ưu đãi",
    };
  }

  if (link.startsWith("/member") || link.startsWith("/account")) {
    return {
      kind: "route",
      pathname: "/(shop)/account",
      label: "Xem hạng thành viên",
    };
  }

  if (link === "/orders") {
    return {
      kind: "route",
      pathname: "/orders",
      label: "Xem danh sách đơn hàng",
    };
  }

  return null;
}

function normalizeType(raw?: unknown): NotificationType {
  const upper = String(raw || "HE_THONG").toUpperCase();
  if (
    upper === "DON_HANG" ||
    upper === "THU_DO_VTON" ||
    upper === "CANH_BAO_KHO" ||
    upper === "KHUYEN_MAI"
  ) {
    return upper;
  }
  return "HE_THONG";
}

function parseTimestamp(raw?: unknown): number {
  if (!raw) return Date.now();
  const str = String(raw);
  const parsed = new Date(str.includes("T") ? str : str.replace(" ", "T")).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function mapApiRowToNotification(r: Row, index = 0): AppNotification {
  return {
    id: String(r.notificationId || `notif-${index}-${Date.now()}`),
    loai: normalizeType(r.type),
    tieuDe: String(r.title || "Thông báo từ YoFaSo"),
    noiDung: String(r.message ?? r.content ?? ""),
    time: parseTimestamp(r.createdAt),
    createdAtRaw: r.createdAt ? String(r.createdAt) : undefined,
    daDoc: Boolean(r.readStatus ?? r.read ?? false),
    rawLink: r.link ? String(r.link) : undefined,
  };
}

// Hiển thị banner, âm thanh và cập nhật badge ngay cả khi app đang mở ở Foreground
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;
  const channels: { id: string; name: string; importance: Notifications.AndroidImportance }[] = [
    { id: "default", name: "Thông báo chung", importance: Notifications.AndroidImportance.DEFAULT },
    { id: "orders", name: "Cập nhật đơn hàng", importance: Notifications.AndroidImportance.HIGH },
    { id: "vton", name: "Kết quả thử đồ VTON", importance: Notifications.AndroidImportance.HIGH },
    { id: "promotions", name: "Ưu đãi & Khuyến mãi", importance: Notifications.AndroidImportance.DEFAULT },
    { id: "chat", name: "Tin nhắn từ Chủ shop", importance: Notifications.AndroidImportance.MAX },
  ];
  await Promise.all(
    channels.map((ch) =>
      Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: ch.importance,
        vibrationPattern: [0, 220, 180, 220],
        lightColor: "#C9A227",
      }).catch(() => {}),
    ),
  );
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  pushToken: string | null;
  permissionStatus: "granted" | "denied" | "undetermined" | "unsupported";
  expoGoLimited: boolean;
  preferences: NotificationPreferences;
  refresh: (silent?: boolean) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  enablePushNotifications: () => Promise<{ ok: boolean; message: string }>;
  disablePushNotifications: () => Promise<void>;
  updatePreference: (key: NotificationPrefKey, enabled: boolean) => Promise<void>;
  navigateToTarget: (rawLink?: string | null, type?: string) => boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { openChat } = useChatModal();
  const userId = user?.userId ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "undetermined" | "unsupported"
  >(Platform.OS === "web" ? "unsupported" : "undetermined");
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);

  const pushTokenRef = useRef<string | null>(null);
  const pendingNavRef = useRef<{ link?: string | null; type?: string } | null>(null);
  const lastHandledResponseIdRef = useRef<string | null>(null);
  const expoGoLimited = Platform.OS === "android" && isRunningInExpoGo();

  const syncOsBadge = useCallback((count: number) => {
    if (Platform.OS === "web") return;
    void Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
  }, []);

  const navigateToTarget = useCallback(
    (rawLink?: string | null, type?: string): boolean => {
      const target = resolveMobileNotificationTarget(rawLink, type);
      if (!target) return false;
      if (target.kind === "chat") {
        openChat({ channel: "CHU_SHOP" });
        return true;
      }
      router.push(
        target.params
          ? ({ pathname: target.pathname, params: target.params } as any)
          : (target.pathname as any),
      );
      return true;
    },
    [openChat],
  );

  const refresh = useCallback(
    async (silent = false) => {
      if (!userId) {
        setNotifications([]);
        setUnreadCount(0);
        syncOsBadge(0);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const [rows, countRes] = await Promise.all([
          api<Row[]>("/notifications?page=0&size=50"),
          api<{ unreadCount: number }>("/notifications/unread-count").catch(() => null),
        ]);
        const mapped = Array.isArray(rows) ? rows.map(mapApiRowToNotification) : [];
        setNotifications(mapped);
        const computedUnread =
          countRes && typeof countRes.unreadCount === "number"
            ? countRes.unreadCount
            : mapped.filter((n) => !n.daDoc).length;
        setUnreadCount(computedUnread);
        syncOsBadge(computedUnread);
        setError("");
      } catch (e: any) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Không tải được hộp thư thông báo.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId, syncOsBadge],
  );

  const loadPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(DEFAULT_PREFS);
      return;
    }
    try {
      const res = await api<Partial<NotificationPreferences>>("/notifications/preferences");
      if (res && typeof res === "object") {
        setPreferences({ ...DEFAULT_PREFS, ...res });
      }
    } catch {
      // Giữ mặc định nếu chưa tải được
    }
  }, [userId]);

  const registerDeviceTokenInternal = useCallback(
    async (askPermission: boolean): Promise<{ ok: boolean; message: string }> => {
      if (!userId) {
        return { ok: false, message: "Vui lòng đăng nhập trước khi bật thông báo đẩy." };
      }
      if (Platform.OS === "web") {
        return { ok: false, message: "Thông báo đẩy Mobile chỉ hoạt động trên ứng dụng Android/iOS." };
      }
      if (expoGoLimited) {
        setPermissionStatus("unsupported");
        return {
          ok: false,
          message:
            "Expo Go SDK 53+ không hỗ trợ Android Push. Hãy build bản Development APK bằng EAS để bật thông báo đẩy.",
        };
      }
      if (!Device.isDevice) {
        setPermissionStatus("unsupported");
        return {
          ok: false,
          message: "Cần chạy trên điện thoại thật hoặc Android Emulator có Google Play Services.",
        };
      }

      try {
        await ensureAndroidChannels();
        const existing = await Notifications.getPermissionsAsync();
        let finalStatus = existing.status;
        if (finalStatus !== "granted" && askPermission) {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }
        setPermissionStatus(finalStatus as "granted" | "denied" | "undetermined");
        if (finalStatus !== "granted") {
          return {
            ok: false,
            message: "Bạn chưa cấp quyền thông báo cho ứng dụng YoFaSo trong cài đặt điện thoại.",
          };
        }

        const projectId =
          (Constants.expoConfig?.extra as any)?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId;
        if (!projectId) {
          return { ok: false, message: "Thiếu EAS projectId trong app.json." };
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        if (!token) {
          return { ok: false, message: "Không lấy được Expo Push Token từ thiết bị." };
        }

        const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
        const deviceName = [Device.brand, Device.modelName].filter(Boolean).join(" ").trim() || platform;
        await api("/notifications/devices", "POST", {
          platform,
          token,
          deviceName,
        });
        pushTokenRef.current = token;
        setPushToken(token);
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
        return { ok: true, message: "Đã bật thông báo đẩy cho thiết bị này." };
      } catch (e: any) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Không thể đăng ký thông báo đẩy lúc này.",
        };
      }
    },
    [userId, expoGoLimited],
  );

  const enablePushNotifications = useCallback(
    () => registerDeviceTokenInternal(true),
    [registerDeviceTokenInternal],
  );

  const disablePushNotifications = useCallback(async () => {
    const token = pushTokenRef.current || (await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null));
    if (token) {
      await api("/notifications/devices/unregister", "POST", { token }).catch(() => {});
    }
    pushTokenRef.current = null;
    setPushToken(null);
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
  }, []);

  // Đăng ký hook hủy token ngay trước khi logout để không bắn nhầm push sang user khác trên cùng máy
  useEffect(() => {
    return registerSignOutCleanup(async () => {
      const token =
        pushTokenRef.current || (await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null));
      if (token) {
        await api("/notifications/devices/unregister", "POST", { token }).catch(() => {});
      }
      pushTokenRef.current = null;
      setPushToken(null);
      setNotifications([]);
      setUnreadCount(0);
      syncOsBadge(0);
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
    });
  }, [syncOsBadge]);

  // Đồng bộ dữ liệu + đăng ký push sau khi user đăng nhập (không hỏi quyền khi chưa login)
  useEffect(() => {
    let active = true;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setNotifications([]);
        setUnreadCount(0);
        setPreferences(DEFAULT_PREFS);
        syncOsBadge(0);
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (!active) return;
      void refresh(false);
      void loadPreferences();
      void registerDeviceTokenInternal(true);
    });

    // Nếu trước đó user mở app từ Push Banner (cold start), điều hướng ngay khi session đã sẵn sàng
    let navTimer: ReturnType<typeof setTimeout> | null = null;
    if (pendingNavRef.current) {
      const pending = pendingNavRef.current;
      pendingNavRef.current = null;
      navTimer = setTimeout(() => {
        if (active) navigateToTarget(pending.link, pending.type);
      }, 250);
    }
    return () => {
      active = false;
      if (navTimer) clearTimeout(navTimer);
    };
  }, [userId, refresh, loadPreferences, registerDeviceTokenInternal, navigateToTarget, syncOsBadge]);

  // Lắng nghe Push đến khi App đang mở (Foreground) & khi user bấm vào banner Push (Background/Killed)
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handlePushResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const reqId = response.notification.request.identifier;
      if (lastHandledResponseIdRef.current === reqId) return;
      lastHandledResponseIdRef.current = reqId;

      const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
      const notifId = data.notificationId ? String(data.notificationId) : null;
      const link = data.link ? String(data.link) : null;
      const type = data.type ? String(data.type) : undefined;

      if (notifId && userId) {
        void api(`/notifications/${encodeURIComponent(notifId)}/read`, "POST").catch(() => {});
      }
      if (userId) {
        void refresh(true);
        if (!navigateToTarget(link, type)) {
          router.push("/inbox");
        }
      } else {
        // Đợi SessionProvider khôi phục phiên rồi mới điều hướng
        pendingNavRef.current = { link, type };
      }
    };

    // Kiểm tra Cold Start (app vừa được mở từ Push notification khi đang tắt hẳn)
    void Notifications.getLastNotificationResponseAsync()
      .then((res) => handlePushResponse(res))
      .catch(() => {});

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = (content.data || {}) as Record<string, unknown>;
      const type = String(data.type || "HE_THONG").toUpperCase();

      // Live Chat chỉ hiện banner, không nhét trùng vào danh sách hộp thư ThongBao
      if (type === "LIVE_CHAT") return;

      const incoming: AppNotification = {
        id: data.notificationId ? String(data.notificationId) : `push-${Date.now()}`,
        loai: normalizeType(type),
        tieuDe: content.title || "Thông báo mới từ YoFaSo",
        noiDung: content.body || "",
        time: Date.now(),
        daDoc: false,
        rawLink: data.link ? String(data.link) : undefined,
      };

      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
      setUnreadCount((prev) => {
        const next =
          typeof data.unreadCount === "number" ? data.unreadCount : prev + 1;
        syncOsBadge(next);
        return next;
      });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushResponse(response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [userId, refresh, navigateToTarget, syncOsBadge]);

  // Fallback đồng bộ nhẹ khi App quay lại foreground hoặc đang chạy Expo Web / Expo Go
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh(true);
      }
    });
    const intervalMs = Platform.OS === "web" || expoGoLimited ? 15000 : 60000;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        void refresh(true);
      }
    }, intervalMs);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, expoGoLimited, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((item) => {
          if (item.id === id && !item.daDoc) {
            wasUnread = true;
            return { ...item, daDoc: true };
          }
          return item;
        }),
      );
      if (wasUnread) {
        setUnreadCount((prev) => {
          const next = Math.max(0, prev - 1);
          syncOsBadge(next);
          return next;
        });
      }
      try {
        const res = await api<{ unreadCount?: number }>(
          `/notifications/${encodeURIComponent(id)}/read`,
          "POST",
          {},
        );
        if (res && typeof res.unreadCount === "number") {
          setUnreadCount(res.unreadCount);
          syncOsBadge(res.unreadCount);
        }
      } catch {
        void refresh(true);
      }
    },
    [userId, refresh, syncOsBadge],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, daDoc: true })));
    setUnreadCount(0);
    syncOsBadge(0);
    try {
      await api("/notifications/read-all", "POST", {});
    } catch {
      void refresh(true);
    }
  }, [userId, refresh, syncOsBadge]);

  const updatePreference = useCallback(
    async (key: NotificationPrefKey, enabled: boolean) => {
      if (!userId) return;
      const prevPrefs = preferences;
      setPreferences((p) => ({ ...p, [key]: enabled }));
      try {
        const updated = await api<Partial<NotificationPreferences>>(
          "/notifications/preferences",
          "PUT",
          { [key]: enabled },
        );
        if (updated) {
          setPreferences({ ...DEFAULT_PREFS, ...updated });
        }
      } catch {
        setPreferences(prevPrefs);
      }
    },
    [userId, preferences],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      pushToken,
      permissionStatus,
      expoGoLimited,
      preferences,
      refresh,
      markRead,
      markAllRead,
      enablePushNotifications,
      disablePushNotifications,
      updatePreference,
      navigateToTarget,
    }),
    [
      notifications,
      unreadCount,
      loading,
      error,
      pushToken,
      permissionStatus,
      expoGoLimited,
      preferences,
      refresh,
      markRead,
      markAllRead,
      enablePushNotifications,
      disablePushNotifications,
      updatePreference,
      navigateToTarget,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
