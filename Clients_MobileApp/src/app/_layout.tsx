import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/components/shop/ui";
export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Jakarta: require("../../assets/fonts/Jakarta-Regular.ttf"),
    JakartaSemiBold: require("../../assets/fonts/Jakarta-SemiBold.ttf"),
    Editorial: require("../../assets/fonts/Playfair-SemiBold.ttf"),
    Mono: require("../../assets/fonts/JetBrains-Medium.ttf"),
  });
  if (!loaded && !fontError) return null;
  return (
    <SessionProvider>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.canvas },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(shop)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: "404" }} />
        <Stack.Screen name="orders" options={{ title: "Đơn hàng của tôi" }} />
        <Stack.Screen name="inbox" options={{ title: "Thông báo" }} />
        <Stack.Screen name="addresses" options={{ title: "Sổ địa chỉ" }} />
        <Stack.Screen name="cart" options={{ title: "Túi đồ" }} />
        <Stack.Screen name="checkout" options={{ title: "Xác nhận đặt hàng" }} />
        <Stack.Screen name="try-on" options={{ title: "Phòng thử đồ" }} />
        <Stack.Screen name="settings" options={{ title: "Hồ sơ và bảo mật" }} />
        <Stack.Screen name="reset-password" options={{ title: "Khôi phục tài khoản" }} />
      </Stack>
    </SessionProvider>
  );
}
