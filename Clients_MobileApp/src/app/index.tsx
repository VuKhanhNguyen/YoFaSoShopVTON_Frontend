import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/session";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { EditorialImages } from "@/lib/catalog-data";
import { Button, Logo } from "@/components/shop/ui";
import AuthScreen from "./auth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const slides = [
  {
    image: EditorialImages.onboard1,
    icon: "sparkles-outline" as const,
    title: "Thử đồ ảo AI chuẩn vóc dáng",
    tag: "OOTDiffusion · VITON-HD & DressCode",
    desc: "Tải một tấm ảnh, AI mặc thử trang phục lên chính bạn — đúng phom dáng, chuẩn từng nếp vải và màu sắc thực tế.",
  },
  {
    image: EditorialImages.onboard2,
    tag: "Công thức thẩm mỹ 40-40-20",
    icon: "git-commit-outline" as const,
    title: "Trợ lý Stylist chấm điểm tỉ lệ & phối màu",
    desc: "Mỗi outfit được chấm điểm theo tỉ lệ cơ thể và sự hài hoà của bánh xe màu sắc, kèm gợi ý cải thiện để hack dáng tối đa.",
  },
  {
    image: EditorialImages.onboard3,
    tag: "O2O · Nhận tại shop hoặc COD",
    icon: "storefront-outline" as const,
    title: "Mua sắm đa kênh & trải nghiệm tại quầy",
    desc: "Thử online, nhận mã Digital Fitting Pass để thử thực tế tại cửa hàng YoFaSo gần nhất — hoặc giao tận tay thanh toán khi nhận.",
  },
];

type Stage = "splash" | "onboarding" | "auth";

export default function WelcomeIndex() {
  const { user } = useSession();
  const [stage, setStage] = useState<Stage>("splash");
  const [slideIndex, setSlideIndex] = useState(0);

  // Splash animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      if (user) {
        router.replace("/(shop)");
        return;
      }
      try {
        const seen = await AsyncStorage.getItem("yofaso.onboarding.v1");
        if (seen) {
          router.replace("/auth");
          return;
        } else {
          setStage("onboarding");
        }
      } catch {
        setStage("onboarding");
      }
    }, 2200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user]);

  const onNextSlide = async () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
      router.replace("/auth");
    }
  };

  const onSkipOnboarding = async () => {
    await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
    router.replace("/auth");
  };

  if (stage === "auth") {
    return <AuthScreen />;
  }

  if (stage === "splash") {
    return (
      <View style={st.splashContainer}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <Animated.View
          style={[
            st.splashContent,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Logo size="4xl" />
          <View style={st.splashDivider} />
          <Text
            style={st.splashTagline}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            Your Fashion, Your Own Soul
          </Text>
        </Animated.View>
      </View>
    );
  }

  const currentSlide = slides[slideIndex];

  return (
    <View style={[st.container, st.containerOnboarding]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Image
        source={currentSlide.image}
        style={st.bgImage}
        resizeMode="cover"
      />

      <View style={st.onboardingBackdrop}>
        <SafeAreaView edges={["top", "bottom"]} style={st.onboardingSafeArea}>
          {/* Header: Thanh tiến trình bên trái, nút Bỏ qua bên phải */}
          <View style={st.onboardingHeader}>
            <View style={st.progressRow}>
              {slides.map((_, i) => (
                <View
                  key={i}
                  style={[
                    st.progressIndicator,
                    i === slideIndex
                      ? st.progressIndicatorActive
                      : i < slideIndex
                      ? st.progressIndicatorDone
                      : null,
                  ]}
                />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ qua hướng dẫn"
              onPress={onSkipOnboarding}
              style={st.skipBtn}
            >
              <Text style={st.skipText}>Bỏ qua</Text>
            </Pressable>
          </View>

          {/* Bottom Content Area: Title -> Tag -> Description -> Button */}
          <View style={st.onboardingContent}>
            <Text style={st.slideTitle}>{currentSlide.title}</Text>

            <View style={st.tagRow}>
              <Ionicons name={currentSlide.icon} size={13} color={Colors.champagneDeep} />
              <Text style={st.tagText}>{currentSlide.tag}</Text>
            </View>

            <Text style={st.slideDesc}>{currentSlide.desc}</Text>

            <View style={st.actionsRow}>
              <Button
                title={slideIndex === slides.length - 1 ? "Bắt đầu trải nghiệm" : "Tiếp tục"}
                onPress={onNextSlide}
                icon={
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                }
                style={st.nextBtn}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  containerOnboarding: {
    backgroundColor: "#0F172A",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  splashContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  splashDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: Colors.champagne,
    marginVertical: 14,
  },
  splashTagline: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.champagneDeep,
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 16,
    maxWidth: "92%",
  },
  bgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  onboardingBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
  },
  onboardingSafeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "android" ? 16 : 8,
  },
  onboardingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 14 : 8,
  },
  skipBtn: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  skipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 84,
    gap: 6,
  },
  progressIndicator: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: Radii.full,
  },
  progressIndicatorActive: {
    backgroundColor: Colors.champagne,
    height: 4,
  },
  progressIndicatorDone: {
    backgroundColor: "#FFFFFF",
  },
  onboardingContent: {
    marginTop: "auto",
    paddingBottom: 8,
  },
  slideTitle: {
    fontFamily: "Editorial",
    fontSize: 28,
    color: "#FFFFFF",
    lineHeight: 34,
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  tagText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  slideDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 20,
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionsRow: {
    paddingTop: 4,
  },
  nextBtn: {
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: Colors.champagne,
  },
});
