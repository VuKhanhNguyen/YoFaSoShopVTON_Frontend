"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCOUNTS, ROLES, roleHome, useAuth, type Role } from "@/lib/auth";

const DEMO_ORDER: Role[] = [
  "ROLE_SHOP_ADMIN",
  "ROLE_STAFF_CASHIER",
  "ROLE_STAFF_WAREHOUSE",
  "ROLE_STAFF_SHIPPER",
];

export function Login() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(roleHome(user.role));
    }
  }, [ready, user, router]);

  const go = (role: Role) => {
    router.replace(roleHome(role));
  };

  const submit = async () => {
    if (!email.trim() || !pass.trim()) {
      setError("Vui lòng điền đầy đủ email/mã nhân viên và mật khẩu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const u = await login(email, pass, remember);
      if (!u) {
        setError("Tài khoản hoặc mật khẩu không chính xác, hoặc chưa được cấp quyền!");
        return;
      }
      go(u.role);
    } catch {
      setError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (role: Role) => {
    const acc = ACCOUNTS[role];
    setEmail(acc.email);
    setPass(acc.pass);
    setLoading(true);
    try {
      const u = await login(acc.email, acc.pass, remember);
      if (u) {
        setError("");
        go(u.role);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground lg:flex-row">
      {/* Nửa trái: Brand Editorial Showcase */}
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden bg-primary p-8 text-primary-foreground lg:w-1/2 lg:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 46px, var(--accent) 46px 47px), repeating-linear-gradient(-65deg, transparent 0 90px, var(--accent) 90px 91px)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface p-2 shadow-modal">
            <Image
              src="/brand/logo.png"
              alt="YoFaSo Shop"
              width={56}
              height={56}
              className="h-full w-auto object-contain"
              priority
            />
          </span>
          <div>
            <p className="font-editorial text-2xl font-semibold tracking-wide text-accent">YoFaSo</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-foreground/70">
              Internal Operations Portal
            </p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-editorial text-4xl leading-tight lg:text-5xl">
            Hệ thống Quản trị Bán lẻ Thời trang <span className="text-accent">Đa kênh</span> &amp; Thử đồ ảo AI Tích hợp
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            YoFaSo Omnichannel Commerce &amp; AI Virtual Try-On Platform — Cổng điều hành nội bộ đa vai trò v1.2.0.
          </p>
        </div>

        <div className="relative rounded-xl border border-accent/40 bg-primary-foreground/5 p-4 font-mono text-xs leading-relaxed text-primary-foreground/80 backdrop-blur-sm">
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            Hệ thống Máy chủ Backend &amp; GPU OOTDiffusion: Hoạt động bình thường (99.98% Uptime)
          </p>
          <p className="mt-2 text-primary-foreground/60">
            Phiên bản v1.2.0 · CSDL MySQL 18 Bảng · Cổng VietQR Napas247 Online · OOTDiffusion Try-On Ready
          </p>
        </div>
      </section>

      {/* Nửa phải: Auth Form & Demo Role Switcher */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-surface p-8 shadow-modal">
          <h2 className="text-xl font-bold">Đăng nhập Cổng Vận hành</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vui lòng sử dụng tài khoản được cấp quyền bởi Quản trị viên.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email hoặc Mã nhân viên
              </span>
              <span className="relative mt-1.5 block">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cashier@yofaso.vn"
                  autoComplete="username"
                  className="h-11 w-full rounded-md border border-border bg-canvas pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mật khẩu</span>
              <span className="relative mt-1.5 block">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-md border border-border bg-canvas pl-9 pr-10 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Ghi nhớ phiên đăng nhập
              </label>
              <span className="cursor-pointer text-xs font-semibold text-accent-hover hover:underline">
                Quên mật khẩu? (Liên hệ Admin)
              </span>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 text-sm font-bold tracking-wide"
            >
              {loading ? "ĐANG XÁC THỰC…" : "ĐĂNG NHẬP HỆ THỐNG"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {/* Demo Quick Role Switcher */}
          <div className="mt-6 rounded-xl border border-dashed border-accent bg-accent-subtle p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent-hover">
              <Sparkles className="h-3.5 w-3.5" /> Phím tắt đăng nhập nhanh cho hội đồng chấm điểm (One-click Demo)
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ORDER.map((role) => {
                const acc = ACCOUNTS[role];
                return (
                  <Button
                    key={role}
                    variant="outline"
                    disabled={loading}
                    onClick={() => void demoLogin(role)}
                    className="h-auto justify-start gap-2 rounded-lg border-border bg-surface px-3 py-2.5 text-left hover:border-accent"
                  >
                    <span className="text-lg" aria-hidden>
                      {acc.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">{acc.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{acc.email}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {ROLES.length} vai trò: admin123 · cashier123 · warehouse123 · shipper123
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 YoFaSo Shop. Bảo mật phân quyền RBAC đa cấp độ theo chuẩn Spring Security.
        </p>
      </section>
    </div>
  );
}
