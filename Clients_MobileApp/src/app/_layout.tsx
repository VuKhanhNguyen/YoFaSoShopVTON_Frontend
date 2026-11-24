import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionProvider } from "@/lib/session";
import { ChatProvider } from "@/lib/chat-context";
import { ChatSheetModal } from "@/components/shop/ChatFabAndSheet";
import { colors } from "@/components/shop/ui";
import { SkeletonClockProvider } from "@/components/shop/Skeleton";

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Jakarta: require("../../assets/fonts/Jakarta-Regular.ttf"),
    JakartaSemiBold: require("../../assets/fonts/Jakarta-SemiBold.ttf"),
    Editorial: require("../../assets/fonts/Playfair-SemiBold.ttf"),
    Mono: require("../../assets/fonts/JetBrains-Medium.ttf"),
  });
  if (!loaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SkeletonClockProvider>
        <SessionProvider>
          <ChatProvider>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <Stack
              screenOptions={{
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerBackButtonDisplayMode: "minimal",
                contentStyle: { backgroundColor: colors.canvas },
                animation: "ios_from_right",
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false, animation: "fade" }} />
              <Stack.Screen name="auth" options={{ headerShown: false, animation: "fade_from_bottom" }} />
              <Stack.Screen name="auth-callback" options={{ headerShown: false, animation: "fade" }} />
              <Stack.Screen name="(shop)" options={{ headerShown: false, animation: "fade" }} />
              <Stack.Screen name="+not-found" options={{ title: "404" }} />
              <Stack.Screen name="orders" options={{ title: "Đơn hàng của tôi" }} />
              <Stack.Screen name="inbox" options={{ title: "Thông báo" }} />
              <Stack.Screen name="addresses" options={{ title: "Sổ địa chỉ" }} />
              <Stack.Screen name="cart" options={{ title: "Túi đồ" }} />
              <Stack.Screen name="checkout" options={{ title: "Xác nhận đặt hàng" }} />
              <Stack.Screen name="try-on" options={{ title: "Phòng thử đồ", animation: "fade_from_bottom" }} />
              <Stack.Screen name="settings" options={{ title: "Hồ sơ và bảo mật" }} />
              <Stack.Screen name="support" options={{ title: "Trung tâm Hỗ trợ & Showroom" }} />
              <Stack.Screen name="reset-password" options={{ title: "Khôi phục tài khoản" }} />
            </Stack>
            <ChatSheetModal />
          </ChatProvider>
        </SessionProvider>
      </SkeletonClockProvider>
    </GestureHandlerRootView>
  );
}
