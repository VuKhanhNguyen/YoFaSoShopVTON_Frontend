import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { Colors, Radii, Shadows } from "@/constants/theme";
import { formatVND, isVoucherInUseOrUsed } from "@/lib/catalog-data";
import { Button, EmptyState, Sheet } from "@/components/shop/ui";
import { AnimatedToast, ScalePressable } from "@/components/shop/MotionPrimitives";
import { ListCardSkeleton, SmartImage } from "@/components/shop/Skeleton";

interface LocalCartItem {
  variantId: string;
  name: string;
  colorName: string;
  size: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  image: any;
}

interface DiscountDetailItem {
  code: string;
  label: string;
  kind: "COMBO_VTON" | "VOUCHER" | "SHIPPING" | string;
  amount: number;
}

interface QuoteResponse {
  subtotal: number;
  comboDiscount: number;
  comboVariantIds?: string[];
  comboSessionId?: string | null;
  voucherDiscount: number;
  voucherCode?: string | null;
  voucherName?: string | null;
  voucherType?: string | null;
  discount: number;
  shippingFee: number;
  shippingFreeReason?: string | null;
  total: number;
  discountDetails?: DiscountDetailItem[];
  voucherWarning?: string | null;
}

export default function CartScreen() {
  const { user } = useSession();
  const state = useResource<Row[]>(user ? "/cart" : null);
  const ordersState = useResource<Row[]>(user ? "/orders" : null);
  const promotionsState = useResource<Row[]>("/promotions");
  const userOrders = ordersState.data || [];
  const availablePromos = promotionsState.data || [];
  const params = useLocalSearchParams<{ voucher?: string }>();

  const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDraft, setVoucherDraft] = useState("");
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [voucherSheetOpen, setVoucherSheetOpen] = useState(false);
  const [discountExpanded, setDiscountExpanded] = useState(true);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VIETQR">("COD");
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Sync voucher from router params if explicitly passed
  useEffect(() => {
    if (params.voucher !== undefined) {
      const code = params.voucher.trim().toUpperCase();
      if (code) {
        setVoucherCode(code);
        setVoucherDraft(code);
        setVoucherApplied(true);
      } else {
        setVoucherApplied(false);
        setVoucherCode("");
        setVoucherDraft("");
      }
    }
  }, [params.voucher]);

  // If selected voucher is already used/in-use in user orders, disable it
  useEffect(() => {
    if (userOrders.length > 0 && voucherApplied && voucherCode) {
      const usage = isVoucherInUseOrUsed(voucherCode, userOrders);
      if (usage.inUse) {
        setVoucherApplied(false);
        setVoucherCode("");
      }
    }
  }, [userOrders, voucherApplied, voucherCode]);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      ordersState.reload();
      promotionsState.reload();
    }, [state.reload, ordersState.reload, promotionsState.reload])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    promotionsState.reload();
    if (user) {
      state.reload();
      ordersState.reload();
    } else {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [user, state.reload, ordersState.reload, promotionsState.reload]);

  useEffect(() => {
    if (!state.loading) {
      setRefreshing(false);
    }
  }, [state.loading]);

  const rawCart = user ? state.data || [] : localCart;
  const cartItems: LocalCartItem[] = useMemo(
    () =>
      rawCart.map((r: any) => ({
        variantId: String(r.variantId),
        name: String(r.productName || r.name || r.productId || "Sản phẩm YoFaSo"),
        colorName: String(r.colorName || "Tiêu chuẩn"),
        size: String(r.size || "M"),
        unitPrice: Number(r.unitPrice || 0),
        quantity: Number(r.quantity || 1),
        stock: r.stock !== undefined && r.stock !== null ? Number(r.stock) : 99,
        image: r.coverUrl ? publicUrl(r.coverUrl) : r.image ?? null,
      })),
    [rawCart]
  );

  // Sync checkbox selection: auto-select newly appeared in-stock items & remove deleted/out-of-stock ones
  useEffect(() => {
    const inStockIds = new Set(cartItems.filter((i) => i.stock > 0).map((i) => i.variantId));
    setSelectedIds((prev) => {
      const kept = prev.filter((id) => inStockIds.has(id));
      const newlyAdded: string[] = [];
      for (const item of cartItems) {
        if (!knownIdsRef.current.has(item.variantId)) {
          knownIdsRef.current.add(item.variantId);
          if (item.stock > 0 && !kept.includes(item.variantId)) {
            newlyAdded.push(item.variantId);
          }
        }
      }
      // Cleanup deleted ids from knownIdsRef
      for (const known of Array.from(knownIdsRef.current)) {
        if (!cartItems.some((c) => c.variantId === known)) {
          knownIdsRef.current.delete(known);
        }
      }
      return newlyAdded.length > 0 || kept.length !== prev.length ? [...kept, ...newlyAdded] : prev;
    });
  }, [cartItems]);

  const inStockItems = useMemo(() => cartItems.filter((i) => i.stock > 0), [cartItems]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => cartItems.filter((i) => selectedSet.has(i.variantId) && i.stock > 0),
    [cartItems, selectedSet]
  );
  const allSelected = inStockItems.length > 0 && selectedItems.length === inStockItems.length;

  const toggleItem = (variantId: string, stock: number) => {
    if (stock <= 0) return;
    setSelectedIds((prev) =>
      prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inStockItems.map((i) => i.variantId));
    }
  };

  const isInitialLoading = Boolean(user && state.loading && !state.data);

  // Real server quote for selected items (Combo VTON -5% + Voucher on remaining + unified shipping)
  const quoteSignature = useMemo(
    () =>
      JSON.stringify({
        items: selectedItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        voucher: voucherApplied ? voucherCode : "",
      }),
    [selectedItems, voucherApplied, voucherCode]
  );

  useEffect(() => {
    if (selectedItems.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await api<QuoteResponse>("/promotions/quote", "POST", {
          items: selectedItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          ...(voucherApplied && voucherCode ? { voucher: voucherCode } : {}),
        });
        if (!cancelled) setQuote(res);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteSignature, selectedItems.length, voucherApplied, voucherCode]);

  const localSubtotal = selectedItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const subtotal = quote ? Number(quote.subtotal ?? localSubtotal) : localSubtotal;
  const comboDiscount = quote ? Number(quote.comboDiscount ?? 0) : 0;
  const voucherDiscount = quote ? Number(quote.voucherDiscount ?? 0) : 0;
  const discount = quote ? Number(quote.discount ?? comboDiscount + voucherDiscount) : 0;
  const shippingFee = quote
    ? Number(quote.shippingFee ?? 0)
    : localSubtotal === 0 || localSubtotal >= 1000000
    ? 0
    : 30000;
  const total = quote
    ? Number(quote.total ?? Math.max(0, subtotal - discount + shippingFee))
    : Math.max(0, subtotal - discount + shippingFee);
  const comboVariantSet = useMemo(() => new Set(quote?.comboVariantIds || []), [quote?.comboVariantIds]);
  const discountDetails = quote?.discountDetails || [];

  const updateQuantity = async (variantId: string, newQty: number) => {
    if (newQty < 1) {
      if (user) {
        await api(`/cart/items/${variantId}`, "DELETE").catch(() => {});
        state.reload();
      } else {
        setLocalCart((prev) => prev.filter((i) => i.variantId !== variantId));
      }
      setSelectedIds((prev) => prev.filter((id) => id !== variantId));
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
    if (selectedItems.length === 0) {
      setToast("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán");
      setTimeout(() => setToast(""), 2000);
      return;
    }
    const validVoucher = voucherApplied && voucherCode && !quote?.voucherWarning ? voucherCode : undefined;
    router.push({
      pathname: "/checkout",
      params: {
        paymentMethod,
        voucher: validVoucher,
        selectedVariantIds: selectedItems.map((i) => i.variantId).join(","),
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

      {isInitialLoading ? (
        <View style={{ padding: 18 }}>
          <ListCardSkeleton variant="rows" count={3} />
        </View>
      ) : cartItems.length === 0 ? (
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
          {/* Select All Header Bar */}
          <View style={st.selectAllBar}>
            <Pressable
              onPress={toggleAll}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
              style={st.selectAllLeft}
            >
              <View style={[st.checkboxBox, allSelected && st.checkboxBoxChecked]}>
                {allSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={st.selectAllLabel}>
                Chọn tất cả ({selectedItems.length}/{inStockItems.length} sản phẩm)
              </Text>
            </Pressable>
            <Text style={st.tipText}>Nhấn − để giảm/xóa</Text>
          </View>

          {/* Cart Items List */}
          <View style={st.itemsList}>
            {cartItems.map((item) => {
              const outOfStock = item.stock <= 0;
              const checked = !outOfStock && selectedSet.has(item.variantId);
              const isComboItem = comboVariantSet.has(item.variantId);
              return (
              <View
                key={item.variantId}
                style={[
                  st.itemCard,
                  !checked && !outOfStock && { opacity: 0.72 },
                  outOfStock && { opacity: 0.55 },
                ]}
              >
                <Pressable
                  onPress={() => toggleItem(item.variantId, item.stock)}
                  disabled={outOfStock}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: outOfStock }}
                  style={st.itemCheckboxHit}
                >
                  <View
                    style={[
                      st.checkboxBox,
                      checked && st.checkboxBoxChecked,
                      outOfStock && st.checkboxBoxDisabled,
                    ]}
                  >
                    {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </Pressable>
                <SmartImage
                  source={item.image}
                  style={st.itemImage}
                  contentFit="cover"
                  borderRadius={Radii.md}
                  iconSize={22}
                />
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
                    {isComboItem && (
                      <View style={st.comboBadgePill}>
                        <Ionicons name="sparkles" size={10} color={Colors.champagneDeep} />
                        <Text style={st.comboBadgeText}>Combo VTON -5%</Text>
                      </View>
                    )}
                    {outOfStock && (
                      <View style={st.outOfStockPill}>
                        <Text style={st.outOfStockText}>Hết hàng</Text>
                      </View>
                    )}
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
              );
            })}
          </View>

          {/* Voucher Card */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn mã giảm giá"
            onPress={() => {
              setVoucherDraft(voucherCode);
              setVoucherSheetOpen(true);
            }}
            style={st.voucherCard}
          >
            <Ionicons name="ticket-outline" size={20} color={Colors.champagneDeep} />
            <View style={{ flex: 1 }}>
              <Text style={st.voucherTitle}>
                {voucherApplied && voucherCode ? (
                  <Text style={{ fontFamily: "Mono" }}>{voucherCode}</Text>
                ) : (
                  "Chọn hoặc nhập mã ưu đãi"
                )}
              </Text>
              <Text style={st.voucherSub}>
                {voucherApplied && voucherCode
                  ? quote?.voucherWarning
                    ? quote.voucherWarning
                    : quote?.voucherName || "Mã khuyến mãi đang áp dụng"
                  : "Nhấn để chọn mã giảm giá hoặc freeship từ hệ thống"}
              </Text>
            </View>
            {voucherApplied && voucherCode ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {voucherDiscount > 0 && (
                  <Text style={st.voucherDiscountText}>−{formatVND(voucherDiscount)}</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hủy chọn voucher"
                  onPress={(e) => {
                    e.stopPropagation();
                    setVoucherApplied(false);
                    setVoucherCode("");
                    setVoucherDraft("");
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

          {/* Price Calculation Summary with Collapsible Discount Breakdown */}
          <View style={st.summaryCard}>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>
                Tạm tính ({selectedItems.length} sản phẩm đã chọn)
              </Text>
              <Text style={st.summaryVal}>{formatVND(subtotal)}</Text>
            </View>

            <Pressable
              onPress={() => discountDetails.length > 0 && setDiscountExpanded((v) => !v)}
              style={st.summaryRow}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={st.summaryLabel}>Ưu đãi giảm giá</Text>
                {discountDetails.length > 0 && (
                  <View style={st.breakdownTogglePill}>
                    <Text style={st.breakdownToggleText}>
                      {discountDetails.length} ưu đãi
                    </Text>
                    <Ionicons
                      name={discountExpanded ? "chevron-up" : "chevron-down"}
                      size={12}
                      color={Colors.champagneDeep}
                    />
                  </View>
                )}
              </View>
              <Text style={[st.summaryVal, discount > 0 && { color: Colors.statusSuccess }]}>
                {discount > 0 ? `−${formatVND(discount)}` : "0 đ"}
              </Text>
            </Pressable>

            {discountExpanded && discountDetails.length > 0 && (
              <View style={st.discountDropdownBox}>
                {discountDetails.map((d, i) => (
                  <View key={`${d.code}-${i}`} style={st.discountDetailRow}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name={
                          d.kind === "COMBO_VTON"
                            ? "sparkles-outline"
                            : d.kind === "SHIPPING"
                            ? "bicycle-outline"
                            : "ticket-outline"
                        }
                        size={13}
                        color={Colors.champagneDeep}
                      />
                      <Text style={st.discountDetailLabel} numberOfLines={2}>
                        {d.label}
                      </Text>
                    </View>
                    <Text style={st.discountDetailAmt}>−{formatVND(Number(d.amount || 0))}</Text>
                  </View>
                ))}
                {comboDiscount > 0 && voucherDiscount > 0 && (
                  <Text style={st.stackingFootnote}>
                    Combo VTON -5% tính trước, Voucher tính trên phần còn lại sau combo.
                  </Text>
                )}
              </View>
            )}

            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Phí vận chuyển</Text>
              <Text style={[st.summaryVal, shippingFee === 0 && subtotal > 0 && { color: Colors.statusSuccess }]}>
                {subtotal === 0 ? "0 đ" : shippingFee === 0 ? "Miễn phí" : formatVND(shippingFee)}
              </Text>
            </View>
            {!!quote?.shippingFreeReason && subtotal > 0 && shippingFee === 0 && (
              <Text style={st.shippingFreeNote}>{quote.shippingFreeReason}</Text>
            )}

            <View style={st.dividerHairline} />
            <View style={[st.summaryRow, { alignItems: "baseline", marginTop: 4 }]}>
              <Text style={st.totalLabel}>TỔNG THANH TOÁN</Text>
              <Text style={st.totalVal}>
                {quoting ? "..." : formatVND(total)}
              </Text>
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
            <Text style={st.dockSubLabel}>
              Đã chọn {selectedItems.length} món · Tổng cộng:
            </Text>
            <Text style={st.dockTotalAmount}>{formatVND(total)}</Text>
          </View>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Tiến hành đặt hàng"
            disabled={selectedItems.length === 0}
            onPress={handleCheckout}
            style={[
              st.orderProceedBtn,
              selectedItems.length === 0 && { opacity: 0.45 },
            ]}
          >
            <Text style={st.orderProceedText}>
              {selectedItems.length === 0
                ? "CHỌN SẢN PHẨM"
                : paymentMethod === "COD"
                ? `ĐẶT HÀNG (${selectedItems.length})`
                : `VIETQR (${selectedItems.length})`}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </ScalePressable>
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
              placeholder="Nhập mã ưu đãi (VD: YOFASO10, FREESHIP)"
              placeholderTextColor={Colors.textMuted}
              value={voucherDraft}
              onChangeText={setVoucherDraft}
              autoCapitalize="characters"
              style={st.voucherInput}
            />
            <Button
              title="Áp dụng"
              accent
              onPress={() => {
                const trimmed = voucherDraft.trim().toUpperCase();
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
            Mã khuyến mãi đang hiệu lực ({availablePromos.length})
          </Text>

          {availablePromos.length === 0 ? (
            <Text style={{ fontSize: 12, fontFamily: "Jakarta", color: Colors.textMuted }}>
              Hiện chưa có mã voucher khả dụng. Combo phối đồ AI VTON (-5%) vẫn tự động áp dụng khi chọn đủ cặp món đã thử!
            </Text>
          ) : (
            availablePromos.map((p: any) => {
              const code = String(p.code || "");
              const isSelected = voucherApplied && voucherCode.toUpperCase() === code.toUpperCase();
              const usage = isVoucherInUseOrUsed(code, userOrders);
              const isBlocked = usage.inUse;
              const tag =
                p.type === "MIEN_PHI_VAN_CHUYEN"
                  ? "Freeship"
                  : p.type === "PHAN_TRAM"
                  ? `-${Number(p.value || 0)}%`
                  : `-${formatVND(Number(p.value || 0))}`;
              const minLabel =
                Number(p.minimumTotal || 0) > 0
                  ? ` · Đơn từ ${formatVND(Number(p.minimumTotal))}`
                  : "";

              return (
                <Pressable
                  key={code}
                  onPress={() => {
                    if (isBlocked) {
                      setToast(
                        usage.isCompleted
                          ? `Mã ${code} đã dùng trong đơn #${usage.orderId}`
                          : `Mã ${code} đang áp dụng trong đơn #${usage.orderId}`
                      );
                      setTimeout(() => setToast(""), 2200);
                      return;
                    }
                    if (isSelected) {
                      setVoucherApplied(false);
                      setVoucherCode("");
                      setVoucherDraft("");
                      setVoucherSheetOpen(false);
                      setToast("Đã hủy chọn mã voucher");
                      setTimeout(() => setToast(""), 1800);
                    } else {
                      setVoucherCode(code);
                      setVoucherDraft(code);
                      setVoucherApplied(true);
                      setVoucherSheetOpen(false);
                      setToast(`Đã áp dụng mã ${code}`);
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
                        {code}
                      </Text>
                      <View style={st.availTagPill}>
                        <Text style={st.availTagText}>{tag}</Text>
                      </View>
                    </View>
                    <Text style={[st.availDescText, isBlocked && { color: Colors.textMuted }]}>
                      {String(p.name || code)}
                      {minLabel}
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
                      <Text style={[st.useVoucherBtnText, { color: Colors.champagneDeep }]}>
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
            })
          )}
        </View>
      </Sheet>

      {/* Toast Feedback */}
      <AnimatedToast message={toast} tone="success" offset={96} />
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
  selectAllBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectAllLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectAllLabel: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxBoxDisabled: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: Colors.borderHairline,
  },
  itemCheckboxHit: {
    alignSelf: "center",
    paddingRight: 2,
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
    gap: 10,
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
    flexWrap: "wrap",
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
  comboBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.champagne,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  comboBadgeText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  outOfStockPill: {
    backgroundColor: Colors.statusDangerSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  outOfStockText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusDanger,
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
    color: Colors.statusSuccess,
  },
  breakdownTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
    backgroundColor: Colors.champagneSubtle,
  },
  breakdownToggleText: {
    fontSize: 10.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  discountDropdownBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 10,
    gap: 6,
  },
  discountDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  discountDetailLabel: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  discountDetailAmt: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.statusSuccess,
  },
  stackingFootnote: {
    fontSize: 10.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    marginTop: 2,
  },
  shippingFreeNote: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.statusSuccess,
    textAlign: "right",
    marginTop: -4,
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
