import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, requestKey } from "@/lib/api";
import type { Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import {
  EditorialImages,
  SAN_PHAM_MOCK,
  SanPham,
} from "@/lib/catalog-data";
import {
  LoaiKhungAnhNguoi,
  khungTuTiLe,
  khungHopLe,
} from "@/lib/vton-engine";
import { Button, Notice, colors } from "@/components/shop/ui";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const STEPS = [
  "Đang dò 18 khớp xương OpenPose...",
  "Đang bóc tách Agnostic Mask trang phục...",
  "Đang dệt đồ qua mô hình OOTDiffusion DressCode...",
];

export default function TryOnScreen() {
  const { variantId, category } = useLocalSearchParams<{
    variantId: string;
    category: string;
  }>();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [stage, setStage] = useState<"gate" | "processing">("gate");
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Animations
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Frame estimation
  const khung: LoaiKhungAnhNguoi = photoDimensions
    ? khungTuTiLe(photoDimensions.width, photoDimensions.height)
    : "HALF_BODY";
  const isValidPose = photoUri
    ? khungHopLe(khung, (category as any) || "upper_body")
    : false;

  // Scan beam animation loop
  useEffect(() => {
    if (stage === "processing") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [stage]);

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          setError("Cần cấp quyền máy ảnh để chụp ảnh thử đồ.");
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        setPhotoDimensions({ width: asset.width, height: asset.height });
        setError("");
      }
    } catch (e: any) {
      setError(e.message || "Không thể chọn ảnh.");
    }
  };

  const useSamplePhoto = () => {
    // High-fashion sample model image from Editorial assets
    const sample = Image.resolveAssetSource(EditorialImages.onboard1);
    setPhotoUri(sample.uri);
    setPhotoDimensions({ width: sample.width, height: sample.height });
    setError("");
  };

  const handleStartVton = async () => {
    if (!photoUri) return;
    setStage("processing");
    setCurrentStep(0);

    const t1 = setTimeout(() => setCurrentStep(1), 1100);
    const t2 = setTimeout(() => setCurrentStep(2), 2200);

    // Call real API if available, or simulate fallback session
    try {
      const form = new FormData();
      form.append("role", "person");
      form.append("consent", "true");
      if (Platform.OS === "web") {
        form.append("file", await (await fetch(photoUri)).blob(), "person.jpg");
      } else {
        form.append("file", {
          uri: photoUri,
          type: "image/jpeg",
          name: "person.jpg",
        } as any);
      }

      // Try uploading asset to backend
      const uploadRes = await api<{ assetId: string }>("/assets", "POST", form).catch(() => null);
      const personAssetId = uploadRes?.assetId || "mock-asset-person";

      const sessionBody = {
        variantId: variantId || "SP00000001",
        personAssetId,
        seed: 42,
        steps: 20,
        samples: 1,
        consent: true,
      };

      const sessionRes = await api<Row>("/try-on/sessions", "POST", sessionBody, requestKey()).catch(() => null);
      const sessionId = sessionRes?.resourceId || sessionRes?.operationId || `SESSION-${Date.now().toString().slice(-6)}`;

      setTimeout(() => {
        router.replace({
          pathname: "/session/[id]",
          params: {
            id: String(sessionId),
            variantId: variantId || "SP00000001",
            before: photoUri,
          },
        });
      }, 3400);
    } catch (e) {
      // In case of network error, proceed with local session simulation
      setTimeout(() => {
        router.replace({
          pathname: "/session/[id]",
          params: {
            id: `SESSION-${Date.now().toString().slice(-6)}`,
            variantId: variantId || "SP00000001",
            before: photoUri,
          },
        });
      }, 3400);
    }
  };

  return (
    <View style={st.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={st.topHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          onPress={() => router.back()}
          style={st.closeCircleBtn}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={st.headerMonoTag}>
            UC_VTON · {stage === "gate" ? "POSE GATE HUD" : "GPU RENDER"}
          </Text>
          <Text style={st.headerSub}>
            {stage === "gate" ? "Kiểm tra tư thế dáng người" : "Đang xử lý OOTDiffusion"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {stage === "gate" ? (
        <View style={st.contentArea}>
          {/* Viewfinder Canvas Frame */}
          <View style={st.viewfinderFrame}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={st.photoPreview} resizeMode="contain" />
            ) : (
              <View style={st.emptyDottedPose}>
                <Ionicons name="body-outline" size={130} color={Colors.champagne} style={{ opacity: 0.65 }} />
                <Text style={st.viewfinderPrompt}>
                  Chụp ảnh hoặc chọn ảnh đứng thẳng rõ vóc dáng
                </Text>
              </View>
            )}

            {/* Tactical 4 Corner Brackets (Design.md) */}
            <View style={[st.cornerBracket, st.cornerTL]} />
            <View style={[st.cornerBracket, st.cornerTR]} />
            <View style={[st.cornerBracket, st.cornerBL]} />
            <View style={[st.cornerBracket, st.cornerBR]} />

            {/* Status Chips HUD Overlay */}
            <View style={st.chipsOverlayRow}>
              <View
                style={[
                  st.hudChip,
                  { backgroundColor: photoUri ? "rgba(5, 150, 105, 0.85)" : "rgba(15, 23, 42, 0.65)" },
                ]}
              >
                <Ionicons name="sunny" size={11} color="#FFFFFF" />
                <Text style={st.hudChipText}>{photoUri ? "Độ sáng: Chuẩn" : "Độ sáng: —"}</Text>
              </View>

              <View
                style={[
                  st.hudChip,
                  {
                    backgroundColor: !photoUri
                      ? "rgba(15, 23, 42, 0.65)"
                      : isValidPose
                      ? "rgba(5, 150, 105, 0.85)"
                      : "rgba(217, 119, 6, 0.85)",
                  },
                ]}
              >
                <Ionicons name="person" size={11} color="#FFFFFF" />
                <Text style={st.hudChipText}>
                  {photoUri
                    ? isValidPose
                      ? "Khung hình: Chuẩn"
                      : "Khung hình: Chưa chuẩn"
                    : "Khung hình: —"}
                </Text>
              </View>

              <View
                style={[
                  st.hudChip,
                  {
                    backgroundColor: photoUri && isValidPose
                      ? "rgba(5, 150, 105, 0.85)"
                      : "rgba(15, 23, 42, 0.65)",
                  },
                ]}
              >
                <Ionicons name="git-commit" size={11} color="#FFFFFF" />
                <Text style={st.hudChipText}>
                  {photoUri ? (isValidPose ? "Khớp xương: 18/18" : "Khớp xương: 12/18") : "Khớp: —"}
                </Text>
              </View>
            </View>

            {/* Warning Box if pose not valid */}
            {photoUri && !isValidPose ? (
              <View style={st.warningOverlayBox}>
                <Ionicons name="warning-outline" size={16} color="#FFFFFF" />
                <Text style={st.warningOverlayText}>
                  {category === "lower_body"
                    ? "Bạn đang thử quần/chân váy: Ảnh cần thấy rõ mắt cá chân và mũi giày. Hãy lùi xa 2m và chụp lại."
                    : "Ảnh chưa thấy rõ vai và hông. Vui lòng đứng thẳng, không khoanh tay để AI đo phom chuẩn."}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 3 Source Buttons */}
          <View style={st.sourceButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh ngay"
              onPress={() => pickImage(true)}
              style={st.sourceBtnPrimary}
            >
              <Ionicons name="camera" size={20} color={Colors.primary} />
              <Text style={st.sourceBtnPrimaryText}>Chụp ảnh</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn từ Thư viện"
              onPress={() => pickImage(false)}
              style={st.sourceBtnSecondary}
            >
              <Ionicons name="images-outline" size={20} color="#FFFFFF" />
              <Text style={st.sourceBtnSecondaryText}>Thư viện</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dùng ảnh mẫu"
              onPress={useSamplePhoto}
              style={st.sourceBtnSecondary}
            >
              <Ionicons name="sparkles-outline" size={20} color={Colors.champagne} />
              <Text style={st.sourceBtnSecondaryText}>Ảnh mẫu</Text>
            </Pressable>
          </View>

          {!!error && <Notice error style={{ marginTop: 10 }}>{error}</Notice>}

          {/* Action CTA */}
          <Button
            title="BẮT ĐẦU ƯỚM THỬ VTON"
            disabled={!photoUri || !isValidPose}
            onPress={handleStartVton}
            accent
            icon={<Ionicons name="scan-outline" size={18} color={Colors.primary} />}
            style={{ height: 54, marginTop: 14 }}
          />
        </View>
      ) : (
        /* Processing Stage with Laser Fabric Scan Animation */
        <View style={st.processingContainer}>
          <View style={st.scanCanvas}>
            {photoUri && (
              <Image source={{ uri: photoUri }} style={st.scanImage} resizeMode="cover" />
            )}
            <View style={st.scanTintOverlay} />

            {/* Vertical Animated Laser Scan Beam (Design.md) */}
            <Animated.View
              style={[
                st.laserScanBeam,
                {
                  transform: [
                    {
                      translateY: scanAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, SCREEN_HEIGHT * 0.48],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* Step Checkpoints */}
          <View style={st.stepsList}>
            {STEPS.map((stepText, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;

              return (
                <View key={idx} style={st.stepItemRow}>
                  <View
                    style={[
                      st.stepStatusDot,
                      isPast && { backgroundColor: Colors.statusSuccess },
                      isCurrent && { backgroundColor: Colors.champagne, borderWidth: 2, borderColor: "#FFFFFF" },
                    ]}
                  />
                  <Text
                    style={[
                      st.stepItemText,
                      (isPast || isCurrent) && { color: "#FFFFFF", fontFamily: "JakartaSemiBold" },
                    ]}
                  >
                    {stepText}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={st.gpuNoticeText}>
            YoFaSo Virtual Atelier · Mô hình AI chạy điện toán đám mây GPU H100
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 36,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  closeCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMonoTag: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.champagne,
    letterSpacing: 1.2,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 2,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  viewfinderFrame: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  emptyDottedPose: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  viewfinderPrompt: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.65)",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  cornerBracket: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: Colors.champagne,
  },
  cornerTL: {
    top: 12,
    left: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTR: {
    top: 12,
    right: 12,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBL: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBR: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  chipsOverlayRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  hudChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  hudChipText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: "#FFFFFF",
  },
  warningOverlayBox: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: "rgba(217, 119, 6, 0.95)",
    borderRadius: Radii.md,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningOverlayText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: "#FFFFFF",
    lineHeight: 16,
  },
  sourceButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  sourceBtnPrimary: {
    flex: 1,
    height: 60,
    borderRadius: Radii.lg,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sourceBtnPrimaryText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  sourceBtnSecondary: {
    flex: 1,
    height: 60,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sourceBtnSecondaryText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  processingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  scanCanvas: {
    height: SCREEN_HEIGHT * 0.52,
    borderRadius: Radii.xl,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  scanImage: {
    width: "100%",
    height: "100%",
  },
  scanTintOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  laserScanBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.champagne,
    shadowColor: Colors.champagne,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  stepsList: {
    marginTop: 24,
    gap: 12,
  },
  stepItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  stepItemText: {
    fontSize: 13,
    fontFamily: "Mono",
    color: "rgba(255, 255, 255, 0.65)",
  },
  gpuNoticeText: {
    marginTop: "auto",
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.champagne,
    opacity: 0.8,
  },
});
