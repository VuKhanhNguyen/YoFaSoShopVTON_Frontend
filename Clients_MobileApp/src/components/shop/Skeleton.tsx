import {
  createContext,
  memo,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  AppState,
  Dimensions,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image as ExpoImage, type ImageContentFit, type ImageStyle } from "expo-image";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const SKELETON_BASE = "#EAE7E1";

const SkeletonClockContext = createContext<SharedValue<number> | null>(null);

/**
 * Single shared UI-thread shimmer clock for every SkeletonBox in the app.
 * Automatically pauses when app goes to background or Reduce Motion is enabled.
 */
export function SkeletonClockProvider({ children }: { children: ReactNode }) {
  const pulse = useSharedValue(0.75);
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reducedMotion || !appActive) {
      cancelAnimation(pulse);
      pulse.value = 0.72;
      return;
    }

    pulse.value = 0.45;
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 950, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 950, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(pulse);
    };
  }, [reducedMotion, appActive, pulse]);

  return (
    <SkeletonClockContext.Provider value={pulse}>
      {children}
    </SkeletonClockContext.Provider>
  );
}

export interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  staticOnly?: boolean;
}

export const SkeletonBox = memo(function SkeletonBox({
  width,
  height,
  borderRadius = Radii.md,
  style,
  staticOnly = false,
}: SkeletonBoxProps) {
  const clock = useContext(SkeletonClockContext);
  const fallback = useSharedValue(0.75);
  const activeClock = clock ?? fallback;

  const animStyle = useAnimatedStyle(() => ({
    opacity: staticOnly ? 0.72 : interpolate(activeClock.value, [0.45, 0.95], [0.45, 0.95]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        st.skeletonBase,
        width !== undefined ? { width } : undefined,
        height !== undefined ? { height } : undefined,
        { borderRadius },
        style,
        animStyle,
      ]}
    />
  );
});

export interface SmartImageProps {
  source?: string | number | { uri?: string | null } | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  borderRadius?: number;
  priority?: "low" | "normal" | "high";
  showPlaceholderIcon?: boolean;
  iconSize?: number;
  accessibilityLabel?: string;
}

/**
 * Product & media image with built-in Skeleton shimmer while loading
 * and clean Skeleton placeholder when URL is missing/broken (no misleading fake fallback image).
 */
export const SmartImage = memo(function SmartImage({
  source,
  style,
  containerStyle,
  contentFit = "cover",
  borderRadius,
  priority = "normal",
  showPlaceholderIcon = true,
  iconSize = 24,
  accessibilityLabel,
}: SmartImageProps) {
  const normalized =
    typeof source === "number"
      ? source
      : typeof source === "string"
      ? source.trim()
        ? { uri: source.trim() }
        : null
      : source && typeof source === "object" && source.uri?.trim()
      ? { uri: source.uri.trim() }
      : null;

  const sourceKey =
    typeof normalized === "number"
      ? `asset:${normalized}`
      : normalized?.uri ?? "";

  const [state, setState] = useState<{ key: string; loaded: boolean; failed: boolean }>({
    key: sourceKey,
    loaded: typeof normalized === "number",
    failed: false,
  });

  const isCurrent = state.key === sourceKey;
  const loaded = isCurrent ? state.loaded : typeof normalized === "number";
  const failed = isCurrent ? state.failed : false;
  const hasImage = Boolean(normalized) && !failed;

  return (
    <View
      style={[
        st.smartWrap,
        borderRadius !== undefined ? { borderRadius } : undefined,
        style as StyleProp<ViewStyle>,
        containerStyle,
      ]}
    >
      {(!loaded || !hasImage) && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkeletonBox
            style={StyleSheet.absoluteFill}
            borderRadius={borderRadius ?? 0}
            staticOnly={!hasImage}
          />
          {!hasImage && showPlaceholderIcon && (
            <View style={st.fallbackIconWrap}>
              <Ionicons name="shirt-outline" size={iconSize} color={Colors.textMuted} />
            </View>
          )}
        </View>
      )}

      {hasImage && normalized && (
        <ExpoImage
          source={normalized}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={220}
          cachePolicy="memory-disk"
          priority={priority}
          accessibilityLabel={accessibilityLabel}
          onLoad={() => setState({ key: sourceKey, loaded: true, failed: false })}
          onError={() => setState({ key: sourceKey, loaded: false, failed: true })}
        />
      )}
    </View>
  );
});

export const ProductCardSkeleton = memo(function ProductCardSkeleton({
  index = 0,
  stagger = true,
  width = DEFAULT_CARD_WIDTH,
}: {
  index?: number;
  stagger?: boolean;
  width?: number;
}) {
  const isRightCol = index % 2 === 1;
  return (
    <View style={[st.cardSkelWrap, { width }, stagger && isRightCol && st.staggerMargin]}>
      <SkeletonBox width={width} height={width * 1.35} borderRadius={Radii.lg} />
      <View style={st.cardSkelInfo}>
        <SkeletonBox width="92%" height={13} borderRadius={6} />
        <SkeletonBox width="64%" height={13} borderRadius={6} />
        <View style={st.cardSkelRow}>
          <SkeletonBox width={46} height={10} borderRadius={5} />
          <SkeletonBox width={54} height={10} borderRadius={5} />
        </View>
        <View style={st.cardSkelSwatches}>
          <SkeletonBox width={10} height={10} borderRadius={5} />
          <SkeletonBox width={10} height={10} borderRadius={5} />
          <SkeletonBox width={10} height={10} borderRadius={5} />
        </View>
        <SkeletonBox width="52%" height={15} borderRadius={6} style={{ marginTop: 2 }} />
      </View>
    </View>
  );
});

