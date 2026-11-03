import { memo, useCallback, type ReactNode } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radii } from "@/constants/theme";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";

export interface ShopHeaderProps {
  /** Tiêu đề thương hiệu dạng chữ (mặc định: 'YoFaSo') */
  title?: string;
  /** Huy hiệu nhỏ cạnh tiêu đề (ví dụ: 'Danh mục thiết kế', 'Tủ đồ AI VTON', 'Tài khoản hội viên') */
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
  /** Trạng thái có thông báo chưa đọc, nếu undefined component sẽ tự fetch */
  unreadNotif?: boolean;
  /** Các nút hành động bổ sung bên phải (ví dụ icon cài đặt) */
  rightActions?: ReactNode;
  /** Nội dung con phía dưới header (ô tìm kiếm, bộ lọc, tab phân loại...) */
  children?: ReactNode;
  /** Tùy biến style container của header */
  style?: StyleProp<ViewStyle>;
  /** Ẩn đường kẻ viền dưới header */
  hideBorder?: boolean;
}

export const ShopHeader = memo(function ShopHeader({
  title = "YoFaSo",
  badgeText,
  subtitle,
  showLogo = false,
  showNotification = true,
  showCart = true,
  cartCount: externalCartCount,
  unreadNotif: externalUnreadNotif,
  rightActions,
  children,
  style,
  hideBorder = false,
}: ShopHeaderProps) {
  const insets = useSafeAreaInsets();

  const { user } = useSession();

  // Tự động fetch nếu cha không truyền props để đảm bảo tính độc lập & tái sử dụng (chỉ fetch khi đã đăng nhập)
  const needsInternalCart = showCart && externalCartCount === undefined && !!user;
  const needsInternalNotif = showNotification && externalUnreadNotif === undefined && !!user;

  const cartState = useResource<Row[]>(needsInternalCart ? "/cart" : null);
  const notifState = useResource<Row[]>(
    needsInternalNotif ? "/notifications?size=10" : null
  );

  // Tự động reload giỏ hàng và thông báo mỗi khi màn hình/tab được active (focus)
  useFocusEffect(
    useCallback(() => {
      if (needsInternalCart) {
        cartState.reload();
      }
      if (needsInternalNotif) {
        notifState.reload();
      }
    }, [needsInternalCart, needsInternalNotif, cartState.reload, notifState.reload])
  );

  const cartCount =
    externalCartCount !== undefined
      ? externalCartCount
      : (user && cartState.data ? cartState.data.reduce((s, r) => s + Number(r.quantity || 1), 0) : 0);

  const unreadNotif =
    externalUnreadNotif !== undefined
      ? externalUnreadNotif
      : (user && notifState.data ? notifState.data.some((n) => !n.readStatus) : false);

  const topPadding = Math.max(insets.top, Platform.OS === "ios" ? 44 : 35);

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

          {badgeText ? (
            <View style={st.badgePill}>
              <Text style={st.badgePillText}>{badgeText}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={st.headerActions}>
          {showNotification && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thông báo"
              onPress={() => router.push("/inbox")}
              style={st.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              {unreadNotif && <View style={st.unreadDot} />}
            </Pressable>
          )}

          {showCart && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Túi đồ"
              onPress={() => router.push("/cart")}
              style={st.iconBtn}
            >
              <Ionicons name="bag-handle-outline" size={20} color={Colors.primary} />
              {cartCount > 0 && (
                <View style={st.cartBadge}>
                  <Text style={st.cartBadgeText}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              )}
            </Pressable>
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
  badgePill: {
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
  },
  badgePillText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    fontWeight: "700",
    letterSpacing: 0.3,
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
    fontFamily: "JakartaBold",
    lineHeight: 11,
  },
  subtitleText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});
