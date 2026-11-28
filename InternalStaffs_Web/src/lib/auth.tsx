"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, noteActivity } from "./api";

export type Role =
  | "ROLE_SHOP_ADMIN"
  | "ROLE_STAFF_CASHIER"
  | "ROLE_STAFF_WAREHOUSE"
  | "ROLE_STAFF_SHIPPER";

export interface StaffUser {
  role: Role;
  name: string;
  code: string;
  email: string;
  roles?: string[];
}

export const ACCOUNTS: Record<
  Role,
  { email: string; pass: string; name: string; code: string; label: string; icon: string }
> = {
  ROLE_SHOP_ADMIN: {
    email: "adminyofaso",
    pass: "TestingPassword123",
    name: "Nguyễn Văn Tài",
    code: "NV-01",
    label: "Chủ shop / Quản trị viên",
    icon: "👑",
  },
  ROLE_STAFF_CASHIER: {
    email: "cashierlanphuong",
    pass: "TestingPassword123",
    name: "Đặng Lan Phương",
    code: "NV-02",
    label: "Thu ngân bán lẻ POS",
    icon: "💳",
  },
  ROLE_STAFF_WAREHOUSE: {
    email: "whmanhhung",
    pass: "TestingPassword123",
    name: "Đỗ Mạnh Hùng",
    code: "NV-03",
    label: "Nhân viên kho / điều phối",
    icon: "📦",
  },
  ROLE_STAFF_SHIPPER: {
    email: "shipquocbao",
    pass: "TestingPassword123",
    name: "Phan Quốc Bảo",
    code: "NV-04",
    label: "Nhân viên giao vận nội bộ",
    icon: "🛵",
  },
};

export const ROLES = Object.keys(ACCOUNTS) as Role[];

/** Chỉ chấp nhận đúng 4 vai trò nội bộ; tuyệt đối không bao giờ fallback sang ROLE_SHOP_ADMIN. */
export function resolveStaffRole(roles?: readonly unknown[] | null): Role | null {
  if (!Array.isArray(roles)) return null;
  for (const r of ROLES) {
    if (roles.includes(r)) return r;
  }
  return null;
}

/** RBAC Router: phân luồng điều hướng 1-đối-1 theo vai trò người dùng. */
export function roleHome(role: Role): string {
  switch (role) {
    case "ROLE_SHOP_ADMIN":
      return "/admin/dashboard";
    case "ROLE_STAFF_CASHIER":
      return "/pos/terminal";
    case "ROLE_STAFF_WAREHOUSE":
      return "/warehouse/fulfillment";
    case "ROLE_STAFF_SHIPPER":
      return "/shipper/deliveries";
  }
}

/** Chỉ dùng khi dev offline hoàn toàn (status === 0); kiểm tra đúng mật khẩu tài khoản mẫu. */
export function authenticateDemo(email: string, pass: string): StaffUser | null {
  if (process.env.NODE_ENV === "production") return null;
  const e = email.trim().toLowerCase();
  for (const role of ROLES) {
    const acc = ACCOUNTS[role];
    if (acc.email.toLowerCase() === e && acc.pass === pass) {
      return { role, name: acc.name, code: acc.code, email: acc.email, roles: [role] };
    }
  }
  return null;
}

const STORAGE_KEY = "yofaso-staff-session";
const AUTH_SYNC_KEY = "yofaso-staff-auth-sync";
const AUTH_CHANNEL_NAME = "yofaso-staff-auth";
const RBAC_LOG_COOKIE = "yofaso.rbac_log";

type AuthSyncPayload = {
  type: "LOGIN" | "LOGOUT";
  role: Role | null;
  code: string | null;
  email: string | null;
  ts: number;
};

const logoutCleanupListeners = new Set<() => Promise<void> | void>();

/** Đăng ký tác vụ dọn dẹp (ví dụ hủy Web Push subscription) chạy ngay trước khi xóa cookie đăng xuất. */
export function registerStaffLogoutCleanup(fn: () => Promise<void> | void): () => void {
  logoutCleanupListeners.add(fn);
  return () => {
    logoutCleanupListeners.delete(fn);
  };
}

function readStoredStaffUser(): StaffUser | null {
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StaffUser>;
      if (parsed && parsed.role && ROLES.includes(parsed.role)) {
        return parsed as StaffUser;
      }
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // bỏ qua lỗi parse
  }
  return null;
}

