import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  Image,
  Platform,
  StatusBar as RNStatusBar,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";
import { useResource } from "@/hooks/use-resource";
import { useNotifications } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";
import {
  BounceTypingBadge,
  SPRING_SNAPPY,
  ScalePressable,
} from "./MotionPrimitives";

export interface ShopHeaderProps {
  /** Tiêu đề thương hiệu dạng chữ (mặc định: 'YoFaSo') */
  title?: string;
  /** Huy hiệu nhỏ cạnh tiêu đề (ví dụ: 'Your Fashion, Your Own Soul') */
  badgeText?: string;
  /** Dòng phụ chú thích ngắn phía dưới tiêu đề */
  subtitle?: string;
  /** Hiển thị logo thương hiệu thay vì tiêu đề text */
  showLogo?: boolean;
  /** Hiển thị nút chuông thông báo (mặc định: true) */
  showNotification?: boolean;
  /** Hiển thị nút giỏ hàng (mặc định: true) */
  showCart?: boolean;
  /** Số lượng giỏ hàng truyền từ ngoài vào nếu cha đã query, nếu undefined component sẽ tự fetch */
  cartCount?: number;
  /** Trạng thái hoặc số lượng thông báo chưa đọc, nếu undefined component sẽ đọc live từ NotificationProvider */
  unreadNotif?: boolean;
  /** Số đếm thông báo chưa đọc truyền từ ngoài (tùy chọn) */
  unreadNotifCount?: number;
  /** Các nút hành động bổ sung bên phải (ví dụ icon cài đặt) */
  rightActions?: ReactNode;
  /** Nội dung con phía dưới header (ô tìm kiếm, bộ lọc, tab phân loại...) */
  children?: ReactNode;
  /** Tùy biến style container của header */
  style?: StyleProp<ViewStyle>;
  /** Ẩn đường kẻ viền dưới header */
  hideBorder?: boolean;
}

