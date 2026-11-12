import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, publicUrl } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND, isVoucherInUseOrUsed } from "@/lib/catalog-data";
import { Button, EmptyState, Notice, Sheet, colors } from "@/components/shop/ui";

interface LocalCartItem {
  variantId: string;
  name: string;
  colorName: string;
  size: string;
  unitPrice: number;
  quantity: number;
  image: any;
}

const MOCK_CART_ITEMS: LocalCartItem[] = [
  {
    variantId: "SP00000001",
    name: "Áo Sơ Mi Lụa Dáng Rộng Cổ V (Relaxed Silk)",
    colorName: "Trắng ngà",
    size: "M",
    unitPrice: 450000,
    quantity: 1,
    image: EditorialImages.shirt,
  },
  {
    variantId: "SP00000002",
    name: "Quần Âu Ống Rộng Xếp Ly Cạp Cao (High-Rise)",
    colorName: "Xanh rêu",
    size: "M",
    unitPrice: 1150000,
    quantity: 1,
    image: EditorialImages.pants,
  },
];

export default function CartScreen() {
  const { user } = useSession();
  const state = useResource<Row[]>(user ? "/cart" : null);
  const ordersState = useResource<Row[]>(user ? "/orders" : null);
  const userOrders = ordersState.data || [];
  const params = useLocalSearchParams<{ voucher?: string }>();

  const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);
  const [voucherCode, setVoucherCode] = useState("VTON5");
  const [voucherApplied, setVoucherApplied] = useState(true);
  const [voucherSheetOpen, setVoucherSheetOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VIETQR">("COD");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Sync voucher from router params if provided
  useEffect(() => {
    if (params.voucher !== undefined) {
      if (params.voucher) {
        setVoucherCode(params.voucher);
        setVoucherApplied(true);
      } else {
        setVoucherApplied(false);
        setVoucherCode("");
      }
    }
  }, [params.voucher]);

  // If initial voucher is already used/in-use in user orders, disable it
  useEffect(() => {
    if (userOrders.length > 0 && voucherApplied && voucherCode) {
      const usage = isVoucherInUseOrUsed(voucherCode, userOrders);
      if (usage.inUse) {
        setVoucherApplied(false);
        setVoucherCode("");
      }
    }
  }, [userOrders]);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      ordersState.reload();
    }, [state.reload, ordersState.reload])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (user) {
      state.reload();
      ordersState.reload();
    } else {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [user, state.reload, ordersState.reload]);

  useEffect(() => {
    if (!state.loading) {
      setRefreshing(false);
    }
  }, [state.loading]);

  // Khi người dùng đăng nhập, sử dụng trực tiếp giỏ hàng từ cơ sở dữ liệu
  const rawCart = user ? (state.data || []) : localCart;
  const cartItems: LocalCartItem[] = rawCart.map((r: any) => ({
    variantId: String(r.variantId),
    name: String(r.productName || r.name || r.productId || "Sản phẩm YoFaSo"),
    colorName: String(r.colorName || "Tiêu chuẩn"),
    size: String(r.size || "M"),
    unitPrice: Number(r.unitPrice || 0),
    quantity: Number(r.quantity || 1),
    image: r.coverUrl ? { uri: publicUrl(r.coverUrl) } : (r.image || EditorialImages.shirt),
  }));

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0
  );
  let discount = 0;
  let shippingFee = subtotal > 1000000 ? 0 : 30000;

  if (voucherApplied) {
    if (voucherCode === "BIRTHDAY15") {
      discount = Math.round(subtotal * 0.15);
    } else if (voucherCode === "FREESHIP") {
      if (subtotal >= 1000000) {
        shippingFee = 0;
      }
    } else {
      discount = Math.round(subtotal * 0.05);
    }
  }
  const total = Math.max(0, subtotal - discount + shippingFee);

  const updateQuantity = async (variantId: string, newQty: number) => {
    if (newQty < 1) {
      // Remove
      if (user) {
        await api(`/cart/items/${variantId}`, "DELETE").catch(() => {});
        state.reload();
      } else {
        setLocalCart((prev) => prev.filter((i) => i.variantId !== variantId));
      }
      setToast("Đã xóa sản phẩm khỏi túi đồ");
      setTimeout(() => setToast(""), 1800);
      return;
    }

    if (user) {
      await api("/cart/items", "PUT", { variantId, quantity: newQty }).catch(() => {});
      state.reload();
    } else {
      setLocalCart((prev) =>
        prev.map((i) => (i.variantId === variantId ? { ...i, quantity: newQty } : i))
      );
    }
  };

  const handleCheckout = () => {
    router.push({
      pathname: "/checkout",
      params: {
        paymentMethod,
        voucher: voucherApplied ? voucherCode : undefined,
      },
    });
  };

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Túi đồ của bạn",
          headerTitleStyle: { fontFamily: "Editorial", fontSize: 20 },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      {cartItems.length === 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.champagneDeep}
              colors={[Colors.champagneDeep]}
            />
          }
        >
          <EmptyState
            title="Túi đồ của bạn đang trống"
            body="Khám phá các thiết kế thời trang chuẩn phom VTON và ướm thử trên cơ thể bạn ngay hôm nay."
            cta="Khám phá bộ sưu tập"
            onCta={() => router.replace("/(shop)")}
            icon={<Ionicons name="bag-handle-outline" size={38} color={Colors.champagneDeep} />}
          />
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.champagneDeep}
              colors={[Colors.champagneDeep]}
            />
          }
        >
          <Text style={st.tipText}>Trượt hoặc chạm vào nút − để điều chỉnh số lượng.</Text>

          {/* Cart Items List */}
          <View style={st.itemsList}>
            {cartItems.map((item) => (
              <View key={item.variantId} style={st.itemCard}>
                <Image source={item.image} style={st.itemImage} resizeMode="cover" />
                <View style={st.itemInfo}>
                  <Text numberOfLines={2} style={st.itemName}>
                    {item.name}
                  </Text>
                  <View style={st.itemPillsRow}>
                    <View style={st.itemPill}>
                      <Text style={st.itemPillText}>{item.colorName}</Text>
                    </View>
                    <View style={st.itemPill}>
                      <Text style={st.itemPillText}>Size {item.size}</Text>
                    </View>
                  </View>
                  <View style={st.itemBottomRow}>
                    <Text style={st.itemPrice}>{formatVND(item.unitPrice)}</Text>
                    {/* Stepper */}
                    <View style={st.stepperContainer}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Giảm số lượng"
                        onPress={() => updateQuantity(item.variantId, item.quantity - 1)}
                        style={st.stepBtn}
                      >
                        <Ionicons name="remove" size={14} color={Colors.primary} />
                      </Pressable>
                      <Text style={st.stepQtyText}>{item.quantity}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Tăng số lượng"
                        onPress={() => updateQuantity(item.variantId, item.quantity + 1)}
                        style={st.stepBtn}
                      >
                        <Ionicons name="add" size={14} color={Colors.primary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Voucher Card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn mã giảm giá"
            onPress={() => setVoucherSheetOpen(true)}
            style={st.voucherCard}
          >
            <Ionicons name="ticket-outline" size={20} color={Colors.champagneDeep} />
            <View style={{ flex: 1 }}>
              <Text style={st.voucherTitle}>
                {voucherApplied ? (
                  <Text style={{ fontFamily: "Mono", fontWeight: "700" }}>{voucherCode}</Text>
                ) : (
                  "Chọn hoặc nhập mã ưu đãi"
                )}
              </Text>
              <Text style={st.voucherSub}>
                {voucherApplied
                  ? voucherCode === "BIRTHDAY15"
                    ? "Ưu đãi mừng sinh nhật giảm 15%"
                    : voucherCode === "FREESHIP"
                    ? "Miễn phí vận chuyển cho đơn từ 1.000.000đ"
                    : "Ưu đãi Combo VTON giảm 5%"
                  : "Nhấn để chọn mã giảm giá hoặc freeship"}
              </Text>
            </View>
            {voucherApplied ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={st.voucherDiscountText}>−{formatVND(discount)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hủy chọn voucher"
                  onPress={(e) => {
                    e.stopPropagation();
                    setVoucherApplied(false);
                    setVoucherCode("");
                    setToast("Đã hủy chọn voucher");
                    setTimeout(() => setToast(""), 1800);
                  }}
                  hitSlop={8}
                  style={st.unselectVoucherBtn}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            )}
          </Pressable>

          {/* Price Calculation Summary */}
          <View style={st.summaryCard}>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Tạm tính tiền hàng</Text>
              <Text style={st.summaryVal}>{formatVND(subtotal)}</Text>
            </View>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Giảm giá Voucher</Text>
              <Text style={[st.summaryVal, discount > 0 && { color: Colors.statusSuccess }]}>
                {discount > 0 ? `−${formatVND(discount)}` : "0 đ"}
              </Text>
            </View>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Phí vận chuyển</Text>
              <Text style={st.summaryVal}>
                {shippingFee === 0 ? "Miễn phí" : formatVND(shippingFee)}
              </Text>
            </View>
            <View style={st.dividerHairline} />
            <View style={[st.summaryRow, { alignItems: "baseline", marginTop: 4 }]}>
              <Text style={st.totalLabel}>TỔNG THANH TOÁN</Text>
              <Text style={st.totalVal}>{formatVND(total)}</Text>
            </View>
          </View>

          {/* Payment Method Selector */}
          <View style={st.paySection}>
            <Text style={st.paySectionTitle}>Phương thức thanh toán</Text>

            <Pressable
              onPress={() => setPaymentMethod("COD")}
              style={[
                st.payOptionCard,
                paymentMethod === "COD" && st.payOptionCardActive,
              ]}
            >
              <View
                style={[
                  st.payRadioCircle,
                  paymentMethod === "COD" && st.payRadioCircleActive,
                ]}
              >
                {paymentMethod === "COD" && <View style={st.payRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.payOptionTitle}>Thanh toán khi nhận hàng (COD)</Text>
                <Text style={st.payOptionSub}>Thanh toán tiền mặt cho Shipper khi nhận kiện hàng</Text>
              </View>
              <Ionicons name="cash-outline" size={20} color={Colors.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => setPaymentMethod("VIETQR")}
              style={[
                st.payOptionCard,
                paymentMethod === "VIETQR" && st.payOptionCardActive,
              ]}
            >
              <View
                style={[
                  st.payRadioCircle,
                  paymentMethod === "VIETQR" && st.payRadioCircleActive,
                ]}
              >
                {paymentMethod === "VIETQR" && <View style={st.payRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.payOptionTitle}>Quét mã VietQR (Xác nhận tự động)</Text>
                <Text style={st.payOptionSub}>Tạo mã QR Napas247 có sẵn số tiền và mã đơn</Text>
              </View>
              <Ionicons name="qr-code-outline" size={20} color={Colors.champagneDeep} />
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Floating Bottom Order Bar */}
      {cartItems.length > 0 && (
        <View style={st.bottomOrderDock}>
          <View style={{ flex: 1 }}>
            <Text style={st.dockSubLabel}>Tổng cộng:</Text>
            <Text style={st.dockTotalAmount}>{formatVND(total)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tiến hành đặt hàng"
            onPress={handleCheckout}
            style={st.orderProceedBtn}
          >
            <Text style={st.orderProceedText}>
              {paymentMethod === "COD" ? "ĐẶT HÀNG (COD)" : "THANH TOÁN VIETQR"}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* Voucher Drawer Sheet */}
      <Sheet
        visible={voucherSheetOpen}
        onClose={() => setVoucherSheetOpen(false)}
        title="Kho Voucher & Mã Khuyến Mãi"
      >
        <View style={{ gap: 14 }}>
          <View style={st.voucherInputRow}>
            <TextInput
              placeholder="Nhập mã ưu đãi (VD: VTON5, YOFASO15)"
              placeholderTextColor={Colors.textMuted}
              value={voucherCode}
              onChangeText={setVoucherCode}
              autoCapitalize="characters"
              style={st.voucherInput}
            />
            <Button
              title="Áp dụng"
              accent
              onPress={() => {
                const trimmed = voucherCode.trim().toUpperCase();
                if (!trimmed) {
                  setVoucherApplied(false);
                  setVoucherCode("");
                  setVoucherSheetOpen(false);
                  setToast("Đã hủy chọn voucher");
                  setTimeout(() => setToast(""), 1800);
                  return;
                }
                const usage = isVoucherInUseOrUsed(trimmed, userOrders);
                if (usage.inUse) {
                  const msg = usage.isCompleted
                    ? `Mã ${trimmed} đã dùng trong đơn #${usage.orderId}`
                    : `Mã ${trimmed} đang áp dụng trong đơn #${usage.orderId}`;
                  setToast(msg);
                  setTimeout(() => setToast(""), 2500);
                  return;
                }
                setVoucherCode(trimmed);
                setVoucherApplied(true);
                setVoucherSheetOpen(false);
                setToast(`Đã áp dụng mã ${trimmed}`);
                setTimeout(() => setToast(""), 2000);
              }}
              style={{ minHeight: 46, paddingHorizontal: 16 }}
            />
          </View>

          <Text style={{ fontSize: 13, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
            Mã ưu đãi có sẵn cho bạn
          </Text>

          {[
            { code: "VTON5", desc: "Giảm 5% cho trọn bộ combo thử đồ VTON", tag: "AI Combo" },
            { code: "FREESHIP", desc: "Miễn phí vận chuyển toàn quốc cho đơn từ 1.000.000đ", tag: "Vận chuyển" },
            { code: "BIRTHDAY15", desc: "Voucher mừng sinh nhật giảm 15% độc quyền", tag: "All Member" },
          ].map((v) => {
            const isSelected = voucherApplied && voucherCode.toUpperCase() === v.code.toUpperCase();
            const usage = isVoucherInUseOrUsed(v.code, userOrders);
            const isBlocked = usage.inUse;

            return (
              <Pressable
                key={v.code}
                onPress={() => {
                  if (isBlocked) {
                    setToast(
                      usage.isCompleted
                        ? `Mã ${v.code} đã dùng trong đơn #${usage.orderId}`
                        : `Mã ${v.code} đang áp dụng trong đơn #${usage.orderId}`
                    );
                    setTimeout(() => setToast(""), 2200);
                    return;
                  }
                  if (isSelected) {
                    // Tap again to unselect!
                    setVoucherApplied(false);
                    setVoucherCode("");
                    setVoucherSheetOpen(false);
                    setToast("Đã hủy chọn mã voucher");
                    setTimeout(() => setToast(""), 1800);
                  } else {
                    setVoucherCode(v.code);
                    setVoucherApplied(true);
                    setVoucherSheetOpen(false);
                    setToast(`Đã áp dụng mã ${v.code}`);
                    setTimeout(() => setToast(""), 2000);
                  }
                }}
                style={[
                  st.availableVoucherItem,
                  isSelected && st.availableVoucherItemActive,
                  isBlocked && st.availableVoucherItemBlocked,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[st.availCodeText, isBlocked && { color: Colors.textMuted }]}>
                      {v.code}
                    </Text>
                    <View style={st.availTagPill}>
                      <Text style={st.availTagText}>{v.tag}</Text>
                    </View>
                  </View>
                  <Text style={[st.availDescText, isBlocked && { color: Colors.textMuted }]}>
                    {v.desc}
                  </Text>
                </View>

                {isBlocked ? (
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={[st.useVoucherBtnText, { color: Colors.textMuted }]}>
                      {usage.isCompleted ? "Đã dùng" : "Đang xử lý"}
                    </Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted, fontFamily: "Jakarta" }}>
                      Đơn #{usage.orderId}
                    </Text>
                  </View>
                ) : isSelected ? (
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={[st.useVoucherBtnText, { color: Colors.champagneDeep, fontWeight: "700" }]}>
                      Đang chọn ✓
                    </Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted, fontFamily: "Jakarta" }}>
                      Chạm để hủy
                    </Text>
                  </View>
                ) : (
                  <Text style={st.useVoucherBtnText}>Dùng ngay</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Toast Feedback */}
      {!!toast && (
        <View style={st.toastPopup}>
          <Ionicons name="checkmark-circle" size={17} color={Colors.statusSuccess} />
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
    paddingBottom: 110,
    gap: 16,
  },
  tipText: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 12,
    gap: 12,
    ...Shadows.dock,
  },
  itemImage: {
    width: 78,
    height: 96,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  itemInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  itemName: {
    fontSize: 13.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    lineHeight: 18,
  },
  itemPillsRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 4,
  },
  itemPill: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  itemPillText: {
    fontSize: 10.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  itemBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "600",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.full,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  stepQtyText: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
    paddingHorizontal: 6,
  },
  voucherCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.champagne,
    borderRadius: Radii.lg,
    padding: 14,
  },
  voucherTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  voucherSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  voucherDiscountText: {
    fontSize: 13,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 16,
    gap: 10,
    ...Shadows.dock,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  summaryVal: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
  },
  dividerHairline: {
    height: 1,
    backgroundColor: Colors.borderHairline,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  totalVal: {
    fontSize: 20,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  paySection: {
    gap: 10,
    marginTop: 4,
  },
  paySectionTitle: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  payOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    padding: 14,
  },
  payOptionCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  payRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  payRadioCircleActive: {
    borderColor: Colors.primary,
  },
  payRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  payOptionTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  payOptionSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottomOrderDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...Shadows.sheet,
  },
  dockSubLabel: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  dockTotalAmount: {
    fontSize: 18,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  orderProceedBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Shadows.glow,
  },
  orderProceedText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  voucherInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  voucherInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: "Mono",
  },
  availableVoucherItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  availableVoucherItemActive: {
    borderColor: Colors.champagneDeep,
    backgroundColor: "#FDF8F3",
  },
  availableVoucherItemBlocked: {
    opacity: 0.6,
    backgroundColor: "#F1F5F9",
  },
  unselectVoucherBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  availCodeText: {
    fontSize: 13,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.primary,
  },
  availTagPill: {
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.sm,
  },
  availTagText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
  },
  availDescText: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  useVoucherBtnText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
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
});
