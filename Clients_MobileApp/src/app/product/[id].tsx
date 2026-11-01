import { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, publicUrl } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import { money, type Product, type Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import {
  EditorialImages,
  SAN_PHAM_MOCK,
  SanPham,
  formatVND,
  tonKho,
  vtonHint,
  KICH_CO,
  KichCo,
} from "@/lib/catalog-data";
import { Button, Notice, Sheet, colors } from "@/components/shop/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SIZE_GUIDE_DATA = [
  ["XS", "150–155", "40–45", "78–82", "60–64"],
  ["S", "155–160", "45–50", "82–86", "64–68"],
  ["M", "160–165", "50–55", "86–90", "68–72"],
  ["L", "165–170", "55–62", "90–95", "72–77"],
  ["XL", "170–175", "62–70", "95–100", "77–82"],
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  // Try fetching from backend API
  const state = useResource<Product>(`/catalog/products/${encodeURIComponent(id)}`);
  const cartState = useResource<Row[]>("/cart");

  // Fallback to mock product if backend not available or item is from mock catalog
  const mockItem =
    SAN_PHAM_MOCK.find((p) => p.maSanPham === id) || SAN_PHAM_MOCK[0];

  const p = state.data;
  const isMock = !p || Boolean(mockItem && mockItem.maSanPham === id);

  // Gallery images setup
  const galleryImages: any[] = [];
  if (!isMock && p?.images && p.images.length > 0) {
    p.images.forEach((img) => galleryImages.push(publicUrl(img.originalUrl)));
  } else {
    galleryImages.push(mockItem.hinhAnh);
    if (mockItem.hinhAnhPhu) galleryImages.push(...mockItem.hinhAnhPhu);
    if (mockItem.bienThe[0]?.anhNguoiMau)
      galleryImages.push(...mockItem.bienThe[0].anhNguoiMau);
  }

  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<KichCo>("M");
  const [descExpanded, setDescExpanded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const galleryRef = useRef<ScrollView>(null);

  const productName = !isMock && p ? p.name : mockItem.tenSanPham;
  const productPrice =
    !isMock && p?.minPrice ? p.minPrice : mockItem.giaBan;
  const productSku = !isMock && p ? p.productId : mockItem.maSanPham;
  const productMaterial =
    !isMock && p?.material ? p.material : mockItem.chatLieu;
  const productDesc = !isMock && p?.description ? p.description : mockItem.moTa;
  const productCategory =
    !isMock && p?.vtonCategory ? (p.vtonCategory as any) : mockItem.loai;

  const currentVariant = mockItem.bienThe[selectedColorIndex] ?? mockItem.bienThe[0];
  const stock = currentVariant ? tonKho(currentVariant, selectedSize) : 8;
  const isSoldOut = stock <= 0;

  const cartCount =
    cartState.data?.reduce((s, r) => s + Number(r.quantity || 1), 0) ?? 0;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Khám phá ${productName} tại YoFaSo Shop: ${formatVND(productPrice)}`,
        title: productName,
      });
    } catch {}
  };

  const handleAddToCart = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      // If backend has variants, use first one
      const variantId = p?.variants?.[0]?.variantId || productSku;
      await api("/cart/items", "PUT", { variantId, quantity: 1 });
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
      cartState.reload();
    } catch (e: any) {
      // Local fallback success toast
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const handleTryOn = () => {
    router.push({
      pathname: "/try-on",
      params: {
        variantId: productSku,
        category: productCategory,
      },
    });
  };

  return (
    <View style={st.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Horizontal Paging Gallery */}
        <View style={st.galleryContainer}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setActiveSlide(slide);
            }}
            scrollEventThrottle={16}
          >
            {galleryImages.map((img, i) => (
              <View key={i} style={st.imageSlide}>
                {typeof img === "number" ? (
                  <Image source={img} style={st.slideImage} resizeMode="cover" />
                ) : (
                  <Image source={{ uri: img }} style={st.slideImage} resizeMode="cover" />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Top Glass Floating Header */}
          <View style={st.topFloatingBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => router.back()}
              style={st.floatingCircleBtn}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.primary} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chia sẻ"
                onPress={handleShare}
                style={st.floatingCircleBtn}
              >
                <Ionicons name="share-outline" size={19} color={Colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Túi đồ"
                onPress={() => router.push("/cart")}
                style={st.floatingCircleBtn}
              >
                <Ionicons name="bag-handle-outline" size={19} color={Colors.primary} />
                {cartCount > 0 && (
                  <View style={st.cartCounter}>
                    <Text style={st.cartCounterText}>{cartCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* AI VTON Ready Badge */}
          <View style={st.vtonReadyBadge}>
            <Ionicons name="sparkles" size={12} color={Colors.champagneDeep} />
            <Text style={st.vtonReadyText}>AI VTON Ready</Text>
          </View>

          {/* Pagination Indicators */}
          <View style={st.paginationRow}>
            {galleryImages.map((_, i) => (
              <View
                key={i}
                style={[
                  st.paginationDot,
                  i === activeSlide && st.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Main Product Info */}
        <View style={st.bodySection}>
          <Text style={st.skuText}>{productSku}</Text>
          <Text style={st.productTitle}>{productName}</Text>
          {productMaterial ? (
            <Text style={st.materialText}>{productMaterial}</Text>
          ) : null}
          <Text style={st.priceText}>{formatVND(productPrice)}</Text>

          {/* VTON Compatibility Card */}
          <View style={st.vtonCompatCard}>
            <Ionicons name="sparkles-sharp" size={18} color={Colors.champagneDeep} style={{ marginTop: 2 }} />
            <Text style={st.vtonCompatText}>{vtonHint(productCategory)}</Text>
          </View>

          {/* Description & Expandable Details */}
          {productDesc && (
            <View style={st.descBlock}>
              <Text style={st.sectionHeaderLabel}>Mô tả chi tiết</Text>
              <Text
                numberOfLines={descExpanded ? undefined : 3}
                style={st.descText}
              >
                {productDesc}
              </Text>
              {mockItem.chiTiet && descExpanded && (
                <View style={st.bulletList}>
                  {mockItem.chiTiet.map((item, idx) => (
                    <View key={idx} style={st.bulletRow}>
                      <View style={st.bulletDot} />
                      <Text style={st.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Pressable
                onPress={() => setDescExpanded(!descExpanded)}
                style={st.expandBtn}
              >
                <Text style={st.expandBtnText}>
                  {descExpanded ? "Thu gọn" : "Xem thêm chi tiết"}
                </Text>
                <Ionicons
                  name={descExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={Colors.champagneDeep}
                />
              </Pressable>
            </View>
          )}

          {/* Color Selection Swatches */}
          <View style={st.optionBlock}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={st.sectionHeaderLabel}>Màu sắc:</Text>
              <Text style={st.optionValueText}>{currentVariant.tenMau}</Text>
              <Text style={st.hexText}>{currentVariant.maMauHex}</Text>
            </View>
            <View style={st.swatchesRow}>
              {mockItem.bienThe.map((b, i) => {
                const on = i === selectedColorIndex;
                return (
                  <Pressable
                    key={b.maMauHex}
                    onPress={() => setSelectedColorIndex(i)}
                    style={[
                      st.swatchRing,
                      on && st.swatchRingActive,
                    ]}
                  >
                    <View
                      style={[
                        st.swatchColor,
                        { backgroundColor: b.maMauHex },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Size Selection */}
          <View style={st.optionBlock}>
            <View style={st.sizeHeaderRow}>
              <Text style={st.sectionHeaderLabel}>Kích cỡ</Text>
              <Pressable
                onPress={() => setSizeGuideOpen(true)}
                style={st.sizeGuideLink}
              >
                <Ionicons name="resize-outline" size={14} color={Colors.champagneDeep} />
                <Text style={st.sizeGuideText}>Bảng quy đổi kích cỡ</Text>
              </Pressable>
            </View>
            <View style={st.sizePillsGrid}>
              {KICH_CO.map((s) => {
                const out = tonKho(currentVariant, s) === 0;
                const on = selectedSize === s;
                return (
                  <Pressable
                    key={s}
                    disabled={out}
                    onPress={() => setSelectedSize(s)}
                    style={[
                      st.sizePill,
                      on && st.sizePillActive,
                      out && st.sizePillDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        st.sizePillText,
                        on && st.sizePillTextActive,
                        out && st.sizePillTextDisabled,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Inventory Status Dot */}
            <View style={st.stockRow}>
              <View
                style={[
                  st.stockDot,
                  {
                    backgroundColor: isSoldOut
                      ? Colors.statusDanger
                      : stock <= 3
                      ? Colors.statusWarning
                      : Colors.statusSuccess,
                  },
                ]}
              />
              <Text style={st.stockText}>
                {isSoldOut
                  ? "Biến thể màu này tạm hết hàng"
                  : stock <= 3
                  ? `Chỉ còn ${stock} chiếc tại cửa hàng`
                  : `Còn ${stock} chiếc sẵn sàng giao`}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Action Dock */}
      <View style={st.actionDock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm vào giỏ hàng"
          disabled={isSoldOut || busy}
          onPress={handleAddToCart}
          style={st.addToCartBtn}
        >
          {cartSuccess ? (
            <Ionicons name="checkmark" size={22} color={Colors.statusSuccess} />
          ) : (
            <Ionicons name="bag-add-outline" size={22} color={Colors.primary} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ướm thử vào tôi"
          onPress={handleTryOn}
          style={st.tryOnCtaBtn}
        >
          <Ionicons name="shirt" size={17} color={Colors.champagne} />
          <Text style={st.tryOnCtaText}>ƯỚM THỬ VÀO TÔI</Text>
        </Pressable>
      </View>

      {/* Size Guide Modal Sheet */}
      <Sheet
        visible={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        title="Bảng quy đổi kích cỡ (Size Guide)"
      >
        <View style={st.sizeGuideTable}>
          <View style={st.sizeGuideRowHeader}>
            {["Size", "Cao (cm)", "Nặng (kg)", "Ngực", "Eo"].map((h) => (
              <Text key={h} style={st.sizeGuideHeaderCol}>
                {h}
              </Text>
            ))}
          </View>
          {SIZE_GUIDE_DATA.map((row) => (
            <View key={row[0]} style={st.sizeGuideRow}>
              {row.map((cell, i) => (
                <Text
                  key={i}
                  style={[
                    st.sizeGuideCol,
                    i === 0 && { fontFamily: "JakartaSemiBold", color: Colors.primary },
                  ]}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={st.sizeGuideFootnote}>
          Nếu số đo nằm giữa hai size, hãy chọn size lớn hơn cho phom dáng suông thoải mái.
        </Text>
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  galleryContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25, // 4:5 aspect ratio
    backgroundColor: Colors.surfaceMuted,
    position: "relative",
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  topFloatingBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 48 : 36,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.dock,
  },
  cartCounter: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  cartCounterText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  vtonReadyBadge: {
    position: "absolute",
    bottom: 16,
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    ...Shadows.dock,
  },
  vtonReadyText: {
    fontSize: 10.5,
    fontFamily: "Mono",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  paginationRow: {
    position: "absolute",
    bottom: 18,
    right: 18,
    flexDirection: "row",
    gap: 4,
  },
  paginationDot: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },
  bodySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  skuText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  productTitle: {
    fontSize: 24,
    fontFamily: "Editorial",
    color: Colors.primary,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  materialText: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 6,
  },
  priceText: {
    fontSize: 20,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "600",
    marginTop: 10,
  },
  vtonCompatCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    borderRadius: Radii.lg,
    padding: 14,
    marginTop: 16,
  },
  vtonCompatText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.primary,
    lineHeight: 18,
  },
  descBlock: {
    marginTop: 20,
  },
  sectionHeaderLabel: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  descText: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  bulletList: {
    gap: 6,
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.champagneDeep,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  expandBtnText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  optionBlock: {
    marginTop: 20,
  },
  optionValueText: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  hexText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  swatchesRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  swatchRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRingActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  swatchColor: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  sizeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sizeGuideLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sizeGuideText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
    textDecorationLine: "underline",
  },
  sizePillsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  sizePill: {
    flex: 1,
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sizePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizePillDisabled: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: Colors.borderHairline,
    opacity: 0.5,
  },
  sizePillText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  sizePillTextActive: {
    color: "#FFFFFF",
  },
  sizePillTextDisabled: {
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  actionDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    ...Shadows.sheet,
  },
  addToCartBtn: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  tryOnCtaBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Shadows.glow,
  },
  tryOnCtaText: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  sizeGuideTable: {
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    overflow: "hidden",
    marginVertical: 10,
  },
  sizeGuideRowHeader: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
  },
  sizeGuideHeaderCol: {
    flex: 1,
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sizeGuideRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
  },
  sizeGuideCol: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: "Mono",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sizeGuideFootnote: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 8,
  },
});