const NotificationActionButton = memo(function NotificationActionButton({
  count,
  unread,
  onPress,
}: {
  count: number;
  unread: boolean;
  onPress: () => void;
}) {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const prevCountRef = useRef(count);

  const bellRotation = useSharedValue(0);
  const badgeScale = useSharedValue(unread || count > 0 ? 1 : 0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const hasUnread = count > 0 || unread;
    const prev = prevCountRef.current;
    prevCountRef.current = count;

    if (!hasUnread || !isFocused || !appActive || reducedMotion) {
      cancelAnimation(bellRotation);
      bellRotation.value = 0;
      badgeScale.value = hasUnread ? 1 : 0;
      return;
    }

    if (count > prev || hasUnread) {
      bellRotation.value = withSequence(
        withDelay(120, withTiming(-14, { duration: 85, easing: Easing.out(Easing.quad) })),
        withTiming(12, { duration: 95, easing: Easing.inOut(Easing.quad) }),
        withTiming(-6, { duration: 85, easing: Easing.inOut(Easing.quad) }),
        withTiming(3, { duration: 75, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 75, easing: Easing.out(Easing.quad) })
      );
      badgeScale.value = withSequence(
        withTiming(0.7, { duration: 60 }),
        withSpring(1.18, { damping: 10, stiffness: 320 }),
        withSpring(1, SPRING_SNAPPY)
      );
    }

    return () => {
      cancelAnimation(bellRotation);
    };
  }, [count, unread, isFocused, appActive, reducedMotion, bellRotation, badgeScale]);

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotation.value}deg` }],
  }));

  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeScale.value > 0.05 ? 1 : 0,
    transform: [{ scale: badgeScale.value }],
  }));

  const showBadge = count > 0;
  const showDotOnly = !showBadge && unread;

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo"}
      hitSlop={6}
      activeScale={0.9}
      onPress={onPress}
      style={st.iconBtn}
    >
      <Animated.View style={bellAnimStyle}>
        <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
      </Animated.View>
      {showBadge && (
        <Animated.View style={[st.notifBadge, badgeAnimStyle]}>
          <Text style={st.notifBadgeText}>{count > 99 ? "99+" : count}</Text>
        </Animated.View>
      )}
      {showDotOnly && <View style={st.unreadDot} />}
    </ScalePressable>
  );
});

export const CartActionButton = memo(function CartActionButton({
  count,
  onPress,
  buttonStyle,
  iconSize = 20,
}: {
  count: number;
  onPress: () => void;
  buttonStyle?: StyleProp<ViewStyle>;
  iconSize?: number;
}) {
  const reducedMotion = useReducedMotion();
  const prevCountRef = useRef(count);

  const bagLift = useSharedValue(0);
  const bagScale = useSharedValue(1);
  const badgeScale = useSharedValue(count > 0 ? 1 : 0);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;

    if (reducedMotion) {
      bagLift.value = 0;
      bagScale.value = 1;
      badgeScale.value = count > 0 ? 1 : 0;
      return;
    }

    if (count > 0) {
      if (count !== prev) {
        bagLift.value = withSequence(
          withTiming(-3, { duration: 100, easing: Easing.out(Easing.quad) }),
          withSpring(0, SPRING_SNAPPY)
        );
        bagScale.value = withSequence(
          withTiming(1.12, { duration: 100, easing: Easing.out(Easing.quad) }),
          withSpring(1, SPRING_SNAPPY)
        );
        badgeScale.value = withSequence(
          withTiming(0.65, { duration: 60 }),
          withSpring(1.18, { damping: 10, stiffness: 320 }),
          withSpring(1, SPRING_SNAPPY)
        );
      } else {
        badgeScale.value = withSpring(1, SPRING_SNAPPY);
      }
    } else {
      badgeScale.value = withTiming(0, { duration: 120 });
    }
  }, [count, reducedMotion, bagLift, bagScale, badgeScale]);

  const bagAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bagLift.value }, { scale: bagScale.value }],
  }));

  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeScale.value > 0.05 ? 1 : 0,
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel="Túi đồ"
      hitSlop={6}
      activeScale={0.9}
      onPress={onPress}
      style={[st.iconBtn, buttonStyle]}
    >
      <Animated.View style={bagAnimStyle}>
        <Ionicons name="bag-handle-outline" size={iconSize} color={Colors.primary} />
      </Animated.View>
      {count > 0 && (
        <Animated.View style={[st.cartBadge, badgeAnimStyle]}>
          <Text style={st.cartBadgeText}>{count > 99 ? "99+" : count}</Text>
        </Animated.View>
      )}
    </ScalePressable>
  );
});

export const ShopHeader = memo(function ShopHeader({
  title = "YoFaSo",
  badgeText,
  subtitle,
  showLogo = false,
  showNotification = true,
  showCart = true,
  cartCount: externalCartCount,
  unreadNotif: externalUnreadNotif,
  unreadNotifCount: externalUnreadNotifCount,
  rightActions,
  children,
  style,
  hideBorder = false,
}: ShopHeaderProps) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { unreadCount: liveUnreadCount } = useNotifications();

  const needsInternalCart = showCart && externalCartCount === undefined && !!user;
  const cartState = useResource<Row[]>(needsInternalCart ? "/cart" : null);

  useFocusEffect(
    useCallback(() => {
      if (needsInternalCart) {
        cartState.reload();
      }
    }, [needsInternalCart, cartState.reload])
  );

  const cartCount =
    externalCartCount !== undefined
      ? externalCartCount
      : user && cartState.data
      ? cartState.data.reduce((s, r) => s + Number(r.quantity || 1), 0)
      : 0;

  const resolvedNotifCount =
    externalUnreadNotifCount !== undefined
      ? externalUnreadNotifCount
      : user
      ? liveUnreadCount
      : 0;

  const unreadNotif =
    externalUnreadNotif !== undefined
      ? externalUnreadNotif
      : resolvedNotifCount > 0;

  const actualStatusHeight =
    insets.top > 0
      ? insets.top
      : Platform.OS === "android"
      ? RNStatusBar.currentHeight ?? 24
      : 20;

  const topPadding = actualStatusHeight + 4;

  const handleOpenInbox = useCallback(() => {
    router.push("/inbox");
  }, []);

  const handleOpenCart = useCallback(() => {
    router.push("/cart");
  }, []);

  return (
    <View
      style={[
        st.header,
        { paddingTop: topPadding },
        hideBorder && st.noBorder,
        style,
      ]}
    >
      <View style={[st.headerTop, !children && !subtitle && st.headerTopNoChildren]}>
        {/* Brand Block */}
        <View style={st.brandBlock}>
          {showLogo ? (
            <Image
              source={require("@/assets/brand/logo.png")}
              style={st.brandLogo}
              resizeMode="contain"
            />
          ) : (
            <Text style={st.brandTitle}>{title}</Text>
          )}

          {badgeText ? <BounceTypingBadge text={badgeText} /> : null}
        </View>

        {/* Action Buttons */}
        <View style={st.headerActions}>
          {showNotification && (
            <NotificationActionButton
              count={resolvedNotifCount}
              unread={unreadNotif}
              onPress={handleOpenInbox}
            />
          )}

          {showCart && (
            <CartActionButton count={cartCount} onPress={handleOpenCart} />
          )}

          {rightActions}
        </View>
      </View>

      {subtitle ? <Text style={st.subtitleText}>{subtitle}</Text> : null}

      {children}
    </View>
  );
});

const st = StyleSheet.create({
  header: {
    backgroundColor: "#FAFAF9",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderHairline,
    zIndex: 10,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTopNoChildren: {
    marginBottom: 4,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  brandLogo: {
    width: 70,
    height: 70,
    resizeMode: "contain",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FAFAF9",
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "JakartaSemiBold",
    lineHeight: 11,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "JakartaSemiBold",
    lineHeight: 11,
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});
