import { router } from "expo-router";
import { Button, Heading, Logo, Notice, Screen } from "@/components/shop/ui";
export default function NotFound() {
  return (
    <Screen>
      <Logo />
      <Heading>404. Trang đã lạc mất</Heading>
      <Notice>
        Đường dẫn này không còn tồn tại. Cùng trở lại khám phá bộ sưu tập.
      </Notice>
      <Button title="Về khám phá" onPress={() => router.replace("/(shop)")} />
    </Screen>
  );
}
