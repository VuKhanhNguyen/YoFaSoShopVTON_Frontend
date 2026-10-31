import { type ReactNode } from "react";
import { router } from "expo-router";
import { useSession } from "@/lib/session";
import { Button, Heading, Notice, Screen } from "./ui";
export function RequireAccount({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? (
    children
  ) : (
    <Screen>
      <Heading>Không gian riêng của bạn</Heading>
      <Notice>
        Đăng nhập để lưu túi đồ, xem đơn hàng và thử đồ trên ảnh của bạn.
      </Notice>
      <Button
        title="Đăng nhập / Đăng ký"
        onPress={() => router.push("/auth")}
      />
    </Screen>
  );
}
