import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/session";
import { useResource } from "@/hooks/use-resource";
import { api, publicUrl } from "@/lib/api";
import type { Row, User } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { Button, colors } from "@/components/shop/ui";

export default function AccountScreen() {
  const { user, setUser, signOut } = useSession();
  const ordersState = useResource<Row[]>(user ? "/orders" : null);

  const [toast, setToast] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const showSoon = () => {
    setToast("Tính năng sẽ sớm ra mắt");
    setTimeout(() => setToast(""), 1800);
  };

  const getInitials = (name?: string) => {
    if (!name) return "KH";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handlePickAvatar = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    const pickFromGallery = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          setToast("Cần cấp quyền thư viện để chọn ảnh đại diện.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          await uploadAvatarFile(result.assets[0].uri);
        }
      } catch (e: any) {
        setToast(e.message || "Không thể chọn ảnh.");
      }
    };

    const takePhoto = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          setToast("Cần cấp quyền máy ảnh để chụp ảnh đại diện.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          await uploadAvatarFile(result.assets[0].uri);
        }
      } catch (e: any) {
        setToast(e.message || "Không thể chụp ảnh.");
      }
    };

    if (Platform.OS === "web") {
      await pickFromGallery();
    } else {
      Alert.alert(
        "Thay đổi ảnh đại diện",
        "Chọn phương thức tải ảnh đại diện ",
        [
          { text: "Chụp ảnh mới", onPress: takePhoto },
          { text: "Chọn từ thư viện ảnh", onPress: pickFromGallery },
          { text: "Hủy", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  };

  const uploadAvatarFile = async (uri: string) => {
    setUploadingAvatar(true);
    setToast("Đang tải ảnh đại diện lên R2...");
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append("file", blob, "avatar.png");
      } else {
        form.append("file", {
          uri,
          type: "image/jpeg",
          name: "avatar.jpg",
        } as any);
      }

      const updatedUser = await api<User>("/me/avatar", "POST", form);
      if (updatedUser && updatedUser.userId) {
        setUser(updatedUser);
        setAvatarError(false);
        setToast("Cập nhật ảnh đại diện thành công!");
      } else {
        const freshUser = await api<User>("/me", "GET");
        setUser(freshUser);
        setAvatarError(false);
        setToast("Cập nhật ảnh đại diện thành công!");
      }
    } catch (e: any) {
      setToast(e.message || "Tải ảnh đại diện thất bại.");
    } finally {
      setUploadingAvatar(false);
      setTimeout(() => setToast(""), 3000);
    }
  };

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        {user ? (
          /* ================= LOGGED IN USER PROFILE ================= */
          <>
            {/* User Profile Header */}
            <View style={st.profileHeader}>
              <Pressable
                onPress={handlePickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Đổi ảnh đại diện"
                style={st.avatarWrapper}
              >
                {user.avatarUrl && !avatarError ? (
                  <Image
                    key={user.avatarUrl}
                    source={{ uri: publicUrl(user.avatarUrl) }}
                    style={st.avatarImage}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View style={st.avatarCircle}>
                    <Text style={st.avatarInitials}>{getInitials(user.fullName)}</Text>
                  </View>
                )}

                {uploadingAvatar ? (
                  <View style={st.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={st.cameraIconBadge}>
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={st.userName}>{user.fullName}</Text>
                <Text style={st.userPhone}>{user.phone || "Chưa cập nhật SĐT"}</Text>
                <Text style={st.userEmail}>{user.email}</Text>
                <Pressable onPress={() => router.push("/settings")} style={st.editProfileBtn}>
                  <Text style={st.editProfileText}>Chỉnh sửa hồ sơ</Text>
                </Pressable>
              </View>
            </View>

            {/* VIP Card for Logged In User */}
            <View style={st.vipCard}>
              <View style={st.vipDashedBorder} pointerEvents="none" />
              <View style={st.vipHeaderRow}>
                <Text style={st.vipBrandText}>YoFaSo</Text>
                <View style={st.vipTierBadge}>
                  <Ionicons name="diamond-outline" size={11} color={Colors.champagne} />
                  <Text style={st.vipTierText}>
                    {user.membership ? `${user.membership.toUpperCase()} MEMBER` : "VIP MEMBER"}
                  </Text>
                </View>
              </View>
              <Text style={st.vipTierSub}>
                Hạng {user.membership || "Thành viên"} · Thẻ Hội Viên Thân Thiết
              </Text>

              <View style={st.pointsBlock}>
                <Text style={st.pointsNumber}>
                  {Number(user.loyaltyPoints || 0).toLocaleString("vi-VN")}
                </Text>
                <Text style={st.pointsLabel}>Điểm thưởng tích lũy</Text>
              </View>
              <Text style={st.pointsEquivText}>
                ≈ {(Number(user.loyaltyPoints || 0) * 100).toLocaleString("vi-VN")} đ giảm giá trực tiếp
              </Text>

              <View style={st.tierProgressTrack}>
                <View
                  style={[
                    st.tierProgressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(10, ((Number(user.loyaltyPoints || 0) % 1000) / 1000) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={st.tierProgressLabelsRow}>
                <Text style={st.tierProgressLeft}>
                  {Number(user.loyaltyPoints || 0).toLocaleString("vi-VN")} điểm
                </Text>
                <Text style={st.tierProgressRight}>Tích lũy nâng hạng hội viên</Text>
              </View>
            </View>

            {/* Order Status Strip */}
            <View style={st.orderStripCard}>
              <View style={st.orderStripHeader}>
                <Text style={st.orderStripTitle}>Đơn hàng của tôi</Text>
                <Pressable onPress={() => router.push("/orders")}>
                  <Text style={st.orderStripAllLink}>
                    Xem tất cả ({ordersState.data?.length ?? 0}) →
                  </Text>
                </Pressable>
              </View>

              <View style={st.statusIconsRow}>
                {[
                  { icon: "card-outline" as const, label: "Chờ thanh toán", count: 0 },
                  { icon: "cube-outline" as const, label: "Đang đóng gói", count: (ordersState.data?.length ?? 0) > 0 ? 1 : 0 },
                  { icon: "bicycle-outline" as const, label: "Đang giao", count: 0 },
                  { icon: "star-outline" as const, label: "Chờ đánh giá", count: 0 },
                  { icon: "repeat-outline" as const, label: "Đổi trả / Hủy", count: 0 },
                ].map((s, idx) => (
                  <Pressable key={idx} onPress={() => router.push("/orders")} style={st.statusIconItem}>
                    <View style={st.statusIconCircle}>
                      <Ionicons name={s.icon} size={18} color={Colors.primary} />
                      {s.count > 0 && (
                        <View style={st.statusBadge}>
                          <Text style={st.statusBadgeText}>{s.count}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={st.statusLabelText}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Menu Groups for Logged In User */}
            <View style={st.menuGroupBlock}>
              <Text style={st.menuGroupHeader}>TIỆN ÍCH THỜI TRANG & AI</Text>
              <View style={st.menuItemsContainer}>
                {[
                  {
                    icon: "shirt-outline" as const,
                    title: "Tủ đồ Thử VTON & Vé O2O Fitting Pass",
                    sub: "Xem lại ảnh ướm thử và mã đối soát quầy",
                    action: () => router.push("/(shop)/wardrobe"),
                  },
                  {
                    icon: "ticket-outline" as const,
                    title: "Kho Voucher & Mã Khuyến Mãi",
                    sub: "Mã ưu đãi thành viên sẵn sàng áp dụng",
                    action: () => router.push("/cart"),
                  },
                  {
                    icon: "sparkles-outline" as const,
                    title: "Lịch sử Điểm thưởng & Đổi quà",
                    sub: "Xem lịch sử cộng điểm và đổi voucher",
                    action: showSoon,
                  },
                ].map((m, i) => (
                  <Pressable key={i} onPress={m.action} style={[st.menuRow, i > 0 && st.menuRowDivider]}>
                    <Ionicons name={m.icon} size={20} color={Colors.champagneDeep} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.menuRowTitle}>{m.title}</Text>
                      <Text style={st.menuRowSub}>{m.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={st.menuGroupBlock}>
              <Text style={st.menuGroupHeader}>TÀI KHOẢN & HỖ TRỢ</Text>
              <View style={st.menuItemsContainer}>
                {[
                  {
                    icon: "location-outline" as const,
                    title: "Sổ địa chỉ nhận hàng",
                    sub: "Quản lý địa chỉ giao nhận của bạn",
                    action: () => router.push("/addresses"),
                  },
                  {
                    icon: "notifications-outline" as const,
                    title: "Hộp thư thông báo",
                    sub: "Cập nhật đơn hàng và khuyến mãi mới",
                    action: () => router.push("/inbox"),
                  },
                  {
                    icon: "shield-checkmark-outline" as const,
                    title: "Hồ sơ và bảo mật",
                    sub: "Đổi mật khẩu, avatar và thông tin cá nhân",
                    action: () => router.push("/settings"),
                  },
                  {
                    icon: "chatbubble-ellipses-outline" as const,
                    title: "Hỗ trợ khách hàng & Showroom",
                    sub: "Hotline 1900 8822 (8:00 - 22:00)",
                    action: showSoon,
                  },
                ].map((m, i) => (
                  <Pressable key={i} onPress={m.action} style={[st.menuRow, i > 0 && st.menuRowDivider]}>
                    <Ionicons name={m.icon} size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.menuRowTitle}>{m.title}</Text>
                      <Text style={st.menuRowSub}>{m.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Logout CTA */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất tài khoản"
              onPress={async () => {
                await signOut();
                router.replace("/auth");
              }}
              style={st.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.statusDanger} />
              <Text style={st.logoutText}>ĐĂNG XUẤT TÀI KHOẢN</Text>
            </Pressable>
          </>
        ) : (
          /* ================= GUEST (KHÁCH VÃNG LAI) VIEW ================= */
          <>
            {/* Guest Welcome Header Card */}
            <View style={st.guestHeaderCard}>
              <View style={st.guestAvatarCircle}>
                <Ionicons name="person-outline" size={34} color={Colors.champagneDeep} />
              </View>
              <Text style={st.guestGreetingTitle}>Chào mừng quý khách đến với YoFaSo</Text>
              <Text style={st.guestGreetingSub}>
                Đăng nhập hoặc tạo tài khoản mới để trải nghiệm đầy đủ các tính năng thử đồ AI VTON, lưu đơn hàng và nhận đặc quyền hội viên.
              </Text>
              <Pressable
                onPress={() => router.push("/auth")}
                style={st.guestLoginPrimaryBtn}
              >
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                <Text style={st.guestLoginPrimaryText}>ĐĂNG NHẬP / ĐĂNG KÝ NGAY</Text>
              </Pressable>
            </View>

            {/* Luxury Member Privileges Showcase Card */}
            <View style={st.vipCard}>
              <View style={st.vipDashedBorder} pointerEvents="none" />
              <View style={st.vipHeaderRow}>
                <Text style={st.vipBrandText}>YoFaSo Privileges</Text>
                <View style={st.vipTierBadge}>
                  <Ionicons name="sparkles" size={11} color={Colors.champagne} />
                  <Text style={st.vipTierText}>ĐẶC QUYỀN HỘI VIÊN</Text>
                </View>
              </View>
              <Text style={st.vipTierSub}>Những quyền lợi độc quyền khi đăng ký tài khoản</Text>

              <View style={st.guestPerksList}>
                {[
                  {
                    icon: "shirt-outline" as const,
                    title: "Phòng thử đồ ảo AI VTON",
                    desc: "Ướm thử trang phục tức thì lên vóc dáng thực và lưu vào tủ đồ cá nhân.",
                  },
                  {
                    icon: "diamond-outline" as const,
                    title: "Tích điểm & Đổi Voucher giảm giá",
                    desc: "Tích lũy điểm thưởng trên từng đơn hàng để đổi voucher chiết khấu tiền mặt.",
                  },
                  {
                    icon: "cube-outline" as const,
                    title: "Theo dõi đơn hàng thời gian thực",
                    desc: "Quản lý lịch sử mua hàng, tra cứu tiến độ đóng gói và giao hàng tận nơi.",
                  },
                  {
                    icon: "gift-outline" as const,
                    title: "Quà tặng sinh nhật độc quyền",
                    desc: "Tặng ngay voucher giảm 15% trong tháng sinh nhật và tham gia Private Sale.",
                  },
                ].map((perk, i) => (
                  <View key={i} style={st.guestPerkRow}>
                    <View style={st.guestPerkIconWrap}>
                      <Ionicons name={perk.icon} size={18} color={Colors.champagne} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.guestPerkTitle}>{perk.title}</Text>
                      <Text style={st.guestPerkDesc}>{perk.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable onPress={() => router.push("/auth")} style={st.guestJoinCtaBtn}>
                <Text style={st.guestJoinCtaText}>Tham gia hội viên ngay →</Text>
              </Pressable>
            </View>

            {/* Guest Utility & Support Menu */}
            <View style={st.menuGroupBlock}>
              <Text style={st.menuGroupHeader}>THÔNG TIN & DỊCH VỤ CHUNG</Text>
              <View style={st.menuItemsContainer}>
                {[
                  {
                    icon: "call-outline" as const,
                    title: "Tổng đài hỗ trợ khách hàng",
                    sub: "Hotline miễn phí 1900 8822 (8:00 - 22:00)",
                    action: showSoon,
                  },
                  {
                    icon: "business-outline" as const,
                    title: "Hệ thống Showroom YoFaSo",
                    sub: "Tìm cửa hàng & địa chỉ quầy thử đồ gần bạn",
                    action: showSoon,
                  },
                  {
                    icon: "refresh-circle-outline" as const,
                    title: "Chính sách đổi trả & Bảo hành O2O",
                    sub: "Đổi hàng miễn phí toàn quốc trong vòng 30 ngày",
                    action: showSoon,
                  },
                  {
                    icon: "information-circle-outline" as const,
                    title: "Về thương hiệu YoFaSo Shop",
                    sub: "Tiên phong thời trang thông minh tích hợp AI VTON",
                    action: showSoon,
                  },
                ].map((m, i) => (
                  <Pressable key={i} onPress={m.action} style={[st.menuRow, i > 0 && st.menuRowDivider]}>
                    <Ionicons name={m.icon} size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.menuRowTitle}>{m.title}</Text>
                      <Text style={st.menuRowSub}>{m.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        <Text style={st.footerVersionText}>
          YoFaSo Shop Mobile v1.1.0 · Trải nghiệm thời trang thông minh tích hợp AI VTON
        </Text>
      </ScrollView>

      {/* Toast Feedback */}
      {!!toast && (
        <View style={st.toastPopup}>
          <Ionicons name="information-circle" size={17} color={Colors.champagneDeep} />
          <Text style={st.toastPopupText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 110,
    gap: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.champagne,
    position: "relative",
  },
  avatarCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: "Editorial",
    color: Colors.champagneDeep,
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  userPhone: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  editProfileBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  editProfileText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  vipCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    padding: 20,
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.champagne,
    ...Shadows.dock,
  },
  vipDashedBorder: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(197, 168, 128, 0.25)",
  },
  vipHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vipBrandText: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: Colors.champagne,
  },
  vipTierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.6)",
  },
  vipTierText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagne,
    letterSpacing: 1.2,
  },
  vipTierSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  pointsBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 14,
  },
  pointsNumber: {
    fontSize: 28,
    fontFamily: "Mono",
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pointsLabel: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.75)",
  },
  pointsEquivText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.champagne,
    marginTop: 2,
  },
  tierProgressTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2.5,
    marginTop: 14,
    overflow: "hidden",
  },
  tierProgressFill: {
    height: "100%",
    backgroundColor: Colors.champagne,
  },
  tierProgressLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  tierProgressLeft: {
    fontSize: 10,
    fontFamily: "Mono",
    color: "rgba(255, 255, 255, 0.6)",
  },
  tierProgressRight: {
    fontSize: 10,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.6)",
  },
  birthdayBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: Radii.md,
    padding: 10,
    marginTop: 14,
  },
  birthdayText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Jakarta",
    color: "#FFFFFF",
    lineHeight: 16,
  },
  orderStripCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 16,
    gap: 14,
    ...Shadows.dock,
  },
  orderStripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderStripTitle: {
    fontSize: 15,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  orderStripAllLink: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
  },
  statusIconsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusIconItem: {
    alignItems: "center",
    width: 60,
    gap: 4,
  },
  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  statusBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.statusDanger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statusLabelText: {
    fontSize: 10,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 12,
  },
  recentOrderBox: {
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    padding: 12,
    backgroundColor: Colors.surfaceMuted,
    gap: 4,
  },
  recentOrderCode: {
    fontSize: 12.5,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.primary,
  },
  recentStatusTag: {
    backgroundColor: Colors.statusWarningSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  recentStatusText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusWarning,
  },
  recentOrderTime: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  recentProgressBarTrack: {
    height: 4,
    backgroundColor: Colors.borderHairline,
    borderRadius: 2,
    marginVertical: 4,
    overflow: "hidden",
  },
  recentProgressBarFill: {
    height: "100%",
    backgroundColor: Colors.statusWarning,
  },
  viewTrackingText: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  menuGroupBlock: {
    gap: 6,
  },
  menuGroupHeader: {
    fontSize: 10.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  menuItemsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    overflow: "hidden",
    ...Shadows.dock,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  menuRowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  menuRowTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  menuRowSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    marginTop: 6,
  },
  logoutText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusDanger,
    letterSpacing: 0.5,
  },
  footerVersionText: {
    fontSize: 10.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 15,
  },
  toastPopup: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.toast,
  },
  toastPopupText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  guestHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 24,
    alignItems: "center",
    ...Shadows.dock,
  },
  guestAvatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 2,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  guestGreetingTitle: {
    fontSize: 18,
    fontFamily: "Editorial",
    color: Colors.primary,
    textAlign: "center",
    marginBottom: 6,
  },
  guestGreetingSub: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  guestLoginPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: Radii.full,
    width: "100%",
    ...Shadows.md,
  },
  guestLoginPrimaryText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  guestPerksList: {
    marginTop: 16,
    gap: 12,
  },
  guestPerkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  guestPerkIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(197, 168, 128, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  guestPerkTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  guestPerkDesc: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 2,
    lineHeight: 15,
  },
  guestJoinCtaBtn: {
    marginTop: 16,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radii.full,
    backgroundColor: "rgba(197, 168, 128, 0.2)",
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  guestJoinCtaText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagne,
  },
});
