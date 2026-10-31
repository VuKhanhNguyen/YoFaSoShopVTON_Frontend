import { Stack } from "expo-router";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { User } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { ContractForm } from "@/components/shop/ContractForm";
import { Heading, Notice, Panel, Screen } from "@/components/shop/ui";
export default function Settings() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}
function Content() {
  const { user, setUser, signOut } = useSession();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Hồ sơ và bảo mật" }} />
      <Heading>Hồ sơ của bạn</Heading>
      <Notice>Đổi email cần nhập mật khẩu hiện tại để xác nhận.</Notice>
      <ContractForm
        schemaName="Profile"
        initial={{
          fullName: user?.fullName,
          email: user?.email,
          phone: user?.phone,
        }}
        onSubmit={async (v) => setUser(await api<User>("/me", "PATCH", v))}
      />
      <Panel>
        <Heading small>Đổi mật khẩu</Heading>
        <ContractForm
          schemaName="Password"
          title="Đổi mật khẩu"
          onSubmit={async (v) => {
            await api("/me/password", "POST", v);
            await signOut();
          }}
        />
      </Panel>
    </Screen>
  );
}
