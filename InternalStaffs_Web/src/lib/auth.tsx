"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

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
    email: "admin@yofaso.vn",
    pass: "admin123",
    name: "Vũ Khanh Nguyễn",
    code: "NV-01",
    label: "Chủ shop / Quản trị viên",
    icon: "👑",
  },
  ROLE_STAFF_CASHIER: {
    email: "cashier@yofaso.vn",
    pass: "cashier123",
    name: "Nguyễn Thị Lan",
    code: "NV-02",
    label: "Thu ngân bán lẻ POS",
    icon: "💳",
  },
  ROLE_STAFF_WAREHOUSE: {
    email: "warehouse@yofaso.vn",
    pass: "warehouse123",
    name: "Trần Minh Tuấn",
    code: "NV-03",
    label: "Nhân viên kho / điều phối",
    icon: "📦",
  },
  ROLE_STAFF_SHIPPER: {
    email: "shipper@yofaso.vn",
    pass: "shipper123",
    name: "Lê Văn Hải",
    code: "NV-04",
    label: "Nhân viên giao vận nội bộ",
    icon: "🛵",
  },
};

export const ROLES = Object.keys(ACCOUNTS) as Role[];

/** RBAC Router: phân luồng điều hướng theo vai trò người dùng. */
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
    default:
      return "/pos/terminal";
  }
}

/** Xác thực theo bảng tài khoản demo (NguoiDung / VaiTro). */
export function authenticateDemo(email: string, pass: string): StaffUser | null {
  const e = email.trim().toLowerCase();
  for (const role of ROLES) {
    const acc = ACCOUNTS[role];
    if (acc.email.toLowerCase() === e && (acc.pass === pass || pass === "123456" || pass === "admin123")) {
      return { role, name: acc.name, code: acc.code, email: acc.email, roles: [role] };
    }
  }
  return null;
}

const STORAGE_KEY = "yofaso-staff-session";

interface AuthContextValue {
  user: StaffUser | null;
  ready: boolean;
  login: (email: string, pass: string, remember: boolean) => Promise<StaffUser | null>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Kiểm tra session cục bộ (cho demo / offline)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setUser(JSON.parse(raw) as StaffUser);
      }
    } catch {
      // bỏ qua lỗi parse
    }

    // 2. Thử đồng bộ với backend nếu có cookie đăng nhập thực tế
    api<{ id?: string; fullName?: string; email?: string; roles?: string[] }>("/me")
      .then((me) => {
        if (me && me.roles && me.roles.length > 0) {
          const primaryRole = (me.roles.find((r) => r.startsWith("ROLE_")) || "ROLE_SHOP_ADMIN") as Role;
          const mappedRole: Role = ROLES.includes(primaryRole) ? primaryRole : "ROLE_SHOP_ADMIN";
          const staffUser: StaffUser = {
            role: mappedRole,
            name: me.fullName || "Nhân viên YoFaSo",
            code: "NV-REAL",
            email: me.email || "",
            roles: me.roles,
          };
          setUser(staffUser);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(staffUser));
        }
      })
      .catch(() => {
        // Backend chưa sẵn sàng hoặc chưa đăng nhập cookie -> giữ session demo nếu có
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const login = async (email: string, pass: string, remember: boolean): Promise<StaffUser | null> => {
    // Ưu tiên kiểm tra demo accounts để đảm bảo 1-click login mượt mà
    const demo = authenticateDemo(email, pass);
    if (demo) {
      setUser(demo);
      if (remember) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      // Thử login backend ngầm để đồng bộ cookie nếu backend có tài khoản tương ứng
      api("/auth/login", "POST", { email, password: pass }, undefined, remember).catch(() => {});
      return demo;
    }

    // Nếu không khớp demo, thử gọi API backend thực tế
    try {
      const res = await api<{ user?: { fullName?: string; email?: string; roles?: string[] } }>(
        "/auth/login",
        "POST",
        { email, password: pass },
        undefined,
        remember
      );
      const bUser = res?.user;
      const primaryRole = (bUser?.roles?.find((r) => r.startsWith("ROLE_")) || "ROLE_SHOP_ADMIN") as Role;
      const mappedRole: Role = ROLES.includes(primaryRole) ? primaryRole : "ROLE_SHOP_ADMIN";
      const u: StaffUser = {
        role: mappedRole,
        name: bUser?.fullName || "Nhân viên YoFaSo",
        code: "NV-REAL",
        email: bUser?.email || email,
        roles: bUser?.roles || [mappedRole],
      };
      setUser(u);
      if (remember) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return u;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
    try {
      await api("/auth/logout", "POST");
    } catch {
      // bỏ qua lỗi nếu backend offline
    }
  };

  const switchRole = (role: Role) => {
    const acc = ACCOUNTS[role];
    const u: StaffUser = {
      role,
      name: acc.name,
      code: acc.code,
      email: acc.email,
      roles: [role],
    };
    setUser(u);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng trong AuthProvider");
  return ctx;
}

/** Guard phân quyền: chưa đăng nhập -> /login; sai vai trò -> trang chủ của vai trò đó. */
export function useRequireAuth(allowed?: Role[]): { user: StaffUser | null; ready: boolean } {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    } else if (allowed && !allowed.includes(user.role)) {
      router.replace(roleHome(user.role));
    }
  }, [ready, user, allowed, router]);

  return { user, ready };
}
