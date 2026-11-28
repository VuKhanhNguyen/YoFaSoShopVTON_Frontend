import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  Vibration,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type * as VisionCameraTypes from "react-native-vision-camera";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import { Colors, Radii, Shadows } from "@/constants/theme";
import {
  EMPTY_GESTURE_HOLD,
  PALM_COUNTDOWN_SECONDS,
  VICTORY_LOWER_HAND_MS,
  stepGestureHold,
  type CaptureTrigger,
  type GestureCameraPhase,
  type GestureHoldState,
} from "@/lib/hand-gesture-state";
import {
  isHandGestureNativeAvailable,
  packFrameRgbaToBase64,
  recognizeRgbaFrame,
  resetGestureSession,
} from "@/lib/mediapipe-hand-gesture";

type VisionCameraModule = typeof VisionCameraTypes;

let cachedVisionCamera: VisionCameraModule | null | undefined;

function getVisionCameraModule(): VisionCameraModule | null {
  if (cachedVisionCamera !== undefined) return cachedVisionCamera;
  try {
    // Tránh crash ngay khi mở màn hình nếu bản APK đang cài chưa có native NitroModules
    if (TurboModuleRegistry.get("NitroModules") == null) {
      cachedVisionCamera = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedVisionCamera = require("react-native-vision-camera") as VisionCameraModule;
    return cachedVisionCamera;
  } catch {
    cachedVisionCamera = null;
    return null;
  }
}

export interface CapturedVtonPhoto {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
  trigger: CaptureTrigger;
}

export interface LiveVtonCameraModalProps {
  visible: boolean;
  category?: string;
  guideText?: string;
  onClose: () => void;
  onCapture: (photo: CapturedVtonPhoto) => void;
  onFallbackSystemCamera?: () => void;
}

export function LiveVtonCameraModal(props: LiveVtonCameraModalProps) {
  const visionCamera = props.visible ? getVisionCameraModule() : null;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      {props.visible ? (
        visionCamera ? (
          <LiveVtonCameraSession {...props} visionCamera={visionCamera} />
        ) : (
          <LiveVtonCameraUnavailable
            onClose={props.onClose}
            onFallbackSystemCamera={props.onFallbackSystemCamera}
          />
        )
      ) : null}
    </Modal>
  );
}

