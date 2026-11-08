"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Store,
  Cpu,
  Package,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleHome, useAuth, type Role } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

export function Login() {
  const { user, ready, login } = useAuth();
  const router = useRouter();

  // Login form state
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state (Admin only)
  const [mode, setMode] = useState<"login" | "forgot_email" | "forgot_otp">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (ready && user) {
      router.replace(roleHome(user.role));
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
    } catch (err: unknown) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại!");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartForgot = () => {
    setError("");
    setResetError("");
    setResetSuccess("");
    setResetEmail(email.trim());
    setMode("forgot_email");
  };

  const handleSendOtp = async () => {
    const trimmed = resetEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setResetError("Vui lòng nhập địa chỉ email hợp lệ của Quản trị viên.");
      return;
    }

    // Chỉ cho phép admin sử dụng tính năng khôi phục mật khẩu trực tuyến
    const nonAdminRoles = ["cashier", "warehouse", "shipper"];
    if (nonAdminRoles.some((role) => trimmed.startsWith(`${role}@`))) {
      setResetError(
        "Chỉ tài khoản Quản trị viên (Admin) mới có quyền khôi phục mật khẩu trực tuyến. Nhân viên thu ngân, kho bãi và giao vận vui lòng liên hệ Admin để được cấp lại mật khẩu."
      );
      return;
    }

    setResetBusy(true);
    setResetError("");
    try {
      const data = await api<{ requestId: string }>("/auth/forgot-password", "POST", {
        email: trimmed,
      });
      setRequestId(data.requestId);
      setMode("forgot_otp");
      setCooldown(60);
    } catch (e) {
      if (e instanceof ApiError) {
        setResetError(e.message);
      } else {
        setResetError("Không thể gửi mã xác minh OTP. Vui lòng thử lại sau.");
      }
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const otpClean = resetOtp.trim();
    if (!otpClean || otpClean.length !== 6) {
      setResetError("Vui lòng nhập đầy đủ mã OTP 6 chữ số đã nhận trong email.");
      return;
    }
    if (newPassword.length < 10) {
      setResetError("Mật khẩu mới phải có ít nhất 10 ký tự.");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setResetError("Mật khẩu mới phải bao gồm cả chữ cái và chữ số.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setResetBusy(true);
    setResetError("");
    try {
      await api("/auth/reset-password", "POST", {
        requestId,
        email: resetEmail.trim().toLowerCase(),
        otp: otpClean,
        newPassword,
      });

      setResetSuccess("Đã đổi mật khẩu thành công! Hãy đăng nhập lại bằng mật khẩu mới.");
      setEmail(resetEmail.trim());
      setPass("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (e) {
      if (e instanceof ApiError) {
        setResetError(e.message);
      } else {
        setResetError("Đặt lại mật khẩu thất bại. Mã OTP có thể không chính xác hoặc đã hết hạn.");
      }
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground lg:flex-row">
      {/* Nửa trái: Brand Editorial Showcase với background login2.jpg & lớp phủ mờ tinh tế */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white lg:w-1/2 lg:p-12 xl:p-14">
        {/* Editorial Background Image */}
        <Image
          src="/editorial/login2.jpg"
          alt="YoFaSo Luxury Fashion Editorial"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center"
        />

        {/* Multi-layered Cinematic Dark Overlay & Vignette (bảo đảm text luôn nổi bật) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/90 backdrop-blur-[1.5px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/80"
        />

        {/* Container nội dung */}
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          {/* Top Brand Bar & Live Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-modal backdrop-blur-md">
                <Image
                  src="/brand/YoFaSo_logo.png"
                  alt="YoFaSo Shop"
                  fill
                  sizes="56px"
                  className="object-cover"
                  priority
                />
              </span>
              <div>
                <p className="font-editorial text-2xl font-bold tracking-wide text-accent">YoFaSo</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
                  Internal Operations Portal
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-mono text-[11px] text-emerald-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Live System</span>
            </div>
          </div>

          {/* Center Editorial Showcase & Capabilities Bento */}
          <div className="my-auto py-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-accent backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              <span>Your Fashion &amp; Your Own Soul</span>
            </div>

            <h1 className="mt-4 font-editorial text-3xl font-bold leading-[1.2] text-white sm:text-4xl lg:text-[42px]">
              Hệ thống Quản trị Bán lẻ Thời trang{" "}
              <span className="text-accent underline decoration-accent/40 underline-offset-8">Đa kênh</span>{" "}
              &amp; Thử đồ ảo AI 
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Nền tảng điều hành bán lẻ thời trang thông minh tích hợp công nghệ OOTDiffusion AI, tối ưu hóa toàn diện chu trình vận hành từ quầy thu ngân POS, quản lý kho bãi đến giao vận shipper.
            </p>

            {/* 4 Feature Bento Pills */}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">Thu ngân &amp; POS Đa kênh</p>
                  <p className="truncate font-mono text-[11px] text-white/60">Tích hợp VietQR Napas247</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <Cpu className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">Thử đồ ảo AI OOTDiffusion</p>
                  <p className="truncate font-mono text-[11px] text-white/60">Xử lý GPU High-Fidelity</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">Kho bãi &amp; Tồn kho Realtime</p>
                  <p className="truncate font-mono text-[11px] text-white/60">Đồng bộ tự động đa điểm</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">Bảo mật RBAC 4 Cấp độ</p>
                  <p className="truncate font-mono text-[11px] text-white/60">Chuẩn Spring Security v6</p>
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </section>

      {/* Nửa phải: Auth Form & Quản trị viên Reset Password */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-[480px] rounded-2xl border border-border bg-surface p-8 shadow-modal">
          {mode === "login" && (
            <>
              <h2 className="text-xl font-bold">Đăng nhập Cổng Vận hành</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vui lòng sử dụng tài khoản được cấp quyền bởi Quản trị viên.
              </p>

              {resetSuccess && (
                <div
                  role="status"
                  className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {resetSuccess}
                </div>
              )}

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
                      placeholder="admin@yofaso.vn"
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
                  <button
                    type="button"
                    onClick={handleStartForgot}
                    className="text-xs font-semibold text-accent-hover hover:underline"
                  >
                    Quên mật khẩu? (Admin)
                  </button>
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
            </>
          )}

          {mode === "forgot_email" && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setResetError("");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-canvas text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Quay lại đăng nhập"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-xl font-bold">Khôi phục Mật khẩu Quản trị</h2>
                  <p className="text-xs text-muted-foreground">Dành riêng cho tài khoản Quản trị viên (Admin)</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                <p className="flex items-center gap-1.5 font-semibold">
                  <KeyRound className="h-3.5 w-3.5" /> Lưu ý phân quyền:
                </p>
                <p className="mt-1">
                  Chỉ tài khoản Quản trị viên mới được gửi mã xác minh OTP qua email. Các tài khoản nhân viên (Thu ngân, Kho, Shipper) không được phép tự đặt lại mật khẩu và cần liên hệ Admin để cấp lại.
                </p>
              </div>

              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendOtp();
                }}
              >
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email Quản trị viên (Admin Email)
                  </span>
                  <span className="relative mt-1.5 block">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="admin@yofaso.vn"
                      autoComplete="email"
                      className="h-11 w-full rounded-md border border-border bg-canvas pl-9 pr-3 text-sm outline-none focus:border-primary"
                    />
                  </span>
                </label>

                {resetError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {resetError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={resetBusy}
                  className="h-12 w-full gap-2 text-sm font-bold tracking-wide"
                >
                  {resetBusy ? "ĐANG GỬI MÃ OTP…" : "GỬI MÃ XÁC MINH OTP"} <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setResetError("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Quay lại màn hình đăng nhập
                  </button>
                </div>
              </form>
            </div>
          )}

          {mode === "forgot_otp" && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot_email");
                    setResetError("");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-canvas text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Nhập lại email khác"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-xl font-bold">Xác thực OTP &amp; Đổi mật khẩu</h2>
                  <p className="text-xs text-muted-foreground">
                    Mã gửi đến: <span className="font-mono font-bold text-foreground">{resetEmail}</span>
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Vui lòng kiểm tra hộp thư đến (và thư rác/spam). Nhập mã OTP gồm 6 chữ số và thiết lập mật khẩu mới.
              </p>

              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResetPassword();
                }}
              >
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mã xác minh OTP (6 chữ số)
                  </span>
                  <span className="relative mt-1.5 block">
                    <input
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                      className="h-12 w-full rounded-md border border-border bg-canvas text-center font-mono text-2xl font-bold tracking-[0.35em] outline-none focus:border-primary"
                    />
                  </span>
                </label>

                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mật khẩu mới
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">Tối thiểu 10 ký tự (chữ + số)</span>
                  </div>
                  <span className="relative mt-1.5 block">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="h-11 w-full rounded-md border border-border bg-canvas pl-9 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      aria-label={showNewPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowNewPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Xác nhận mật khẩu mới
                  </span>
                  <span className="relative mt-1.5 block">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="h-11 w-full rounded-md border border-border bg-canvas pl-9 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPass ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                      onClick={() => setShowConfirmPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Chưa nhận được mã OTP?</span>
                  {cooldown > 0 ? (
                    <span className="font-mono text-xs font-medium text-muted-foreground">Gửi lại sau {cooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      disabled={resetBusy}
                      onClick={() => void handleSendOtp()}
                      className="font-semibold text-accent-hover hover:underline"
                    >
                      Gửi lại mã OTP
                    </button>
                  )}
                </div>

                {resetError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-md bg-danger-subtle px-3 py-2 text-sm font-medium text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {resetError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={resetBusy}
                  className="h-12 w-full gap-2 text-sm font-bold tracking-wide"
                >
                  {resetBusy ? "ĐANG ĐẶT LẠI MẬT KHẨU…" : "ĐẶT LẠI MẬT KHẨU"} <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot_email");
                      setResetOtp("");
                      setResetError("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Nhập lại địa chỉ email khác
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 YoFaSo Shop. Bảo mật phân quyền RBAC đa cấp độ theo chuẩn Spring Security.
        </p>
      </section>
    </div>
  );
}
