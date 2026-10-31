import { useEffect, useState } from "react";
import { ImageBackground, SafeAreaView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";
import { Button, Logo, Notice, colors } from "@/components/shop/ui";
const photos = [
  require("../../assets/editorial/onboard-1.jpg"),
  require("../../assets/editorial/onboard-2.jpg"),
  require("../../assets/editorial/onboard-3.jpg"),
];
const slides = [
  {
    title: "Tìm phong cách của bạn",
    body: "Khám phá những thiết kế được chọn cho mỗi ngày.",
  },
  {
    title: "Thử trước, chọn sau",
    body: "Xem trang phục trên ảnh của bạn với phòng thử đồ ảo.",
  },
  {
    title: "Mặc đẹp theo cách riêng",
    body: "Tham khảo độ hài hòa và chọn món đồ phối cùng.",
  },
];
export default function Welcome() {
  const [step, setStep] = useState<number | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("yofaso.onboarding.v1")
      .then((seen) => {
        if (active) seen ? router.replace("/auth") : setStep(0);
      })
      .catch(() => {
        if (active) {
          setError("Không đọc được dữ liệu thiết bị. Bạn vẫn có thể tiếp tục.");
          setStep(0);
        }
      })
      .finally(() => SplashScreen.hideAsync());
    return () => {
      active = false;
    };
  }, []);
  async function finish() {
    try {
      await AsyncStorage.setItem("yofaso.onboarding.v1", "seen");
      router.replace("/auth");
    } catch {
      setError(
        "Không lưu được trạng thái. Kiểm tra bộ nhớ thiết bị rồi thử lại.",
      );
    }
  }
  if (step === null)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.canvas,
        }}
      >
        <Logo />
      </SafeAreaView>
    );
  return (
    <ImageBackground source={photos[step]} style={{ flex: 1 }}>
      <SafeAreaView
        style={{ flex: 1, padding: 24, justifyContent: "space-between" }}
      >
        <View
          style={{
            backgroundColor: "#FFFFFFE8",
            alignSelf: "flex-start",
            borderRadius: 16,
            padding: 8,
          }}
        >
          <Logo />
        </View>
        <View
          style={{
            backgroundColor: "#FAFAF9F5",
            padding: 24,
            borderRadius: 24,
            gap: 12,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 30, color: colors.primary, fontWeight: "600" }}
          >
            {slides[step].title}
          </Text>
          <Notice>{slides[step].body}</Notice>
          <Text
            accessibilityLabel={`Trang ${step + 1} trên 3`}
            style={{ color: colors.muted }}
          >
            {step + 1} / 3
          </Text>
          {!!error && <Notice error>{error}</Notice>}
          <Button
            title={step === 2 ? "Bắt đầu" : "Tiếp tục"}
            onPress={() => (step === 2 ? void finish() : setStep(step + 1))}
          />
          <Button title="Bỏ qua" secondary onPress={() => void finish()} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