export const ProductGridSkeleton = memo(function ProductGridSkeleton({
  count = 4,
  stagger = true,
  width = DEFAULT_CARD_WIDTH,
}: {
  count?: number;
  stagger?: boolean;
  width?: number;
}) {
  return (
    <View style={st.twoColGrid} accessibilityLabel="Đang tải sản phẩm">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} index={idx} stagger={stagger} width={width} />
      ))}
    </View>
  );
});

export const EditorialRepSkeleton = memo(function EditorialRepSkeleton() {
  return (
    <View style={st.repGrid} accessibilityLabel="Đang tải sản phẩm tiêu biểu">
      {[0, 1, 2].map((idx) => (
        <View key={idx} style={st.repCard}>
          <SkeletonBox width="100%" height={110} borderRadius={0} />
          <View style={st.repCardBody}>
            <SkeletonBox width="85%" height={10} borderRadius={4} />
            <SkeletonBox width="55%" height={10} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
});

export const ListCardSkeleton = memo(function ListCardSkeleton({
  count = 3,
  variant = "rows",
}: {
  count?: number;
  variant?: "cards" | "rows" | "grid";
}) {
  if (variant === "grid") {
    return (
      <View style={st.wardrobeGrid} accessibilityLabel="Đang tải danh sách">
        {Array.from({ length: count }).map((_, idx) => (
          <View key={idx} style={st.wardrobeSkelCard}>
            <SkeletonBox width="100%" height={200} borderRadius={0} />
            <View style={{ padding: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <SkeletonBox width="48%" height={10} borderRadius={4} />
                <SkeletonBox width={34} height={14} borderRadius={5} />
              </View>
              <SkeletonBox width="82%" height={12} borderRadius={5} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === "cards") {
    return (
      <View style={{ gap: 14 }} accessibilityLabel="Đang tải dữ liệu">
        {Array.from({ length: count }).map((_, idx) => (
          <View key={idx} style={st.orderSkelCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <SkeletonBox width={36} height={36} borderRadius={18} />
                <View style={{ gap: 5 }}>
                  <SkeletonBox width={96} height={12} borderRadius={5} />
                  <SkeletonBox width={72} height={10} borderRadius={4} />
                </View>
              </View>
              <SkeletonBox width={74} height={22} borderRadius={Radii.full} />
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <SkeletonBox width={52} height={64} borderRadius={Radii.sm} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="84%" height={12} borderRadius={5} />
                <SkeletonBox width="55%" height={10} borderRadius={4} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }} accessibilityLabel="Đang tải dữ liệu">
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={st.rowSkelCard}>
          <SkeletonBox width={56} height={68} borderRadius={Radii.md} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox width="82%" height={13} borderRadius={5} />
            <SkeletonBox width="56%" height={11} borderRadius={5} />
            <SkeletonBox width="38%" height={12} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
});

export const ProductDetailSkeleton = memo(function ProductDetailSkeleton() {
  return (
    <View style={st.detailSkelContainer} accessibilityLabel="Đang tải chi tiết sản phẩm">
      <SkeletonBox width={SCREEN_WIDTH} height={SCREEN_WIDTH * 1.25} borderRadius={0} />
      <View style={st.detailSkelBody}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <SkeletonBox width={110} height={22} borderRadius={Radii.sm} />
          <SkeletonBox width={92} height={18} borderRadius={Radii.sm} />
        </View>
        <SkeletonBox width="88%" height={24} borderRadius={7} />
        <SkeletonBox width="62%" height={14} borderRadius={5} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <SkeletonBox width={128} height={26} borderRadius={6} />
          <SkeletonBox width={44} height={20} borderRadius={4} />
        </View>
        <SkeletonBox width="100%" height={60} borderRadius={Radii.lg} style={{ marginTop: 6 }} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} width={36} height={36} borderRadius={18} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} width={54} height={42} borderRadius={Radii.md} />
          ))}
        </View>
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  skeletonBase: {
    backgroundColor: SKELETON_BASE,
  },
  smartWrap: {
    overflow: "hidden",
    backgroundColor: SKELETON_BASE,
    position: "relative",
  },
  fallbackIconWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  twoColGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardSkelWrap: {
    marginBottom: 14,
  },
  staggerMargin: {
    marginTop: 18,
  },
  cardSkelInfo: {
    marginTop: 8,
    gap: 5,
  },
  cardSkelRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  cardSkelSwatches: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  repGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  repCard: {
    flex: 1,
    backgroundColor: "#FAFAF9",
    borderRadius: Radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  repCardBody: {
    padding: 6,
    gap: 4,
  },
  wardrobeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  wardrobeSkelCard: {
    width: "48.2%",
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  orderSkelCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 14,
    gap: 12,
  },
  rowSkelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 12,
  },
  detailSkelContainer: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  detailSkelBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
});
