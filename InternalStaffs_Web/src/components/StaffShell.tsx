"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  House,
  Barcode,
  Package,
  Truck,
  TShirt,
  Users,
  Ticket,
  ChatCircle,
  Bell,
  Clock,
  SignOut,
  Sparkle,
  List,
} from "@phosphor-icons/react";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import type { User } from "@/lib/models";
import { State } from "./ui";
const Context = createContext<User | null>(null);
export const useStaff = () => useContext(Context)!;
export const can = (user: User, ...roles: string[]) =>
  roles.some((role) => user.roles.includes(`ROLE_${role}`));
const links = [
  { slug: "dashboard", label: "Tổng quan", icon: House, roles: [] },
  {
    slug: "pos",
    label: "Bán hàng tại quầy",
    icon: Barcode,
    roles: ["SHOP_ADMIN", "STAFF_CASHIER"],
  },
  {
    slug: "orders",
    label: "Đơn hàng",
    icon: Package,
    roles: ["SHOP_ADMIN", "STAFF_CASHIER", "STAFF_WAREHOUSE"],
  },
  {
    slug: "warehouse",
    label: "Kho & đóng gói",
    icon: Package,
    roles: ["SHOP_ADMIN", "STAFF_WAREHOUSE"],
  },
  {
    slug: "deliveries",
    label: "Giao hàng",
    icon: Truck,
    roles: ["STAFF_SHIPPER"],
  },
  {
    slug: "catalog",
    label: "Sản phẩm",
    icon: TShirt,
    roles: ["SHOP_ADMIN", "STAFF_CASHIER", "STAFF_WAREHOUSE"],
  },
  { slug: "studio", label: "Studio AI", icon: Sparkle, roles: ["SHOP_ADMIN"] },
  { slug: "promotions", label: "Ưu đãi", icon: Ticket, roles: ["SHOP_ADMIN"] },
  {
    slug: "reviews",
    label: "Đánh giá",
    icon: ChatCircle,
    roles: ["SHOP_ADMIN"],
  },
  {
    slug: "users",
    label: "Nhân sự & quyền",
    icon: Users,
    roles: ["SHOP_ADMIN"],
  },
  {
    slug: "shifts",
    label: "Ca làm việc",
    icon: Clock,
    roles: ["SHOP_ADMIN", "STAFF_CASHIER"],
  },
  { slug: "notifications", label: "Thông báo", icon: Bell, roles: [] },
];
export function StaffShell({ children }: { children: ReactNode }) {
  const state = useResource<User>("/me"),
    path = usePathname(),
    router = useRouter();
  const [menu, setMenu] = useState(false),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const expired = () => router.replace("/login");
    window.addEventListener("yofaso:session-expired", expired);
    return () => window.removeEventListener("yofaso:session-expired", expired);
  }, [router]);
  if (!state.data)
    return (
      <main className="startup">
        <Image
          src="/brand/logo.png"
          alt="YoFaSo Shop"
          width={160}
          height={90}
        />
        <State {...state} retry={state.reload} />
      </main>
    );
  const user = state.data,
    staff = user.roles.some((r) => r !== "ROLE_CUSTOMER"),
    current = links.find((l) => path.endsWith(l.slug));
  if (!staff)
    return (
      <main className="startup">
        <h1>Cổng dành cho nhân sự</h1>
        <p>Tài khoản này không có vai trò nhân sự.</p>
        <button
          onClick={() =>
            void api("/auth/logout", "POST").finally(() =>
              router.replace("/login"),
            )
          }
        >
          Đăng xuất
        </button>
      </main>
    );
  const permitted =
    current && (!current.roles.length || can(user, ...current.roles));
  return (
    <Context.Provider value={user}>
      <div className="staff-app">
        {offline && (
          <div role="status" className="offline-banner">
            Mất kết nối mạng. Các thao tác lưu cần được thử lại khi có mạng.
          </div>
        )}
        <aside className={menu ? "sidebar open" : "sidebar"}>
          <Link className="brand" href="/workspace/dashboard">
            <Image
              src="/brand/logo.png"
              alt="YoFaSo Shop"
              width={150}
              height={80}
            />
          </Link>
          <p className="sidebar-label">Không gian vận hành</p>
          <nav aria-label="Điều hướng nội bộ">
            {links
              .filter((l) => !l.roles.length || can(user, ...l.roles))
              .map((l) => (
                <Link
                  key={l.slug}
                  href={`/workspace/${l.slug}`}
                  onClick={() => setMenu(false)}
                  className={
                    path.endsWith(l.slug) ? "nav-link active" : "nav-link"
                  }
                >
                  <l.icon size={20} weight="regular" />
                  {l.label}
                </Link>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <strong>{user.fullName}</strong>
            <small>
              {user.roles.map((r) => r.replace("ROLE_", "")).join(", ")}
            </small>
            <button
              className="secondary"
              onClick={() =>
                void api("/auth/logout", "POST").finally(() =>
                  router.replace("/login"),
                )
              }
            >
              <SignOut size={18} />
              Đăng xuất
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="secondary menu-button"
              aria-label="Mở điều hướng"
              onClick={() => setMenu(!menu)}
            >
              <List size={24} />
            </button>
            <span>YoFaSo Shop / {current?.label}</span>
            <Link
              href="/workspace/notifications"
              className="icon-link"
              aria-label="Thông báo"
            >
              <Bell size={22} />
            </Link>
          </header>
          <main id="main-content" className="main-content">
            {permitted ? (
              children
            ) : (
              <div className="empty">
                <h1>Không có quyền truy cập</h1>
                <p>Chọn màn hình được cấp quyền trong thanh điều hướng.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </Context.Provider>
  );
}
