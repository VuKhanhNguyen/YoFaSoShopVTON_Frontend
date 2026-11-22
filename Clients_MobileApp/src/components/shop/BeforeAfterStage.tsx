import { useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { PrivateImage } from "./PrivateImage";
import { SPRING_SNAPPY, ScalePressable, SlidingTabs } from "./MotionPrimitives";

type CompareMode = "after" | "before" | "split" | "side";

type Props = {
  resultId: string;
  personId?: string;
  fallbackPortrait?: ImageSourcePropType;
  imageAttempt: number;
  stageHeight: number;
  onImageError: (message?: string) => void;
  onOpenZoom: () => void;
  onOpenPass: () => void;
};

const MODE_OPTIONS = [
  { id: "after" as const, label: "Sau · AI" },
  { id: "before" as const, label: "Trước" },
  { id: "side" as const, label: "Cạnh nhau" },
  { id: "split" as const, label: "Kéo so sánh" },
];

export function BeforeAfterStage({
  resultId,
  personId,
  fallbackPortrait,
  imageAttempt,
  stageHeight,
  onImageError,
  onOpenZoom,
  onOpenPass,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<CompareMode>("after");
  const [stageWidth, setStageWidth] = useState(320);

  // 100% UI-thread Reanimated + RNGH drag (pure GPU translateX clipping, zero layout reflow)
  const ratio = useSharedValue(0.5);
  const startRatio = useSharedValue(0.5);
  const stageW = useSharedValue(320);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          startRatio.set(ratio.get());
        })
        .onUpdate((e) => {
          const w = Math.max(1, stageW.get());
          const next = startRatio.get() + e.translationX / w;
          ratio.set(Math.max(0.05, Math.min(0.95, next)));
        }),
    [ratio, startRatio, stageW]
  );

  const handleGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startRatio.set(ratio.get());
        })
        .onUpdate((e) => {
          const w = Math.max(1, stageW.get());
          const next = startRatio.get() + e.translationX / w;
          ratio.set(Math.max(0.05, Math.min(0.95, next)));
        }),
    [ratio, startRatio, stageW]
  );

  const clipOuterStyle = useAnimatedStyle(() => {
    const shift = -(1 - ratio.value) * stageW.value;
    return {
      transform: [{ translateX: shift }],
    };
  });

  const clipInnerStyle = useAnimatedStyle(() => {
    const shift = (1 - ratio.value) * stageW.value;
    return {
      transform: [{ translateX: shift }],
    };
  });

  const dividerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ratio.value * stageW.value - 1 }],
  }));

  const renderBeforeImage = (style: object) =>
    fallbackPortrait ? (
      <Image source={fallbackPortrait} style={style} resizeMode="contain" />
    ) : personId ? (
      <PrivateImage
        key={personId + ":" + imageAttempt}
        assetId={personId}
        style={style}
        resizeMode="contain"
        accessibilityLabel="Ảnh gốc trước khi thử"
      />
    ) : null;

  const renderAfterImage = (style: object) => (
    <PrivateImage
      key={resultId + ":" + imageAttempt}
      assetId={resultId}
      style={style}
      resizeMode="contain"
      accessibilityLabel="Ảnh kết quả thử đồ AI"
      onError={onImageError}
    />
  );

  return (
    <View style={st.wrapper}>
      {/* Mode Switcher Bar — GPU sliding pill */}
      <SlidingTabs
        options={MODE_OPTIONS}
        value={mode}
        onChange={(next) => {
          setMode(next);
          if (next === "split") {
            ratio.set(reducedMotion ? 0.5 : withSpring(0.5, SPRING_SNAPPY));
          }
        }}
        variant="surface"
        textStyle={st.modeText}
      />

      <View
        style={[st.stageCard, { height: stageHeight }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            stageW.set(w);
            setStageWidth(w);
          }
        }}
      >
        {mode === "after" && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            style={st.opaqueCanvas}
          >
            {renderAfterImage(st.fillImage)}
            <View style={st.badgeAfter}>
              <Text style={st.badgeAfterTxt}>SAU · AI</Text>
            </View>
          </Animated.View>
        )}

        {mode === "before" && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            style={st.opaqueCanvas}
          >
            {renderBeforeImage(st.fillImage)}
            <View style={st.badgeBefore}>
              <Text style={st.badgeBeforeTxt}>TRƯỚC</Text>
            </View>
          </Animated.View>
        )}

        {mode === "side" && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            style={st.sideBySideRow}
          >
            <View style={st.sideCol}>
              {renderBeforeImage(st.fillImage)}
              <View style={st.sideLabelWrap}>
                <Text style={st.badgeBeforeTxt}>TRƯỚC</Text>
              </View>
            </View>
            <View style={st.sideDivider} />
            <View style={st.sideCol}>
              {renderAfterImage(st.fillImage)}
              <View style={[st.sideLabelWrap, st.sideLabelAfter]}>
                <Text style={st.badgeAfterTxt}>SAU · AI</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {mode === "split" && (
          <GestureDetector gesture={panGesture}>
            <View style={st.opaqueCanvas}>
              {/* Base layer: After AI on solid white canvas */}
              <View style={st.opaqueLayer}>{renderAfterImage(st.fillImage)}</View>

              {/* GPU-clipped top layer using inverse translateX (zero width layout thrash) */}
              <Animated.View style={[st.clipWrap, { width: stageWidth }, clipOuterStyle]}>
                <Animated.View style={[st.opaqueLayer, { width: stageWidth }, clipInnerStyle]}>
                  {renderBeforeImage([st.fillImage, { width: stageWidth }])}
                </Animated.View>
              </Animated.View>

              <View style={st.badgeBefore}>
                <Text style={st.badgeBeforeTxt}>TRƯỚC</Text>
              </View>
              <View style={st.badgeAfterSplit}>
                <Text style={st.badgeAfterTxt}>SAU · AI</Text>
              </View>

              <Animated.View style={[st.sliderDivider, dividerStyle]}>
                <GestureDetector gesture={handleGesture}>
                  <View style={st.sliderHitArea}>
                    <View style={st.sliderHandle}>
                      <Text style={st.sliderHandleText}>‹ ›</Text>
                    </View>
                  </View>
                </GestureDetector>
              </Animated.View>
            </View>
          </GestureDetector>
        )}

        <View style={st.sideActions}>
          <ScalePressable
            style={st.sideBtn}
            activeScale={0.9}
            hitSlop={4}
            onPress={onOpenZoom}
            accessibilityLabel="Phóng to ảnh"
          >
            <Ionicons name="expand-outline" size={18} color={Colors.primary} />
          </ScalePressable>

          <ScalePressable
            style={st.sideBtn}
            activeScale={0.9}
            hitSlop={4}
            onPress={onOpenPass}
            accessibilityLabel="Mã QR vé thử đồ"
          >
            <Ionicons name="qr-code-outline" size={18} color={Colors.primary} />
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  modeBar: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    gap: 4,
  },
  modePill: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  modePillActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  modeText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  modeTextActive: {
    color: Colors.primary,
  },
  stageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.xl,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.md,
  },
  opaqueCanvas: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  opaqueLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  clipWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  sideBySideRow: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
  },
  sideCol: {
    flex: 1,
    height: "100%",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  sideDivider: {
    width: 1,
    height: "100%",
    backgroundColor: Colors.borderHairline,
  },
  sideLabelWrap: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  sideLabelAfter: {
    backgroundColor: Colors.champagneSubtle,
    borderColor: Colors.champagne,
  },
  badgeBefore: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  badgeBeforeTxt: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.primary,
  },
  badgeAfter: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  badgeAfterSplit: {
    position: "absolute",
    top: 14,
    left: 82,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  badgeAfterTxt: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.champagneDeep,
  },
  sliderDivider: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  sliderHitArea: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderHandle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  sliderHandleText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  sideActions: {
    position: "absolute",
    top: 14,
    right: 14,
    gap: 8,
    zIndex: 25,
  },
  sideBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
});
