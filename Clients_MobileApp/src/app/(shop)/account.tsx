import { router } from "expo-router";
import { useSession } from "@/lib/session";
import {
  Button,
  Heading,
  Logo,
  Notice,
  Panel,
  Screen,
} from "@/components/shop/ui";
export default function Account() {
  const { user, signOut } = useSession();
  return (
    <Screen>
      <Logo />
      <Heading>{user ? user.fullName : "Xin chào, bạn mới"}</Heading>
      <Notice>
        {user?.email || "Đăng nhập để lưu phong cách và theo dõi đơn hàng."}
      </Notice>
      {user ? (
        <>
          <Panel>
            <Heading small>Thành viên {user.membership}</Heading>
            <Notice>{user.loyaltyPoints} điểm tích lũy</Notice>
          </Panel>
          <Button
            title="Đơn hàng của tôi"
            onPress={() => router.push("/orders")}
          />
          <Button
            secondary
            title="Sổ địa chỉ"
            onPress={() => router.push("/addresses")}
          />
          <Button
            secondary
            title="Hồ sơ và bảo mật"
            onPress={() => router.push("/settings")}
          />
          <Button
            secondary
            title="Thông báo"
            onPress={() => router.push("/inbox")}
          />
          <Button
            secondary
            title="Đăng xuất"
            onPress={() => void signOut().catch(() => {})}
          />
        </>
      ) : (
        <Button
          title="Đăng nhập / Đăng ký"
          onPress={() => router.push("/auth")}
        />
      )}
    </Screen>
  );
}
