"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/models";
import { ContractForm } from "./ContractForm";
export function Login() {
  const router = useRouter(),
    [reset, setReset] = useState(false),
    [request, setRequest] = useState<{ requestId: string; email: string }>();
  return (
    <main className="login-page">
      <section className="login-art">
        <Image
          src="/editorial/login.jpg"
          alt="Bộ sưu tập thời trang YoFaSo"
          fill
          priority
          sizes="55vw"
        />
        <div className="login-caption">
          <h2>
            Phong cách bắt đầu
            <br />
            từ những điều chỉn chu.
          </h2>
          <p>Không gian làm việc của đội ngũ YoFaSo Shop.</p>
        </div>
      </section>
      <section className="login-form">
        <Image
          src="/brand/logo.png"
          alt="YoFaSo Shop"
          width={170}
          height={96}
          priority
        />
        <p className="eyebrow">Cổng vận hành nội bộ</p>
        <h1>{reset ? "Khôi phục tài khoản" : "Chào mừng trở lại"}</h1>
        <p className="muted">
          {reset
            ? "Xác minh email để đặt mật khẩu mới."
            : "Đăng nhập bằng tài khoản được chủ shop cấp."}
        </p>
        {reset ? (
          !request ? (
            <ContractForm
              schemaName="Forgot"
              title="Gửi mã xác minh"
              onSubmit={async (v) => {
                const data = await api<{ requestId: string }>(
                  "/auth/forgot-password",
                  "POST",
                  v,
                );
                setRequest({
                  requestId: data.requestId,
                  email: String(v.email),
                });
              }}
            />
          ) : (
            <ContractForm
              schemaName="Reset"
              initial={request}
              title="Đặt lại mật khẩu"
              onSubmit={async (v) => {
                await api("/auth/reset-password", "POST", v);
                setReset(false);
                setRequest(undefined);
              }}
            />
          )
        ) : (
          <ContractForm
            schemaName="Login"
            title="Đăng nhập"
            onSubmit={async (v) => {
              const data = await api<{ user: User }>("/auth/login", "POST", v);
              if (
                !data.user.roles.some((r) =>
                  [
                    "ROLE_SHOP_ADMIN",
                    "ROLE_STAFF_CASHIER",
                    "ROLE_STAFF_WAREHOUSE",
                    "ROLE_STAFF_SHIPPER",
                  ].includes(r),
                )
              ) {
                await api("/auth/logout", "POST");
                throw new Error(
                  "Tài khoản khách hàng vui lòng dùng ứng dụng YoFaSo.",
                );
              }
              router.replace("/workspace/dashboard");
            }}
          />
        )}
        <button
          className="text-button"
          onClick={() => {
            setReset(!reset);
            setRequest(undefined);
          }}
        >
          {reset ? "Trở về đăng nhập" : "Quên mật khẩu?"}
        </button>
        <p className="login-footnote">
          Quyền truy cập được xác minh bởi máy chủ trên từng thao tác.
        </p>
      </section>
    </main>
  );
}
