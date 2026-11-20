import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { PrivateImage } from "./PrivateImage";

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

const MODES: { key: CompareMode; label: string }[] = [
  { key: "after", label: "Sau · AI" },
  { key: "before", label: "Trước" },
  { key: "side", label: "Cạnh nhau" },
  { key: "split", label: "Kéo so sánh" },
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
  const [mode, setMode] = useState<CompareMode>("after");
  const [stageWidth, setStageWidth] = useState(320);

  // Use Animated.Value for 60fps drag without re-rendering parent screen or images
  const ratioRef = useRef(0.5);
  const startRatioRef = useRef(0.5);
  const widthRef = useRef(320);
  const ratioAnim = useRef(new Animated.Value(0.5)).current;

  const setRatio = (next: number) => {
    const clamped = Math.max(0.05, Math.min(0.95, next));
    ratioRef.current = clamped;
    ratioAnim.setValue(clamped);
  };

  // Dedicated PanResponder on the handle uses gestureState.dx -> never jumps to 0 on touch
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startRatioRef.current = ratioRef.current;
        },
        onPanResponderMove: (_, gs) => {
          const w = Math.max(1, widthRef.current);
          setRatio(startRatioRef.current + gs.dx / w);
        },
      }),
    []
  );

  // Horizontal swipe anywhere on split stage also moves smoothly without blocking vertical scroll
  const stagePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          startRatioRef.current = ratioRef.current;
        },
        onPanResponderMove: (_, gs) => {
          const w = Math.max(1, widthRef.current);
          setRatio(startRatioRef.current + gs.dx / w);
        },
      }),
    []
  );

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

  const clipWidth = ratioAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, stageWidth],
  });
  const dividerLeft = ratioAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-1, stageWidth - 1],
  });

  return (
    <View style={st.wrapper}>
      {/* Mode Switcher Bar — keeps images separate unless user picks split compare */}
      <View style={st.modeBar} accessibilityRole="tablist">
        {MODES.map((item) => {
          const active = mode === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setMode(item.key);
                if (item.key === "split") setRatio(0.5);
              }}
              style={[st.modePill, active && st.modePillActive]}
            >
              <Text style={[st.modeText, active && st.modeTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[st.stageCard, { height: stageHeight }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          widthRef.current = w;
          setStageWidth(w);
        }}
      >
        {mode === "after" && (
          <View style={st.opaqueCanvas}>
            {renderAfterImage(st.fillImage)}
            <View style={st.badgeAfter}>
              <Text style={st.badgeAfterTxt}>SAU · AI</Text>
            </View>
          </View>
        )}

        {mode === "before" && (
          <View style={st.opaqueCanvas}>
            {renderBeforeImage(st.fillImage)}
            <View style={st.badgeBefore}>
              <Text style={st.badgeBeforeTxt}>TRƯỚC</Text>
            </View>
          </View>
        )}

        {mode === "side" && (
          <View style={st.sideBySideRow}>
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
          </View>
        )}

        {mode === "split" && (
          <View style={st.opaqueCanvas} {...stagePan.panHandlers}>
            {/* Base layer: After AI on solid white canvas */}
            <View style={st.opaqueLayer}>{renderAfterImage(st.fillImage)}</View>

            {/* Clipped top layer: Before on solid white canvas (prevents transparent PNG bleed-through) */}
            <Animated.View style={[st.clipWrap, { width: clipWidth }]}>
              <View style={[st.opaqueLayer, { width: stageWidth }]}>
                {renderBeforeImage([st.fillImage, { width: stageWidth }])}
              </View>
            </Animated.View>

            <View style={st.badgeBefore}>
              <Text style={st.badgeBeforeTxt}>TRƯỚC</Text>
            </View>
            <View style={st.badgeAfterSplit}>
              <Text style={st.badgeAfterTxt}>SAU · AI</Text>
            </View>

            <Animated.View style={[st.sliderDivider, { left: dividerLeft }]}>
              <View style={st.sliderHitArea} {...handlePan.panHandlers}>
                <View style={st.sliderHandle}>
                  <Text style={st.sliderHandleText}>‹ ›</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        )}

        <View style={st.sideActions}>
          <Pressable
            style={st.sideBtn}
            onPress={onOpenZoom}
            accessibilityLabel="Phóng to ảnh"
          >
            <Ionicons name="expand-outline" size={18} color={Colors.primary} />
          </Pressable>

          <Pressable
            style={st.sideBtn}
            onPress={onOpenPass}
            accessibilityLabel="Mã QR vé thử đồ"
          >
            <Ionicons name="qr-code-outline" size={18} color={Colors.primary} />
          </Pressable>
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
