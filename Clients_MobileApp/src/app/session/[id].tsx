import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import {
  checkTryOnCompatibility,
  isComplete,
  isPending,
  statusLabel,
  type TryOnSession,
} from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { Button, Notice, Sheet, State } from "@/components/shop/ui";
import { BeforeAfterStage } from "@/components/shop/BeforeAfterStage";
import { OutfitScoring, type RecommendedTryOnItem } from "@/components/shop/OutfitScoring";
import { ResultActions, exportResultImage } from "@/components/shop/ResultActions";
import { PrivateImage } from "@/components/shop/PrivateImage";
import { FittingPassModal } from "@/components/shop/FittingPassModal";

const SCREEN_WIDTH = Dimensions.get("window").width;
const STAGE_HEIGHT = 420;

const STAGE_STEPS = [
  { key: "VALIDATING", label: "Nhận diện tư thế & khung hình", minProgress: 5 },
  { key: "UPLOADING", label: "Chuẩn hóa ảnh & gửi dữ liệu tới AI", minProgress: 20 },
  { key: "VTON_RENDER", label: "Ướm trang phục & giữ nếp vải", minProgress: 38 },
  { key: "SAVING", label: "Tải ảnh sắc nét & lưu vào Tủ đồ", minProgress: 84 },
];

function stageStepIndex(stage?: string): number {
  switch (stage) {
    case "VALIDATING":
      return 0;
    case "PREPROCESSING":
    case "UPLOADING":
      return 1;
    case "VTON_RENDER":
      return 2;
    case "DOWNLOADING":
    case "SAVING":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return -1;
  }
}

function stageCeiling(stage?: string, status?: string): number {
  switch (stage) {
    case "QUEUED":
      return 4;
    case "VALIDATING":
      return 18;
    case "PREPROCESSING":
      return 27;
    case "UPLOADING":
      return 37;
    case "VTON_RENDER":
      return 81;
    case "DOWNLOADING":
      return 91;
    case "SAVING":
      return 98;
    default:
      return status === "PROCESSING" || status === "DANG_RENDER_GPU" ? 81 : 4;
  }
}

function stageTitleFallback(stage?: string, status?: string): string {
  switch (stage) {
    case "QUEUED":
      return "Đang xếp hàng chờ xử lý...";
    case "VALIDATING":
      return "YOLO26-Pose đang kiểm tra tư thế & khung hình...";
    case "PREPROCESSING":
      return "Đang chuẩn hóa ảnh người & trang phục...";
    case "UPLOADING":
      return "Đang tải ảnh lên hệ thống AI VTON...";
    case "VTON_RENDER":
      return "Hệ thống AI đang ướm trang phục lên cơ thể...";
    case "DOWNLOADING":
      return "Đang tải ảnh kết quả chất lượng cao...";
    case "SAVING":
      return "Đang hoàn tất & lưu vào Tủ đồ VTON...";
    default:
      return status === "PROCESSING" || status === "DANG_RENDER_GPU"
        ? "Đang xử lý ảnh trên hệ thống AI..."
        : "Đang xếp hàng chờ xử lý...";
  }
}