function LiveVtonCameraUnavailable({
  onClose,
  onFallbackSystemCamera,
}: Pick<LiveVtonCameraModalProps, "onClose" | "onFallbackSystemCamera">) {
  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={st.permissionContainer}>
        <View style={st.permissionIconCircle}>
          <Ionicons name="construct-outline" size={32} color={Colors.champagne} />
        </View>
        <Text style={st.permissionTitle}>Cần cập nhật bản APK mới</Text>
        <Text style={st.permissionDesc}>
          Bản APK đang cài trên máy chưa tích hợp module Live Camera & MediaPipe (NitroModules). Hãy cài lại tệp app-debug.apk mới nhất để dùng nhận diện cử chỉ tay ✌️ / 🖐️, hoặc tạm dùng máy ảnh hệ thống.
        </Text>
        <View style={st.permissionBtnStack}>
          {onFallbackSystemCamera && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dùng máy ảnh hệ thống"
              onPress={() => {
                onClose();
                onFallbackSystemCamera();
              }}
              style={st.primaryGoldBtn}
            >
              <Text style={st.primaryGoldBtnText}>Mở máy ảnh hệ thống ngay</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            onPress={onClose}
            style={st.ghostCancelBtn}
          >
            <Text style={st.ghostCancelBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function LiveVtonCameraSession({
  visionCamera,
  category,
  guideText,
  onClose,
  onCapture,
  onFallbackSystemCamera,
}: LiveVtonCameraModalProps & { visionCamera: VisionCameraModule }) {
  const { hasPermission, canRequestPermission, requestPermission } =
    visionCamera.useCameraPermission();

  const [cameraPos, setCameraPos] = useState<"front" | "back">("front");
  const [flashOn, setFlashOn] = useState(false);
  const [phase, setPhase] = useState<GestureCameraPhase>("IDLE");
  const [holdState, setHoldState] = useState<GestureHoldState>(EMPTY_GESTURE_HOLD);
  const [countdown, setCountdown] = useState<number>(PALM_COUNTDOWN_SECONDS);
  const [camError, setCamError] = useState("");

  const device = visionCamera.useCameraDevice(cameraPos);
  const gestureSupported = isHandGestureNativeAvailable();
  const isFullBodyRequired = category === "lower_body" || category === "dress";

  // Atomic cross-runtime flags shared with VisionCamera's background frame thread
  const scanGateSync = useMemo(() => createSynchronizable(1), []);
  const busyInferSync = useMemo(() => createSynchronizable(0), []);

  const mountedRef = useRef(true);
  const phaseRef = useRef<GestureCameraPhase>("IDLE");
  const holdRef = useRef<GestureHoldState>(EMPTY_GESTURE_HOLD);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturingLockRef = useRef(false);

  const clearScheduledTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      scanGateSync.setBlocking(0);
      clearScheduledTimers();
      void resetGestureSession();
    };
  }, [clearScheduledTimers, scanGateSync]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      void requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const photoOutput = visionCamera.usePhotoOutput({
    targetResolution: visionCamera.CommonResolutions.FHD_4_3,
    containerFormat: "jpeg",
    quality: 0.92,
    qualityPrioritization: "balanced",
  });

  const executeShutter = useCallback(
    async (trigger: CaptureTrigger) => {
      if (capturingLockRef.current || !mountedRef.current) return;
      capturingLockRef.current = true;
      scanGateSync.setBlocking(0);
      clearScheduledTimers();
      phaseRef.current = "CAPTURING";
      setPhase("CAPTURING");
      setCamError("");

      try {
        const useFlash = cameraPos === "back" && Boolean(device?.hasFlash) && flashOn;
        const photoFile = await photoOutput.capturePhotoToFile(
          {
            flashMode: useFlash ? "on" : "off",
            enableShutterSound: true,
          },
          {}
        );

        if (!mountedRef.current) return;
        const normalizedUri = photoFile.filePath.startsWith("file://")
          ? photoFile.filePath
          : `file://${photoFile.filePath}`;

        onCapture({
          uri: normalizedUri,
          width: photoFile.width,
          height: photoFile.height,
          fileName: `vton-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          trigger,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        capturingLockRef.current = false;
        phaseRef.current = "IDLE";
        setPhase("IDLE");
        holdRef.current = EMPTY_GESTURE_HOLD;
        setHoldState(EMPTY_GESTURE_HOLD);
        scanGateSync.setBlocking(1);
        setCamError(
          (err as Error)?.message || "Không thể chụp ảnh. Vui lòng thử lại hoặc dùng nút chụp."
        );
      }
    },
    [cameraPos, clearScheduledTimers, device, flashOn, onCapture, photoOutput, scanGateSync]
  );

  const cancelActiveSequence = useCallback(() => {
    clearScheduledTimers();
    capturingLockRef.current = false;
    phaseRef.current = "IDLE";
    setPhase("IDLE");
    holdRef.current = EMPTY_GESTURE_HOLD;
    setHoldState(EMPTY_GESTURE_HOLD);
    setCountdown(PALM_COUNTDOWN_SECONDS);
    scanGateSync.setBlocking(1);
  }, [clearScheduledTimers, scanGateSync]);

  const startVictoryCaptureSequence = useCallback(() => {
    scanGateSync.setBlocking(0);
    clearScheduledTimers();
    phaseRef.current = "VICTORY_LOWER_HAND";
    setPhase("VICTORY_LOWER_HAND");
    setHoldState(EMPTY_GESTURE_HOLD);
    if (Platform.OS === "android") Vibration.vibrate(45);

    const timer = setTimeout(() => {
      void executeShutter("VICTORY");
    }, VICTORY_LOWER_HAND_MS);
    timersRef.current.push(timer);
  }, [clearScheduledTimers, executeShutter, scanGateSync]);

  const startPalmCountdownSequence = useCallback(() => {
    scanGateSync.setBlocking(0);
    clearScheduledTimers();
    phaseRef.current = "PALM_COUNTDOWN";
    setPhase("PALM_COUNTDOWN");
    setHoldState(EMPTY_GESTURE_HOLD);
    setCountdown(PALM_COUNTDOWN_SECONDS);
    if (Platform.OS === "android") Vibration.vibrate([0, 40, 60, 40]);

    let remaining = PALM_COUNTDOWN_SECONDS;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (!mountedRef.current) return;
      if (remaining > 0) {
        setCountdown(remaining);
        if (Platform.OS === "android") Vibration.vibrate(25);
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        void executeShutter("OPEN_PALM");
      }
    }, 1000);
  }, [clearScheduledTimers, executeShutter, scanGateSync]);

  const handleFramePackedOnJS = useCallback(
    (
      base64Rgba: string,
      width: number,
      height: number,
      orientation: string,
      mirrored: boolean
    ) => {
      if (!mountedRef.current || phaseRef.current !== "IDLE") {
        busyInferSync.setBlocking(0);
        return;
      }

      void recognizeRgbaFrame(base64Rgba, width, height, orientation, mirrored)
        .then((res) => {
          if (!mountedRef.current || phaseRef.current !== "IDLE") return;
          if (res.skipped) return;

          const nowMs = Date.now();
          const { next, triggered } = stepGestureHold(
            holdRef.current,
            res.gesture,
            Number(res.score ?? 0),
            nowMs
          );
          holdRef.current = next;
          setHoldState(next);

          if (triggered === "Victory") {
            startVictoryCaptureSequence();
          } else if (triggered === "Open_Palm") {
            startPalmCountdownSequence();
          }
        })
        .catch(() => {
          // ignore transient frame error
        })
        .finally(() => {
          busyInferSync.setBlocking(0);
        });
    },
    [busyInferSync, startPalmCountdownSequence, startVictoryCaptureSequence]
  );

  const frameOutput = visionCamera.useFrameOutput({
    targetResolution: { width: 320, height: 240 },
    pixelFormat: "rgb",
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    allowDeferredStart: true,
    onFrameDropped: () => {
      // Dropped frames are expected when throttling or capturing
    },
    onFrame(frame) {
      "worklet";
      try {
        if (!gestureSupported) return;
        if (scanGateSync.getDirty() === 0 || busyInferSync.getDirty() === 1) return;

        const g = globalThis as { __yfsLastSampleMs?: number };
        const now = Date.now();
        if (g.__yfsLastSampleMs && now - g.__yfsLastSampleMs < 34) {
          return;
        }
        if (!frame.isValid || !frame.hasPixelBuffer) return;

        // Dùng trực tiếp ByteBuffer từ plane[0] để tránh lỗi ArrayBuffer(HardwareBuffer) yêu cầu NDK minSdk >= 26
        const planes = frame.getPlanes();
        const plane0 = planes.length > 0 ? planes[0] : null;
        const pixelBuffer = plane0 ? plane0.getPixelBuffer() : frame.getPixelBuffer();
        const rowStride = plane0 ? (plane0.bytesPerRow | 0) : (frame.bytesPerRow | 0);

        const packed = packFrameRgbaToBase64(
          pixelBuffer,
          frame.width | 0,
          frame.height | 0,
          rowStride,
          frame.pixelFormat === "rgb-bgra-8-bit",
          192
        );
        if (!packed) return;

        g.__yfsLastSampleMs = now;
        busyInferSync.setBlocking(1);
        try {
          scheduleOnRN(
            handleFramePackedOnJS,
            packed.base64,
            packed.width,
            packed.height,
            frame.orientation,
            frame.isMirrored
          );
        } catch (err) {
          busyInferSync.setBlocking(0);
          throw err;
        }
      } finally {
        frame.dispose();
      }
    },
  });

  const handleToggleCamera = () => {
    if (phase !== "IDLE") return;
    holdRef.current = EMPTY_GESTURE_HOLD;
    setHoldState(EMPTY_GESTURE_HOLD);
    setFlashOn(false);
    void resetGestureSession();
    setCameraPos((prev) => (prev === "front" ? "back" : "front"));
  };

  const outputs = useMemo(
    () => (gestureSupported ? [photoOutput, frameOutput] : [photoOutput]),
    [gestureSupported, photoOutput, frameOutput]
  );

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camera Viewfinder */}
      {!hasPermission ? (
        <View style={st.permissionContainer}>
          <View style={st.permissionIconCircle}>
            <Ionicons name="camera-outline" size={34} color={Colors.champagne} />
          </View>
          <Text style={st.permissionTitle}>Cấp quyền Máy ảnh Thông minh</Text>
          <Text style={st.permissionDesc}>
            YoFaSo sử dụng camera trực tiếp kèm AI MediaPipe nhận diện cử chỉ tay (✌️ / 🖐️) ngay trên thiết bị, không gửi luồng video lên mạng.
          </Text>
          <View style={st.permissionBtnStack}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cấp quyền máy ảnh"
              onPress={() => {
                if (canRequestPermission) {
                  void requestPermission();
                } else {
                  void Linking.openSettings();
                }
              }}
              style={st.primaryGoldBtn}
            >
              <Text style={st.primaryGoldBtnText}>
                {canRequestPermission ? "Cho phép truy cập Máy ảnh" : "Mở Cài đặt cấp quyền"}
              </Text>
            </Pressable>
            {onFallbackSystemCamera && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dùng máy ảnh hệ thống"
                onPress={() => {
                  onClose();
                  onFallbackSystemCamera();
                }}
                style={st.secondaryDarkBtn}
              >
                <Text style={st.secondaryDarkBtnText}>Dùng máy ảnh hệ thống</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              style={st.ghostCancelBtn}
            >
              <Text style={st.ghostCancelBtnText}>Quay lại</Text>
            </Pressable>
          </View>
        </View>
      ) : !device ? (
        <View style={st.permissionContainer}>
          <ActivityIndicator size="large" color={Colors.champagne} />
          <Text style={st.permissionTitle}>Đang kết nối ống kính máy ảnh...</Text>
          {onFallbackSystemCamera && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onFallbackSystemCamera();
              }}
              style={[st.secondaryDarkBtn, { marginTop: 14 }]}
            >
              <Text style={st.secondaryDarkBtnText}>Chuyển sang máy ảnh hệ thống</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <visionCamera.Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={outputs}
          isActive={true}
          resizeMode="cover"
          enableNativeTapToFocusGesture={true}
          onError={(err) => setCamError(err.message)}
        />
      )}

      {/* Top Glass HUD Bar */}
      <View style={st.topHud}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng máy ảnh"
          hitSlop={8}
          onPress={onClose}
          style={st.hudIconBtn}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={st.aiBadgePill}>
          <View
            style={[
              st.aiLiveDot,
              { backgroundColor: gestureSupported ? "#22C55E" : Colors.champagne },
            ]}
          />
          <Text style={st.aiBadgeText}>
            {gestureSupported ? "MEDIAPIPE AI · 30 FPS" : "LIVE VTON CAMERA"}
          </Text>
        </View>

        <View style={st.topRightActions}>
          {cameraPos === "back" && device?.hasFlash ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={flashOn ? "Tắt đèn flash" : "Bật đèn flash"}
              hitSlop={6}
              onPress={() => setFlashOn((v) => !v)}
              style={[st.hudIconBtn, flashOn && st.hudIconBtnActive]}
            >
              <Ionicons
                name={flashOn ? "flash" : "flash-off-outline"}
                size={19}
                color={flashOn ? Colors.primary : "#FFFFFF"}
              />
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </View>

      {/* Framing Silhouette Brackets & Countdown Center Stage */}
      {hasPermission && device && (
        <View style={st.frameGuideStage} pointerEvents="box-none">
          <View style={st.frameGuideBox} pointerEvents="none">
            <View style={[st.cornerBracket, st.cornerTL]} />
            <View style={[st.cornerBracket, st.cornerTR]} />
            <View style={[st.cornerBracket, st.cornerBL]} />
            <View style={[st.cornerBracket, st.cornerBR]} />

            <View style={st.frameTagPill}>
              <Ionicons name="body-outline" size={12} color={Colors.champagne} />
              <Text style={st.frameTagText}>
                {isFullBodyRequired
                  ? "Căn trọn toàn thân từ đầu tới mắt cá chân"
                  : guideText || "Đứng chính diện, đủ sáng, hai tay tách nhẹ khỏi thân"}
              </Text>
            </View>
          </View>

          {/* Center Giant Countdown for Open_Palm (5 fingers 🖐️) */}
          {phase === "PALM_COUNTDOWN" && (
            <View style={st.centerCountdownOverlay}>
              <View style={st.countdownCircle}>
                <Text style={st.countdownNumber}>{countdown}</Text>
              </View>
              <Text style={st.countdownHeading}>Đã nhận diện 🖐️ — Tạo dáng ngay!</Text>
              <Text style={st.countdownSub}>
                Hạ tay tự nhiên và giữ tư thế đứng thẳng
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hủy đếm ngược"
                onPress={cancelActiveSequence}
                style={st.cancelCountdownBtn}
              >
                <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                <Text style={st.cancelCountdownText}>Hủy đếm ngược</Text>
              </Pressable>
            </View>
          )}

          {/* Victory (2 fingers ✌️) 1.25s Lower-Hand Prompt */}
          {phase === "VICTORY_LOWER_HAND" && (
            <View style={st.centerCountdownOverlay}>
              <View style={st.victoryBadgeCircle}>
                <Text style={st.victoryEmoji}>✌️</Text>
              </View>
              <Text style={st.countdownHeading}>Đã nhận diện ✌️ — hạ tay xuống!</Text>
              <Text style={st.countdownSub}>
                Thả tay xuôi xuống ngay để không che ngực áo khi chụp...
              </Text>
            </View>
          )}

          {/* High-res Shutter Capturing Overlay */}
          {phase === "CAPTURING" && (
            <View style={st.centerCountdownOverlay}>
              <ActivityIndicator size="large" color={Colors.champagne} />
              <Text style={st.countdownHeading}>Đang chụp & chuẩn bị thử đồ AI...</Text>
            </View>
          )}
        </View>
      )}

      {/* Bottom Gesture Guide + Shutter Dock */}
      {hasPermission && device && (
        <View style={st.bottomDock}>
          {!!camError && (
            <View style={st.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color="#FCA5A5" />
              <Text style={st.errorBannerText} numberOfLines={2}>
                {camError}
              </Text>
            </View>
          )}

          {/* Hold-time Debounce Progress Bar OR Gesture Tips */}
          {phase === "IDLE" && gestureSupported && (
            <View style={st.gestureCard}>
              {holdState.gesture ? (
                <View style={{ gap: 7 }}>
                  <View style={st.holdHeaderRow}>
                    <Text style={st.holdTitleText}>
                      {holdState.gesture === "Victory"
                        ? "✌️ Giữ yên 2 ngón để chụp nhanh..."
                        : "🖐️ Giữ yên 5 ngón để hẹn giờ 3s..."}
                    </Text>
                    <Text style={st.holdPctText}>
                      {Math.round(holdState.holdProgress * 100)}%
                    </Text>
                  </View>
                  <View style={st.holdTrack}>
                    <View
                      style={[
                        st.holdFill,
                        { width: `${Math.round(holdState.holdProgress * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <View style={st.gestureLegendRow}>
                  <View style={st.gestureLegendItem}>
                    <Text style={st.gestureIcon}>✌️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.gestureLegendTitle}>Giơ 2 ngón</Text>
                      <Text style={st.gestureLegendSub}>Chụp & chạy VTON luôn</Text>
                    </View>
                  </View>
                  <View style={st.gestureDivider} />
                  <View style={st.gestureLegendItem}>
                    <Text style={st.gestureIcon}>🖐️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.gestureLegendTitle}>Xòe 5 ngón</Text>
                      <Text style={st.gestureLegendSub}>Đếm ngược 3 → 1 tạo dáng</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Shutter & Camera Controls Row */}
          <View style={st.controlsRow}>
            {onFallbackSystemCamera ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở máy ảnh hệ thống"
                disabled={phase === "CAPTURING"}
                onPress={() => {
                  onClose();
                  onFallbackSystemCamera();
                }}
                style={st.sideControlBtn}
              >
                <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                <Text style={st.sideControlLabel}>Hệ thống</Text>
              </Pressable>
            ) : (
              <View style={st.sideControlPlaceholder} />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh thủ công"
              disabled={phase === "CAPTURING"}
              onPress={() => void executeShutter("MANUAL")}
              style={({ pressed }) => [
                st.shutterOuterRing,
                pressed && { transform: [{ scale: 0.94 }] },
                phase === "CAPTURING" && { opacity: 0.5 },
              ]}
            >
              <View style={st.shutterInnerDisc} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi camera trước hoặc sau"
              disabled={phase !== "IDLE"}
              onPress={handleToggleCamera}
              style={[st.sideControlBtn, phase !== "IDLE" && { opacity: 0.45 }]}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
              <Text style={st.sideControlLabel}>
                {cameraPos === "front" ? "Cam trước" : "Cam sau"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#090D16",
    justifyContent: "space-between",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(197, 168, 128, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  permissionTitle: {
    fontFamily: "Editorial",
    fontSize: 22,
    color: "#FFFFFF",
    textAlign: "center",
  },
  permissionDesc: {
    fontFamily: "Jakarta",
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.75)",
    textAlign: "center",
  },
  permissionBtnStack: {
    width: "100%",
    gap: 10,
    marginTop: 10,
  },
  primaryGoldBtn: {
    height: 48,
    borderRadius: Radii.lg,
    backgroundColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryGoldBtnText: {
    fontFamily: "JakartaBold",
    fontSize: 14,
    color: Colors.primary,
  },
  secondaryDarkBtn: {
    height: 46,
    borderRadius: Radii.lg,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryDarkBtnText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  ghostCancelBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostCancelBtnText: {
    fontFamily: "Jakarta",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.68)",
  },
  topHud: {
    paddingTop: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight || 28) + 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  hudIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudIconBtnActive: {
    backgroundColor: Colors.champagne,
    borderColor: Colors.champagne,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
  },
  aiLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  aiBadgeText: {
    fontFamily: "Mono",
    fontSize: 10.5,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  frameGuideStage: {
    flex: 1,
    marginHorizontal: 22,
    marginVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  frameGuideBox: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 12,
  },
  cornerBracket: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "rgba(197, 168, 128, 0.78)",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 14,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 14,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 14,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 14,
  },
  frameTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    maxWidth: "92%",
  },
  frameTagText: {
    fontFamily: "Jakarta",
    fontSize: 11.5,
    color: "rgba(255, 255, 255, 0.9)",
    flexShrink: 1,
  },
  centerCountdownOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: Radii.xl,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.5)",
    gap: 8,
    maxWidth: 320,
    ...Shadows.md,
  },
  countdownCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(197, 168, 128, 0.2)",
    borderWidth: 2,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  countdownNumber: {
    fontFamily: "Editorial",
    fontSize: 48,
    color: "#FFFFFF",
    lineHeight: 54,
  },
  victoryBadgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1.5,
    borderColor: "#4ADE80",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  victoryEmoji: {
    fontSize: 34,
  },
  countdownHeading: {
    fontFamily: "JakartaBold",
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
  },
  countdownSub: {
    fontFamily: "Jakarta",
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255, 255, 255, 0.82)",
    textAlign: "center",
  },
  cancelCountdownBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  cancelCountdownText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  bottomDock: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 26,
    paddingTop: 10,
    gap: 14,
    backgroundColor: "rgba(9, 13, 22, 0.72)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: "rgba(127, 29, 29, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
  },
  errorBannerText: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 12,
    color: "#FEE2E2",
  },
  gestureCard: {
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.32)",
  },
  gestureLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gestureLegendItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gestureIcon: {
    fontSize: 20,
  },
  gestureLegendTitle: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  gestureLegendSub: {
    fontFamily: "Jakarta",
    fontSize: 10.5,
    color: "rgba(255, 255, 255, 0.72)",
  },
  gestureDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  holdHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  holdTitleText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: Colors.champagne,
  },
  holdPctText: {
    fontFamily: "Mono",
    fontSize: 11.5,
    color: "#FFFFFF",
  },
  holdTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
  },
  holdFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.champagne,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  sideControlBtn: {
    minWidth: 74,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  sideControlPlaceholder: {
    width: 74,
  },
  sideControlLabel: {
    fontFamily: "Jakarta",
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.82)",
  },
  shutterOuterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  shutterInnerDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
});
