import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { ContractForm } from "@/components/shop/ContractForm";
import { Heading, Notice, Screen } from "@/components/shop/ui";
export default function ResetPassword() {
  const [request, setRequest] = useState<{
    requestId: string;
    email: string;
  }>();
  return (
    <Screen>
      <Heading>Khôi phục tài khoản</Heading>
      <Notice>
        Mã xác minh được gửi đến email nếu thông tin phù hợp. Không chia sẻ mã
        với người khác.
      </Notice>
      {!request ? (
        <ContractForm
          schemaName="Forgot"
          title="Gửi mã xác minh"
          onSubmit={async (v) => {
            const data = await api<{ requestId: string }>(
              "/auth/forgot-password",
              "POST",
              v,
            );
            setRequest({ requestId: data.requestId, email: String(v.email) });
          }}
        />
      ) : (
        <ContractForm
          schemaName="Reset"
          initial={request}
          exclude={["requestId", "email"]}
          title="Đặt lại mật khẩu"
          onSubmit={async (v) => {
            await api("/auth/reset-password", "POST", { ...v, ...request });
            router.replace("/auth");
          }}
        />
      )}
    </Screen>
  );
}
