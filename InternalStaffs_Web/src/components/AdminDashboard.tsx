"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ChartNoAxesCombined,
  ScanLine,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffHeader } from "@/components/staff-header";
import { useAuth, useRequireAuth } from "@/lib/auth";
import {
  ADMIN_ORDERS,
  ADMIN_VOUCHERS,
  ADMIN_REVIEWS,
  AUDIT_LOGS,
  type AuditEntry,
} from "@/lib/admin";
import { Finance } from "@/components/admin/finance";
import { Analytics } from "@/components/admin/analytics";
import { Studio, type CatalogProduct } from "@/components/admin/studio";
import { AdminOperations } from "@/components/admin/operations";
import { Governance } from "@/components/admin/governance";
import { ProfileModal } from "@/components/admin/profile-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminFooter } from "@/components/admin-footer";

type Tab = "finance" | "analytics" | "studio" | "operations" | "governance";

const TABS = [
  { key: "finance", label: "Tổng quan & Tài chính", icon: BarChart3 },
  { key: "analytics", label: "Phân tích VTON & AI", icon: ChartNoAxesCombined },
  { key: "studio", label: "Sản phẩm & AI Studio", icon: ScanLine },
  { key: "operations", label: "Vận hành & Khách hàng", icon: ShoppingBag },
  { key: "governance", label: "Phê duyệt & Phân quyền", icon: ShieldCheck },
] as const;

export function AdminDashboard() {
  const { user, ready } = useRequireAuth(["ROLE_SHOP_ADMIN"]);
  const { logout } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("finance");
  const [orders, setOrders] = useState(ADMIN_ORDERS);
  const [vouchers, setVouchers] = useState(ADMIN_VOUCHERS);
  const [reviews, setReviews] = useState(ADMIN_REVIEWS);
  const [logs, setLogs] = useState<AuditEntry[]>(AUDIT_LOGS);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);

  // Modals for sidebar bottom
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  const log = (action: string, reason: string) =>
    setLogs((prev) => [
      {
        id: `LOG-${Date.now()}-${prev.length}`,
        time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
        actor: `${user?.code ?? "NV-01"} · Chủ shop`,
        action,
        reason,
      },
      ...prev,
    ]);

  if (!ready || !user || user.role !== "ROLE_SHOP_ADMIN") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <StaffHeader title="ADMIN" className="h-14 py-0 flex-nowrap">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Cổng điều hành chủ shop
        </span>
      </StaffHeader>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Navigation Sidebar (Sticky fixed on scroll) */}
        <aside className="sticky top-14 z-30 shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs lg:w-56 lg:border-b-0 lg:border-r lg:self-start lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto">
          <div className="hidden px-5 pb-3 pt-6 lg:block">
            <p className="text-xs font-bold uppercase text-accent-hover">YoFaSo workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Quản trị đa kênh</p>
          </div>
          <nav aria-label="Phân hệ quản trị" className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:pb-6">
            {TABS.map((t) => (
              <Button
                key={t.key}
                aria-current={tab === t.key ? "page" : undefined}
                variant={tab === t.key ? "default" : "ghost"}
                className="h-auto justify-start py-3 text-xs lg:whitespace-normal lg:text-left"
                onClick={() => setTab(t.key)}
              >
                <t.icon />
                {t.label}
              </Button>
            ))}

            {/* Vạch phân cách ngăn cách các tab chức năng với phần tài khoản */}
            <div className="hidden my-2 border-t border-border lg:block" />
            <div className="mx-1 w-px self-stretch bg-border lg:hidden" />

            {/* Hồ sơ quản trị & Đăng xuất nằm ngay dưới các tab sidebar */}
            <div className="flex gap-1 lg:flex-col">
              <Button
                variant="ghost"
                className="h-auto justify-start py-3 text-xs font-semibold text-foreground hover:bg-muted lg:whitespace-normal lg:text-left"
                onClick={() => setProfileOpen(true)}
              >
                <User className="h-4 w-4 text-accent-hover shrink-0" />
                Hồ sơ quản trị
              </Button>
              <Button
                variant="ghost"
                className="h-auto justify-start py-3 text-xs font-semibold text-destructive hover:bg-danger-subtle hover:text-destructive lg:whitespace-normal lg:text-left"
                onClick={() => setLogoutConfirmOpen(true)}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Đăng xuất
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 lg:px-8 flex flex-col justify-between">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-[11px] text-muted-foreground">
              <span>Chủ shop / {TABS.find((t) => t.key === tab)?.label}</span>
              <span className="rounded-full bg-accent-subtle px-3 py-1 text-accent-hover">DỮ LIỆU ĐA KÊNH</span>
            </div>

            <div hidden={tab !== "finance"}>
              <Finance />
            </div>
            <div hidden={tab !== "analytics"}>
              <Analytics />
            </div>
            <div hidden={tab !== "studio"}>
              <Studio
                published={catalog}
                onSave={(product) => {
                  setCatalog((prev) =>
                    prev.some((p) => p.id === product.id)
                      ? prev.map((p) => (p.id === product.id ? product : p))
                      : [...prev, product]
                  );
                  log(
                    `${product.state === "BAN_NHAP" ? "Lưu nháp" : "Công bố"} sản phẩm ${product.name}`,
                    `${product.variants.length} SKU · ${product.state}`
                  );
                }}
              />
            </div>
            <div hidden={tab !== "operations"}>
              <AdminOperations
                orders={orders}
                setOrders={setOrders}
                vouchers={vouchers}
                setVouchers={setVouchers}
                reviews={reviews}
                setReviews={setReviews}
                log={log}
              />
            </div>
            <div hidden={tab !== "governance"}>
              <Governance logs={logs} log={log} />
            </div>
          </div>
        </main>
      </div>

      {/* Admin Web Footer */}
      <AdminFooter />

      {/* Profile Modal */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Xác nhận đăng xuất?"
        description="Bạn sẽ kết thúc phiên làm việc của chủ shop trên YoFaSo Admin Portal. Mọi dữ liệu thao tác chưa lưu có thể bị gián đoạn."
        confirmLabel="Đăng xuất ngay"
        cancelLabel="Ở lại"
        tone="danger"
        loading={loggingOut}
        onConfirm={handleLogout}
        onClose={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}