export default function SessionResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const path = user && id ? "/try-on/sessions/" + encodeURIComponent(id) : null;
  const state = useResource<TryOnSession>(path);
  const { reload } = state;

  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [imageErrorDetail, setImageErrorDetail] = useState("");
  const [imageAttempt, setImageAttempt] = useState(0);

  // Modals & Chained Try-On state
  const [passOpen, setPassOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [liveScore, setLiveScore] = useState<
    { total: number; tier?: string; tierLabel?: string } | undefined
  >(undefined);
  const [chainTarget, setChainTarget] = useState<RecommendedTryOnItem | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainSaveMsg, setChainSaveMsg] = useState("");

  // Floating popup toast
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    setLiveScore(undefined);
    setChainTarget(null);
    setChainSaveMsg("");
  }, [id]);

  // Realtime elapsed timer & smooth GPU-accelerated progress bar
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [displayProgress, setDisplayProgress] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  const session = state.data?.sessionId === id && user ? state.data : undefined;
  const pending = !!session && isPending(session.status);
  const serverProgress = Math.max(0, Math.min(100, Number(session?.progress ?? 0)));
  const currentStage = session?.stage;
  const currentStatus = session?.status;

  useEffect(() => {
    if (!pending || (currentStatus === "QUEUED" && serverProgress === 0)) {
      setDisplayProgress(serverProgress);
      progressAnim.setValue(serverProgress);
    }
  }, [id, pending, currentStatus, serverProgress, progressAnim]);

  useEffect(() => {
    if (!pending) return;
    setDisplayProgress((prev) => Math.max(prev, serverProgress));
  }, [pending, serverProgress]);

  useEffect(() => {
    if (!pending) return;
    Animated.timing(progressAnim, {
      toValue: displayProgress,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [pending, displayProgress, progressAnim]);

  useEffect(() => {
    if (!pending) return;
    setNowMs(Date.now());
    const ticker = setInterval(() => {
      setNowMs(Date.now());
      const ceiling = stageCeiling(currentStage, currentStatus);
      setDisplayProgress((prev) => {
        const base = Math.max(prev, serverProgress);
        return base < ceiling ? base + 1 : base;
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, [pending, currentStage, currentStatus, serverProgress]);

  useEffect(() => {
    if (!pending || reduceMotion) return;
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ])
    );
    scanLoop.start();
    return () => scanLoop.stop();
  }, [pending, reduceMotion, scanAnim]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      reload();
      return () => setFocused(false);
    }, [reload])
  );

  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      setForeground(next === "active");
      if (next === "active" && focused) reload();
    });
    return () => listener.remove();
  }, [focused, reload]);

  useEffect(() => {
    if (!path || !pending || !focused || !foreground || state.loading) return;
    const timer = setTimeout(reload, state.error ? 6000 : 1000);
    return () => clearTimeout(timer);
  }, [path, pending, focused, foreground, state.loading, state.error, reload]);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(value);
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  async function control(action: "cancel" | "retry") {
    if (!path || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api(path + "/" + action, "POST", {});
      reload();
    } catch (err) {
      setActionError((err as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  /** Req 2: Upload & validate ảnh mới rồi chạy lại ngay trên cùng mã phiên thử đồ. */
  async function replacePhotoInSession(camera: boolean) {
    if (!session || replacing || busy) return;
    setActionError("");
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        const msg = "Cần cấp quyền máy ảnh để chụp ảnh thử đồ.";
        setActionError(msg);
        showToast(msg);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.95,
      };
      const selection = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (selection.canceled || !selection.assets?.[0]) return;

      setReplacing(true);
      const picked = selection.assets[0];
      const form = new FormData();
      form.append("role", "person");
      form.append("consent", "true");
      if (Platform.OS === "web") {
        form.append(
          "file",
          picked.file || (await (await fetch(picked.uri)).blob()),
          picked.fileName || "person.png"
        );
      } else {
        form.append(
          "file",
          new File(picked.uri) as unknown as Blob,
          picked.fileName || "person.png"
        );
      }
      const uploaded = await api<{ assetId: string }>("/assets", "POST", form);

      const check = await api<{
        accepted: boolean;
        personFrame?: string;
        warnings?: string[];
        route?: { personFrame?: string; warnings?: string[] };
      }>("/ai/persons/validate", "POST", {
        assetId: uploaded.assetId,
        variantId: session.variantId,
      });

      const detectedFrame = check.personFrame || check.route?.personFrame;
      const compat = checkTryOnCompatibility({
        targetCategory: session.vtonCategory,
        frame: detectedFrame,
      });
      if (!compat.allowed) {
        setActionError(compat.reason);
        showToast(compat.reason);
        return;
      }
      if (!check.accepted) {
        const reason =
          check.route?.warnings?.[0] ||
          check.warnings?.[0] ||
          "Ảnh chưa đạt kiểm tra YOLO26. Vui lòng chọn ảnh khác rõ người hơn.";
        setActionError(reason);
        showToast(reason);
        return;
      }

      await api(
        `/try-on/sessions/${encodeURIComponent(session.sessionId)}/replace-person`,
        "POST",
        { personAssetId: uploaded.assetId, consent: true }
      );
      setImageError(false);
      setImageAttempt((n) => n + 1);
      showToast("Đã cập nhật ảnh mới — phiên thử đồ đang xử lý lại!");
      reload();
    } catch (err) {
      const msg = (err as Error).message || "Không thể đổi ảnh cho phiên thử đồ này.";
      setActionError(msg);
      showToast(msg);
    } finally {
      setReplacing(false);
    }
  }

  /** Req 5: Mở lựa chọn 2 phương án thử tiếp món phối đối ứng & chặn tổ hợp không hợp lệ. */
  function handleRecommendedTry(item: RecommendedTryOnItem) {
    if (!session) return;
    if (session.vtonCategory === "dress" || item.category === "dress") {
      showToast("Nghiêm cấm thử Đầm liền chung với Áo hoặc Quần/Chân váy.");
      return;
    }
    setChainSaveMsg("");
    setChainTarget(item);
  }

  async function handleChainWithResultImage() {
    if (!session || !chainTarget || chainBusy) return;
    const compat = checkTryOnCompatibility({
      targetCategory: chainTarget.category,
      chainedFromCategory: session.vtonCategory,
      chainedFromFrame: session.personFrame,
      shopModelId: session.shopModelId,
    });
    if (!compat.allowed) {
      setChainTarget(null);
      showToast(compat.reason);
      return;
    }

    setChainBusy(true);
    try {
      const promoted = await api<{
        personAssetId: string;
        sourceSessionId: string;
        sourceCategory: string;
        personFrame?: string;
        productGender?: string;
      }>(`/try-on/sessions/${encodeURIComponent(session.sessionId)}/promote-result`, "POST", {});
      const target = chainTarget;
      setChainTarget(null);
      router.push({
        pathname: "/try-on",
        params: {
          productId: target.productId,
          variantId: target.variantId,
          category: target.category,
          gender: promoted.productGender || session.productGender,
          mode: "photo",
          personAssetId: promoted.personAssetId,
          chainedFromSessionId: session.sessionId,
          chainedFromCategory: session.vtonCategory,
          chainedFromFrame: promoted.personFrame || session.personFrame,
        },
      });
    } catch (err) {
      const msg = (err as Error).message || "Không thể lấy ảnh kết quả sang phiên mới.";
      setChainTarget(null);
      showToast(msg);
    } finally {
      setChainBusy(false);
    }
  }

  async function handleSaveBeforeManualChain() {
    if (!resultId || chainBusy) return;
    setChainBusy(true);
    setChainSaveMsg("");
    try {
      const msg = await exportResultImage(resultId, true);
      setChainSaveMsg(msg);
      showToast(msg);
    } catch (err) {
      const msg = (err as Error).message || "Không thể lưu ảnh kết quả.";
      setChainSaveMsg(msg);
      showToast(msg);
    } finally {
      setChainBusy(false);
    }
  }

  function handleOpenManualChainSession() {
    if (!session || !chainTarget) return;
    const target = chainTarget;
    setChainTarget(null);
    router.push({
      pathname: "/try-on",
      params: {
        productId: target.productId,
        variantId: target.variantId,
        category: target.category,
        gender: session.productGender,
        mode: "photo",
      },
    });
  }

  const resultId = session && isComplete(session.status) ? session.resultAssetId : undefined;
  const personId = session?.personAssetId;
  const error = typeof session?.error === "string" ? session.error : session?.error?.message;
  const qualityFailed = error === "QUALITY_GATE_FAILED";

  const elapsedSeconds = useMemo(() => {
    if (!session?.createdAt) return 0;
    const started = Date.parse(session.createdAt);
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, Math.floor((nowMs - started) / 1000));
  }, [session?.createdAt, nowMs]);

  const fallbackPortrait =
    imageError && session?.shopModelId
      ? session.shopModelId === "male"
        ? require("../../../assets/humanModelVTON/MaleModel.png")
        : session.shopModelId === "male_upper"
        ? require("../../../assets/humanModelVTON/MaleModel_UpperBody.png")
        : session.shopModelId === "female_upper"
        ? require("../../../assets/humanModelVTON/FemaleModel_UpperBody.png")
        : require("../../../assets/humanModelVTON/FemaleModel.png")
      : undefined;

  const onImageError = useCallback((message?: string) => {
    setImageErrorDetail(message || "");
    setImageError(true);
  }, []);

  const chainOption1Compat =
    session && chainTarget
      ? checkTryOnCompatibility({
          targetCategory: chainTarget.category,
          chainedFromCategory: session.vtonCategory,
          chainedFromFrame: session.personFrame,
          shopModelId: session.shopModelId,
        })
      : { allowed: true as const };

  return (
    <View style={st.page}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: pending ? "Đang ướm thử AI" : "Kết quả thử đồ",
          headerStyle: { backgroundColor: Colors.canvas },
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontFamily: "Editorial", fontSize: 19, color: Colors.primary },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={st.headerPill}>
              <View style={st.headerDot} />
              <Text style={st.headerPillText}>VTON</Text>
            </View>
          ),
        }}
      />

      {!user && (
        <View style={st.centerPad}>
          <Button title="Đăng nhập" onPress={() => router.push("/auth")} />
        </View>
      )}
      {user && !session && (
        <View style={st.centerPad}>
          <State loading={state.loading} error={state.error} retry={reload} />
        </View>
      )}

      {session && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
          {/* Product Header Summary */}
          <View style={st.productTitleBlock}>
            <Text style={st.productEyebrow}>
              PHIÊN #{session.sessionId} · {statusLabel(session.status).toUpperCase()}
            </Text>
            <Text style={st.productTitle} numberOfLines={2}>
              {session.productName}
            </Text>
          </View>

          {/* ======================================================== */}
          {/* 1. REALTIME PROCESSING VIEW (WARM EDITORIAL MINIMALISM)  */}
          {/* ======================================================== */}
          {pending && (
            <>
              <View style={st.stageCard}>
                {fallbackPortrait ? (
                  <Image source={fallbackPortrait} style={st.fillImage} resizeMode="cover" />
                ) : personId ? (
                  <PrivateImage
                    key={personId + ":" + imageAttempt}
                    assetId={personId}
                    style={st.fillImage}
                    resizeMode="cover"
                    onError={onImageError}
                  />
                ) : (
                  <View style={[st.fillImage, st.placeholderBg]}>
                    <Ionicons name="person-outline" size={56} color={Colors.textMuted} />
                  </View>
                )}

                <View style={st.warmScrim} />
                <Animated.View
                  style={[
                    st.laserBeam,
                    {
                      transform: [
                        {
                          translateY: scanAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [18, STAGE_HEIGHT - 24],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={st.laserGlow} />
                  <View style={st.laserLine} />
                </Animated.View>

                <View style={st.hudTopLeft}>
                  <View style={st.hudDot} />
                  <Text style={st.hudText}>FABRIC SCAN</Text>
                </View>

                <View style={st.hudTopRight}>
                  <Text style={st.hudPct}>{displayProgress}%</Text>
                </View>
              </View>

              <View style={st.progressCard}>
                <View style={st.progressHeader}>
                  <Text style={st.progressStageMsg} numberOfLines={2}>
                    {session.stageMessage || stageTitleFallback(session.stage, session.status)}
                  </Text>
                  <Text style={st.progressPctLarge}>{displayProgress}%</Text>
                </View>

                <View
                  style={st.progressTrack}
                  onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                >
                  {trackWidth > 0 && (
                    <Animated.View
                      style={[
                        st.progressFill,
                        {
                          width: trackWidth,
                          transform: [
                            {
                              translateX: progressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: [-trackWidth, 0],
                                extrapolate: "clamp",
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                </View>

                <View style={st.progressMetaRow}>
                  <Text style={st.progressMetaText}>Thời gian xử lý: {elapsedSeconds}s</Text>
                  <Text style={st.progressMetaCode}>{session.stage || session.status}</Text>
                </View>

                <View style={st.milestoneList}>
                  {STAGE_STEPS.map((step, idx) => {
                    const nextMin = STAGE_STEPS[idx + 1]?.minProgress ?? 101;
                    const activeStageIdx = stageStepIndex(session.stage);
                    const done = activeStageIdx > idx || serverProgress >= nextMin;
                    const active = !done && (activeStageIdx === idx || serverProgress >= step.minProgress);
                    return (
                      <View key={step.key} style={st.milestoneRow}>
                        {done ? (
                          <Ionicons name="checkmark-circle" size={16} color={Colors.statusSuccess} />
                        ) : active ? (
                          <View style={st.milestoneActiveDot} />
                        ) : (
                          <View style={st.milestonePendingDot} />
                        )}
                        <Text
                          style={[
                            st.milestoneLabel,
                            done && st.milestoneDone,
                            active && st.milestoneActive,
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={st.reassuranceCard}>
                <Ionicons name="sparkles-outline" size={16} color={Colors.champagneDeep} />
                <Text style={st.reassuranceText}>
                  Công nghệ giữ nguyên nếp vải và ánh sáng thực. Bạn có thể rời màn này và mở lại trong Tủ đồ VTON.
                </Text>
              </View>

              <View style={st.actionGroup}>
                <Button title="Về Tủ đồ VTON" secondary onPress={() => router.push("/(shop)/wardrobe")} />
                {session.status === "QUEUED" && session.jobId && (
                  <Button title="Hủy yêu cầu" outline disabled={busy} onPress={() => void control("cancel")} />
                )}
              </View>
            </>
          )}

          {/* ======================================================== */}
          {/* 2. COMPLETED RESULT VIEW (MODE SWITCHER + BEFORE/AFTER)  */}
          {/* ======================================================== */}
          {!pending && resultId && (
            <>
              <BeforeAfterStage
                resultId={resultId}
                personId={personId}
                fallbackPortrait={fallbackPortrait}
                imageAttempt={imageAttempt}
                stageHeight={STAGE_HEIGHT}
                onImageError={onImageError}
                onOpenZoom={() => setZoomOpen(true)}
                onOpenPass={() => setPassOpen(true)}
              />

              {imageError && !fallbackPortrait && (
                <View style={{ gap: 8 }}>
                  <Notice error>Không tải được ảnh kết quả. {imageErrorDetail}</Notice>
                  <Button
                    secondary
                    title="Tải lại ảnh"
                    onPress={() => {
                      setImageError(false);
                      setImageAttempt((n) => n + 1);
                    }}
                  />
                </View>
              )}

              <ResultActions assetId={resultId} />

              {!session.simulated && !imageError && (
                <OutfitScoring
                  sessionId={id || session.sessionId}
                  variantId={session.variantId}
                  category={session.vtonCategory}
                  shopModelId={session.shopModelId}
                  initialScore={session.score}
                  initialAdvice={session.advice}
                  initialProportion={session.proportionScore}
                  initialColor={session.colorScore}
                  initialPattern={session.patternScore}
                  initialPenalty={session.penaltyScore}
                  initialTier={session.tier}
                  initialTierLabel={session.tierLabel}
                  initialProportionRule={session.proportionRule}
                  initialProportionNote={session.proportionNote}
                  singleItemPreview={session.singleItemPreview}
                  onScoreUpdated={setLiveScore}
                  onTry={handleRecommendedTry}
                  onSingleBuy={() =>
                    void (async () => {
                      try {
                        await api("/cart/items", "PUT", { variantId: session.variantId, quantity: 1 });
                        Alert.alert("Đã thêm", `${session.productName} đã vào túi đồ của bạn.`);
                      } catch (e) {
                        Alert.alert("Lỗi", (e as Error).message);
                      }
                    })()
                  }
                  onComboBuy={(secondVariantId) =>
                    void (async () => {
                      try {
                        await api("/cart/items", "PUT", { variantId: session.variantId, quantity: 1 });
                        if (secondVariantId && secondVariantId !== session.variantId) {
                          await api("/cart/items", "PUT", { variantId: secondVariantId, quantity: 1 });
                          Alert.alert("Đã thêm combo", "Đã thêm cả 2 món phối vào túi đồ với ưu đãi -5%.");
                        } else {
                          Alert.alert(
                            "Đã thêm",
                            `${session.productName} đã vào túi đồ. Hãy chọn thêm món phối để tạo combo.`
                          );
                        }
                      } catch (e) {
                        Alert.alert("Lỗi", (e as Error).message);
                      }
                    })()
                  }
                />
              )}

              {/* Req 4: Luxury Boarding-Pass QR Fitting Pass */}
              <FittingPassModal
                visible={passOpen}
                onClose={() => setPassOpen(false)}
                session={session}
                liveScore={liveScore}
              />

              {/* Req 5: 2-Option Chained Try-On Sheet */}
              <Sheet
                visible={!!chainTarget}
                onClose={() => !chainBusy && setChainTarget(null)}
                title="Thử tiếp món phối đề xuất"
              >
                {chainTarget && (
                  <View style={st.chainSheetBody}>
                    <View style={st.chainHeaderPill}>
                      <Ionicons name="sparkles-outline" size={16} color={Colors.champagneDeep} />
                      <Text style={st.chainHeaderText} numberOfLines={2}>
                        Món phối tiếp theo: <Text style={{ fontFamily: "JakartaSemiBold" }}>{chainTarget.name}</Text>
                      </Text>
                    </View>

                    {/* Option 1: Carry VTON Result Directly */}
                    <View style={st.chainOptionCard}>
                      <View style={st.chainOptionTitleRow}>
                        <View style={st.chainBadgePrimary}>
                          <Text style={st.chainBadgePrimaryText}>PHƯƠNG ÁN 1</Text>
                        </View>
                        <Text style={st.chainOptionHeading}>Dùng ngay ảnh kết quả VTON này</Text>
                      </View>
                      <Text style={st.chainOptionDesc}>
                        Hệ thống tự động mang ảnh kết quả vừa thử sang phiên mới để ướm thử tiếp{" "}
                        {chainTarget.name} (bạn vẫn có thể đổi ảnh khác bất cứ lúc nào).
                      </Text>
                      <Button
                        title={
                          chainBusy
                            ? "Đang chuẩn bị ảnh kết quả..."
                            : "Lấy ảnh kết quả sang thử tiếp"
                        }
                        icon={<Ionicons name="layers-outline" size={16} color={Colors.champagne} />}
                        disabled={chainBusy}
                        style={!chainOption1Compat.allowed ? { opacity: 0.65 } : undefined}
                        onPress={() => void handleChainWithResultImage()}
                      />
                    </View>

                    {/* Option 2: Download Result & Upload Manually */}
                    <View style={st.chainOptionCard}>
                      <View style={st.chainOptionTitleRow}>
                        <View style={st.chainBadgeSecondary}>
                          <Text style={st.chainBadgeSecondaryText}>PHƯƠNG ÁN 2</Text>
                        </View>
                        <Text style={st.chainOptionHeading}>Tải ảnh về & tự tải lên ở phiên mới</Text>
                      </View>
                      <Text style={st.chainOptionDesc}>
                        Lưu ảnh kết quả về máy (phiên hiện tại vẫn giữ nguyên không bị tắt), sau đó mở phiên mới để bạn tự chọn ảnh tải lên.
                      </Text>
                      <Button
                        title={chainBusy ? "Đang lưu ảnh..." : "1. Lưu ảnh kết quả về máy"}
                        secondary
                        icon={<Ionicons name="download-outline" size={16} color={Colors.primary} />}
                        disabled={chainBusy}
                        onPress={() => void handleSaveBeforeManualChain()}
                      />
                      {!!chainSaveMsg && <Notice>{chainSaveMsg}</Notice>}
                      <Button
                        title="2. Mở phiên mới để tự tải ảnh lên"
                        outline
                        icon={<Ionicons name="cloud-upload-outline" size={16} color={Colors.primary} />}
                        disabled={chainBusy}
                        onPress={handleOpenManualChainSession}
                      />
                    </View>
                  </View>
                )}
              </Sheet>

              <Modal visible={zoomOpen} transparent animationType="fade" onRequestClose={() => setZoomOpen(false)}>
                <View style={st.zoomOverlay}>
                  <Pressable style={st.zoomCloseBtn} onPress={() => setZoomOpen(false)}>
                    <Ionicons name="close" size={22} color={Colors.primary} />
                  </Pressable>
                  <PrivateImage
                    assetId={resultId}
                    style={{ width: SCREEN_WIDTH - 24, height: SCREEN_WIDTH * 1.35 }}
                    resizeMode="contain"
                  />
                </View>
              </Modal>
            </>
          )}

          {/* ======================================================== */}
          {/* 3. ERROR OR FAILED STATE + REQ 2 IN-PLACE PHOTO REUPLOAD */}
          {/* ======================================================== */}
          {!pending && !resultId && (
            <View style={{ gap: 12 }}>
              {(actionError || state.error || error) && (
                <Notice error>
                  {actionError ||
                    state.error ||
                    (qualityFailed
                      ? "Ảnh thử chưa đạt kiểm tra chất lượng. Bạn có thể đổi ảnh mới ngay tại phiên này."
                      : error)}
                </Notice>
              )}

              {/* Req 2: Re-upload a new photo in the exact same session without creating a new PhienThuDoAo */}
              <View style={st.replaceCard}>
                <View style={st.replaceHeader}>
                  <Ionicons name="refresh-circle-outline" size={20} color={Colors.champagneDeep} />
                  <Text style={st.replaceTitle}>Đổi ảnh mới ngay trong phiên #{session.sessionId}</Text>
                </View>
                <Text style={st.replaceSub}>
                  Không cần tạo phiên thử đồ mới. Chọn lại ảnh rõ người, đủ sáng để hệ thống kiểm tra YOLO26 và thử lại trực tiếp.
                </Text>
                <View style={st.replaceBtnRow}>
                  <Pressable
                    disabled={replacing || busy}
                    onPress={() => void replacePhotoInSession(false)}
                    style={[st.replacePickBtn, (replacing || busy) && { opacity: 0.5 }]}
                  >
                    <Ionicons name="images-outline" size={17} color={Colors.primary} />
                    <Text style={st.replacePickText}>
                      {replacing ? "Đang tải..." : "Chọn ảnh thư viện"}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={replacing || busy}
                    onPress={() => void replacePhotoInSession(true)}
                    style={[st.replacePickBtn, (replacing || busy) && { opacity: 0.5 }]}
                  >
                    <Ionicons name="camera-outline" size={17} color={Colors.primary} />
                    <Text style={st.replacePickText}>Chụp ảnh mới</Text>
                  </Pressable>
                </View>
              </View>

              {((session.status === "FAILED" && session.retryable && !!session.jobId) ||
                session.status === "SYNC_FAILED") && (
                <Button title="Thử lại với ảnh hiện tại" disabled={busy || replacing} onPress={() => void control("retry")} />
              )}
              <Button
                title="Đổi trang phục hoặc tạo phiên mới"
                secondary
                disabled={busy || replacing}
                onPress={() =>
                  router.push({
                    pathname: "/try-on",
                    params: {
                      productId: session.productId,
                      variantId: session.variantId,
                      category: session.vtonCategory,
                      gender: session.productGender,
                      shopModelId: session.shopModelId,
                      seed: qualityFailed ? String(Math.floor(Math.random() * 999999999)) : undefined,
                      personAssetId: session.shopModelId ? undefined : session.personAssetId,
                    },
                  })
                }
              />
              <Button title="Về Tủ đồ VTON" outline onPress={() => router.push("/(shop)/wardrobe")} />
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Blocking / Feedback Toast */}
      {!!toast && (
        <View style={st.toastPopup} pointerEvents="none">
          <Ionicons name="alert-circle" size={18} color="#FDE68A" />
          <Text style={st.toastPopupText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  centerPad: {
    padding: 20,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.champagneDeep,
  },
  headerPillText: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.champagneDeep,
    letterSpacing: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 16,
  },
  productTitleBlock: {
    gap: 3,
  },
  productEyebrow: {
    fontFamily: "Mono",
    fontSize: 11,
    color: Colors.champagneDeep,
    letterSpacing: 0.5,
  },
  productTitle: {
    fontFamily: "Editorial",
    fontSize: 22,
    color: Colors.primary,
    lineHeight: 28,
  },
  stageCard: {
    height: STAGE_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.md,
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    backgroundColor: Colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  warmScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(250, 250, 249, 0.14)",
  },
  laserBeam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  laserGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: "rgba(197, 168, 128, 0.3)",
  },
  laserLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.champagne,
  },
  hudTopLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
  },
  hudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.champagneDeep,
  },
  hudText: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  hudTopRight: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  hudPct: {
    fontFamily: "Mono",
    fontSize: 11,
    color: Colors.champagneDeep,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    gap: 12,
    ...Shadows.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  progressStageMsg: {
    flex: 1,
    fontFamily: "JakartaSemiBold",
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  progressPctLarge: {
    fontFamily: "Mono",
    fontSize: 20,
    color: Colors.champagneDeep,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.champagne,
    borderRadius: 4,
  },
  progressMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressMetaText: {
    fontFamily: "Mono",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  progressMetaCode: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.textMuted,
  },
  milestoneList: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderHairline,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  milestoneActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 3,
    backgroundColor: Colors.champagne,
  },
  milestonePendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: Colors.borderHairline,
  },
  milestoneLabel: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 13,
    color: Colors.textMuted,
  },
  milestoneDone: {
    color: Colors.textSecondary,
  },
  milestoneActive: {
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  reassuranceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.champagneSubtle,
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
  },
  reassuranceText: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 18,
  },
  actionGroup: {
    gap: 8,
  },
  replaceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.55)",
    gap: 10,
    ...Shadows.sm,
  },
  replaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replaceTitle: {
    flex: 1,
    fontFamily: "Editorial",
    fontSize: 16,
    color: Colors.primary,
  },
  replaceSub: {
    fontFamily: "Jakarta",
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  replaceBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  replacePickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  replacePickText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: Colors.primary,
  },
  chainSheetBody: {
    gap: 14,
    paddingBottom: 16,
  },
  chainHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
  },
  chainHeaderText: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  chainOptionCard: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    gap: 8,
  },
  chainOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  chainBadgePrimary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  chainBadgePrimaryText: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: Colors.champagne,
    letterSpacing: 0.5,
  },
  chainBadgeSecondary: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  chainBadgeSecondaryText: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  chainOptionHeading: {
    fontFamily: "JakartaSemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  chainOptionDesc: {
    fontFamily: "Jakarta",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCloseBtn: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  toastPopup: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    zIndex: 999,
    ...Shadows.toast,
  },
  toastPopupText: {
    flex: 1,
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
    lineHeight: 17,
  },
});