function decodeBase64UrlUtf8(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = window.atob(padded);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function flushServerRbacConsoleNotice() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const prefix = `${RBAC_LOG_COOKIE}=`;
  const entry = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  if (!entry) return;

  document.cookie = `${RBAC_LOG_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  try {
    const raw = decodeBase64UrlUtf8(entry.slice(prefix.length));
    const info = JSON.parse(raw) as {
      blockedPath?: string;
      currentRole?: string | null;
      requiredRole?: string;
      redirectedTo?: string;
      reason?: string;
    };
    if (info.reason === "UNAUTHENTICATED") {
      console.warn(
        `[RBAC Guard] Đã chặn truy cập "${info.blockedPath}": chưa đăng nhập (yêu cầu: ${info.requiredRole}). Đã chuyển hướng về "${info.redirectedTo}".`,
      );
    } else {
      console.warn(
        `[RBAC Guard] Đã chặn truy cập trái phép đường dẫn "${info.blockedPath}". Vai trò đang đăng nhập: ${info.currentRole || "UNKNOWN"} — đường dẫn yêu cầu: ${info.requiredRole}. Đã chuyển hướng về "${info.redirectedTo}".`,
      );
    }
  } catch {
    // bỏ qua nếu cookie lỗi định dạng
  }
}

interface AuthContextValue {
  user: StaffUser | null;
  ready: boolean;
  login: (email: string, pass: string, remember: boolean) => Promise<StaffUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<StaffUser | null>(readStoredStaffUser);
  const [ready, setReady] = useState(false);
  const userRef = useRef<StaffUser | null>(user);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Đọc và in ra F12 Console mọi sự kiện chặn route từ tầng Server Proxy (không hiện toast/popup)
  useEffect(() => {
    flushServerRbacConsoleNotice();
  }, [pathname]);

  const broadcastAuthChange = useCallback((payload: AuthSyncPayload) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota
    }
    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // ignore closed channel
    }
  }, []);

  const syncSessionFromBackend = useCallback(async (logReason?: string): Promise<StaffUser | null> => {
    try {
      const me = await api<{
        id?: string;
        userId?: string;
        fullName?: string;
        email?: string;
        roles?: string[];
      }>("/me");
      const mappedRole = resolveStaffRole(me?.roles);
      if (!me || !mappedRole) {
        if (me?.roles?.length) {
          console.warn(
            `[RBAC Guard] Tài khoản "${me.email || me.userId || "unknown"}" không thuộc nhóm vai trò nội bộ (${me.roles.join(", ")}). Đã hủy phiên trên cổng vận hành.`,
          );
          await api("/auth/logout", "POST").catch(() => {});
        }
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      const staffUser: StaffUser = {
        role: mappedRole,
        name: me.fullName || "Nhân viên YoFaSo",
        code: me.userId || me.id || "",
        email: me.email || "",
        roles: me.roles,
      };
      const prev = userRef.current;
      if (
        logReason &&
        prev &&
        (prev.role !== staffUser.role || prev.email !== staffUser.email || prev.code !== staffUser.code)
      ) {
        console.warn(
          `[Session Sync] ${logReason}: phiên trình duyệt hiện thuộc về ${staffUser.email || staffUser.name} (${staffUser.role}). Đã đồng bộ lại giao diện để tránh lệch quyền.`,
        );
      }
      setUser(staffUser);
      if (window.localStorage.getItem(STORAGE_KEY) !== null) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(staffUser));
      }
      return staffUser;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return null;
    }
  }, []);

  // Lắng nghe thao tác người dùng toàn cục để duy trì phiên làm việc không bị quá hạn 15 phút
  useEffect(() => {
    const handleActivity = (e: Event) => {
      if (e.isTrusted) noteActivity();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchmove"];
    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, handleActivity));
  }, []);

  // Lắng nghe sự kiện phiên hết hạn từ tầng API
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      window.localStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener("yofaso:session-expired", handleExpired);
    return () => window.removeEventListener("yofaso:session-expired", handleExpired);
  }, []);

  // Đồng bộ lần đầu với Backend khi khởi động và kiểm tra lại khi quay lại tab (tránh lệch cookie giữa 2 cửa sổ cùng Chrome Profile)
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => syncSessionFromBackend("Khởi tạo phiên"))
      .finally(() => {
        if (active) setReady(true);
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible" && userRef.current) {
        void syncSessionFromBackend("Kiểm tra lại phiên khi chuyển cửa sổ");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncSessionFromBackend]);

  // Đồng bộ tức thì giữa nhiều tab/cửa sổ trong cùng 1 Chrome Profile qua BroadcastChannel + storage event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRemoteSync = (payload: AuthSyncPayload | null) => {
      if (!payload) return;
      if (payload.type === "LOGOUT") {
        if (userRef.current) {
          console.warn(
            "[Session Sync] Phiên đăng nhập vừa đăng xuất ở cửa sổ khác cùng trình duyệt. Đã đóng phiên tại tab hiện tại.",
          );
        }
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (payload.type === "LOGIN") {
        const cur = userRef.current;
        if (!cur || cur.role !== payload.role || cur.email !== payload.email) {
          void syncSessionFromBackend("Phát hiện đăng nhập mới từ cửa sổ khác cùng trình duyệt");
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channelRef.current = bc;
      bc.onmessage = (ev: MessageEvent<AuthSyncPayload>) => {
        handleRemoteSync(ev.data);
      };
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === AUTH_SYNC_KEY && ev.newValue) {
        try {
          handleRemoteSync(JSON.parse(ev.newValue) as AuthSyncPayload);
        } catch {
          // ignore
        }
      } else if (ev.key === STORAGE_KEY && ev.newValue === null && userRef.current) {
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      bc?.close();
      if (channelRef.current === bc) channelRef.current = null;
    };
  }, [syncSessionFromBackend]);

  const login = async (email: string, pass: string, remember: boolean): Promise<StaffUser | null> => {
    const cleanEmail = email.trim();

    try {
      const res = await api<{
        user?: { userId?: string; id?: string; fullName?: string; email?: string; roles?: string[] };
      }>("/auth/login", "POST", { username: cleanEmail, password: pass }, undefined, remember);

      const bUser = res?.user;
      const mappedRole = resolveStaffRole(bUser?.roles);
      if (!mappedRole) {
        await api("/auth/logout", "POST").catch(() => {});
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
        console.warn(
          `[RBAC Guard] Đã từ chối đăng nhập tài khoản "${cleanEmail}": vai trò (${(bUser?.roles || []).join(", ") || "NONE"}) không thuộc cổng nhân sự nội bộ.`,
        );
        throw new ApiError(
          "Tài khoản này không có quyền truy cập cổng vận hành nội bộ.",
          403,
        );
      }

      const u: StaffUser = {
        role: mappedRole,
        name: bUser?.fullName || "Nhân viên YoFaSo",
        code: bUser?.userId || bUser?.id || "",
        email: bUser?.email || cleanEmail,
        roles: bUser?.roles || [mappedRole],
      };
      setUser(u);
      if (remember) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      broadcastAuthChange({
        type: "LOGIN",
        role: u.role,
        code: u.code || null,
        email: u.email,
        ts: Date.now(),
      });
      return u;
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status !== 0) {
        throw err;
      }

      const demo = authenticateDemo(cleanEmail, pass);
      if (demo) {
        setUser(demo);
        if (remember) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        broadcastAuthChange({
          type: "LOGIN",
          role: demo.role,
          code: demo.code,
          email: demo.email,
          ts: Date.now(),
        });
        return demo;
      }
      return null;
    }
  };

  const logout = async () => {
    await Promise.allSettled(Array.from(logoutCleanupListeners).map((fn) => fn()));
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
    try {
      await api("/auth/logout", "POST");
    } catch {
      // bỏ qua lỗi nếu backend offline
    } finally {
      broadcastAuthChange({
        type: "LOGOUT",
        role: null,
        code: null,
        email: null,
        ts: Date.now(),
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng trong AuthProvider");
  return ctx;
}

/**
 * Guard phân quyền nghiêm ngặt:
 * - Chưa đăng nhập -> /login
 * - Sai vai trò -> chuyển hướng về đúng trang chủ của vai trò đang đăng nhập
 * - Chỉ ghi cảnh báo ra F12 Console, không bật toast hay popup làm gián đoạn giao diện.
 */
export function useRequireAuth(allowed?: readonly Role[]): {
  user: StaffUser | null;
  ready: boolean;
  authorized: boolean;
} {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const lastBlockedRef = useRef<string>("");
  const allowedKey = allowed ? allowed.join(",") : "";

  const authorized = Boolean(ready && user && (!allowed || allowed.includes(user.role)));

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const sig = `anon:${pathname}`;
      if (lastBlockedRef.current !== sig) {
        lastBlockedRef.current = sig;
        console.warn(
          `[RBAC Guard] Đã chặn truy cập "${pathname}": chưa đăng nhập. Đã chuyển hướng về "/login".`,
        );
      }
      router.replace("/login");
    } else if (allowedKey && !allowedKey.split(",").includes(user.role)) {
      const target = roleHome(user.role);
      const sig = `${user.role}:${pathname}->${target}`;
      if (lastBlockedRef.current !== sig) {
        lastBlockedRef.current = sig;
        console.warn(
          `[RBAC Guard] Đã chặn truy cập trái phép đường dẫn "${pathname}". Vai trò đang đăng nhập: ${user.role} — đường dẫn yêu cầu: ${allowedKey.split(",").join(", ")}. Đã chuyển hướng về "${target}".`,
        );
      }
      router.replace(target);
    } else {
      lastBlockedRef.current = "";
    }
  }, [ready, user, allowedKey, pathname, router]);

  return { user, ready, authorized };
}
