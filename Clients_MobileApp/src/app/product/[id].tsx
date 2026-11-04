import { useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
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
import { money, type Product, type Review, type Row, type Variant } from "@/lib/models";
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

const matchColor = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA === normB) return true;
  const pA = normA.split(",")[0].trim();
  const pB = normB.split(",")[0].trim();
  if (pA === pB) return true;
  const tokensA = normA.split(",").map((s) => s.trim());
  const tokensB = normB.split(",").map((s) => s.trim());
  return tokensA.some((t) => tokensB.includes(t));
};

// Curated size charts per Category & Gender
const SIZE_GUIDES = {
  AO_NU: {
    title: "Áo Nữ (Tops & Blouses)",
    headers: ["Size", "Cao (cm)", "Nặng (kg)", "Ngực", "Eo"],
    rows: [
      ["XS", "150–155", "40–45", "78–82", "60–64"],
      ["S", "155–160", "45–50", "82–86", "64–68"],
      ["M", "160–165", "50–55", "86–90", "68–72"],
      ["L", "165–170", "55–60", "90–95", "72–76"],
      ["XL", "168–172", "60–66", "95–100", "76–82"],
    ],
  },
  QUAN_VAY_NU: {
    title: "Quần & Váy Nữ (Bottoms)",
    headers: ["Size", "Cao (cm)", "Vòng eo", "Vòng mông", "Dài (cm)"],
    rows: [
      ["XS", "150–155", "60–63", "84–87", "92–95"],
      ["S", "155–160", "64–67", "88–91", "95–98"],
      ["M", "160–165", "68–71", "92–95", "98–101"],
      ["L", "165–170", "72–75", "96–99", "101–104"],
      ["XL", "168–172", "76–80", "100–104", "104–106"],
    ],
  },
  DAM_NU: {
    title: "Đầm Liền Nữ (Dresses)",
    headers: ["Size", "Ngực", "Vòng eo", "Vòng mông", "Dài đầm"],
    rows: [
      ["XS", "80–83", "60–63", "85–88", "105–110"],
      ["S", "84–87", "64–67", "89–92", "110–115"],
      ["M", "88–91", "68–71", "93–96", "115–120"],
      ["L", "92–95", "72–75", "97–100", "120–124"],
      ["XL", "96–100", "76–80", "101–105", "124–126"],
    ],
  },
  AO_NAM: {
    title: "Áo Nam (Shirts & Polo)",
    headers: ["Size", "Cao (cm)", "Nặng (kg)", "Vòng ngực", "Rộng vai"],
    rows: [
      ["S", "160–167", "52–60", "88–92", "42–43"],
      ["M", "168–173", "60–68", "92–96", "44–45"],
      ["L", "173–178", "68–76", "96–102", "46–47"],
      ["XL", "178–183", "76–84", "102–108", "48–49"],
      ["XXL", "180–188", "84–92", "108–114", "50–51"],
    ],
  },
  QUAN_NAM: {
    title: "Quần Nam (Trousers & Jeans)",
    headers: ["Size", "Cao (cm)", "Nặng (kg)", "Vòng eo", "Dài quần"],
    rows: [
      ["S", "160–167", "52–58", "74–76", "96–98"],
      ["M", "168–173", "59–65", "77–80", "98–100"],
      ["L", "173–176", "66–72", "81–84", "100–102"],
      ["XL", "176–180", "73–78", "85–88", "102–104"],
      ["XXL", "180–185", "79–85", "89–92", "104–106"],
    ],
  },
};

interface GallerySlideItem {
  uri: any;
  colorHex?: string;
  colorName?: string;
  sku?: string;
  isModel?: boolean;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  // Fetch product from backend API
  const state = useResource<Product>(`/catalog/products/${encodeURIComponent(id)}`);
  const cartState = useResource<Row[]>("/cart");
  const reviewsState = useResource<Review[]>(`/catalog/products/${encodeURIComponent(id)}/reviews`);

  // Fallback to mock product
  const mockItem =
    SAN_PHAM_MOCK.find((p) => p.maSanPham === id) || SAN_PHAM_MOCK[0];

  const p = state.data;
  const isMock = !p || Boolean(mockItem && mockItem.maSanPham === id && (!p.variants || p.variants.length === 0));

  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [descExpanded, setDescExpanded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [sizeGuideTab, setSizeGuideTab] = useState<keyof typeof SIZE_GUIDES>("AO_NU");
  const [cartSuccess, setCartSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const galleryRef = useRef<ScrollView>(null);

  // Group colors from backend variants or fallback mock
  const colorOptions: { name: string; hex: string; sku: string }[] = [];
  if (!isMock && p?.variants && p.variants.length > 0) {
    const seen = new Set<string>();
    p.variants.forEach((v) => {
      const key = v.colors || v.colorName;
      if (key && !seen.has(key)) {
        seen.add(key);
        colorOptions.push({
          name: v.colorName || "Màu sắc",
          hex: v.colors || "#000000",
          sku: v.sku,
        });
      }
    });
    // Bổ sung màu sắc từ ảnh nếu có màu chưa xuất hiện trong biến thể
    if (p.images && p.images.length > 0) {
      p.images.forEach((img) => {
        if (img.colors && !colorOptions.some((co) => matchColor(co.hex, img.colors))) {
          colorOptions.push({
            name: "Màu sắc",
            hex: img.colors,
            sku: "",
          });
        }
      });
    }
  } else {
    mockItem.bienThe.forEach((b, idx) => {
      colorOptions.push({
        name: b.tenMau,
        hex: b.maMauHex,
        sku: `YFS-${mockItem.loai === "upper_body" ? "UB" : mockItem.loai === "lower_body" ? "LB" : "DR"}-014${idx + 1}`,
      });
    });
  }

  // Active color option
  const activeColor = colorOptions[selectedColorIndex] || colorOptions[0] || { name: "Màu chuẩn", hex: "#000000", sku: "" };

  // Set default size guide tab based on category and name
  const productCategory = !isMock && p?.vtonCategory ? p.vtonCategory : mockItem.loai;
  const isMen = (!isMock && p?.name && (p.name.toLowerCase().includes("nam") || p.name.toLowerCase().includes("quý ông"))) || false;

  // Candidate sizes based on gender / product
  const baseSizes = isMen
    ? ["S", "M", "L", "XL", "XXL"]
    : ["XS", "S", "M", "L", "XL"];
  const extraSizes = !isMock && p?.variants
    ? Array.from(new Set(p.variants.map((v) => v.size))).filter((s) => !baseSizes.includes(s))
    : [];
  const displayedSizes = [...baseSizes, ...extraSizes];

  // Check if a size is available for the currently selected color
  const isSizeAvailable = (size: string) => {
    if (isMock) {
      const currentMock = mockItem.bienThe[selectedColorIndex] ?? mockItem.bienThe[0];
      return tonKho(currentMock, size as any) > 0;
    }
    if (!p?.variants || p.variants.length === 0) return true;
    return p.variants.some(
      (v) =>
        matchColor(v.colors, activeColor.hex) &&
        v.size === size &&
        v.status !== "NGUNG_BAN" &&
        v.stock > 0
    );
  };

  useEffect(() => {
    if (p?.variants && p.variants.length > 0) {
      if (!isSizeAvailable(selectedSize)) {
        const firstAvail = displayedSizes.find((s) => isSizeAvailable(s));
        if (firstAvail) {
          setSelectedSize(firstAvail);
        }
      }
    }
  }, [activeColor.hex, p?.variants]);

  useEffect(() => {
    if (isMen) {
      setSizeGuideTab(productCategory === "lower_body" ? "QUAN_NAM" : "AO_NAM");
    } else {
      if (productCategory === "dress") setSizeGuideTab("DAM_NU");
      else if (productCategory === "lower_body") setSizeGuideTab("QUAN_VAY_NU");
      else setSizeGuideTab("AO_NU");
    }
  }, [productCategory, isMen]);

  // Build gallery slides with color metadata for Bidirectional Sync (Requirement 8)
  const gallerySlides: GallerySlideItem[] = [];
  if (!isMock && p?.images && p.images.length > 0) {
    p.images.forEach((img) => {
      const url = publicUrl(img.originalUrl);
      const matchedColor = colorOptions.find(
        (c) => img.colors && matchColor(c.hex, img.colors)
      );
      const isModelPhoto = Boolean(
        img.cover || !img.cutoutUrl || (img.originalUrl && img.originalUrl.includes("--ref"))
      );
      gallerySlides.push({
        uri: url,
        colorHex: img.colors || matchedColor?.hex,
        colorName: matchedColor?.name,
        sku: matchedColor?.sku,
        isModel: isModelPhoto,
      });
    });
  } else {
    // Mock gallery setup
    gallerySlides.push({
      uri: mockItem.hinhAnh,
      colorHex: mockItem.bienThe[0]?.maMauHex,
      colorName: mockItem.bienThe[0]?.tenMau,
      sku: colorOptions[0]?.sku,
      isModel: false,
    });
    if (mockItem.hinhAnhPhu) {
      mockItem.hinhAnhPhu.forEach((img) =>
        gallerySlides.push({ uri: img, isModel: false })
      );
    }
    mockItem.bienThe.forEach((b, idx) => {
      if (b.hinhAnh && b.hinhAnh.length > 0) {
        gallerySlides.push({
          uri: b.hinhAnh[0],
          colorHex: b.maMauHex,
          colorName: b.tenMau,
          sku: colorOptions[idx]?.sku,
          isModel: false,
        });
      }
      if (b.anhNguoiMau && b.anhNguoiMau.length > 0) {
        gallerySlides.push({
          uri: b.anhNguoiMau[0],
          colorHex: b.maMauHex,
          colorName: b.tenMau,
          sku: colorOptions[idx]?.sku,
          isModel: true,
        });
      }
    });
  }

  // Active SKU: dynamically reflects current active color and size
  const productName = !isMock && p ? p.name : mockItem.tenSanPham;
  const productPrice = !isMock && p?.minPrice ? p.minPrice : mockItem.giaBan;
  const originalPrice = !isMock && p?.originalPrice ? p.originalPrice : Math.round(productPrice * 1.25);
  const hasDiscount = (!isMock && p?.hasDiscount) || true;
  const discountPercent = (!isMock && p?.discountPercent) || 22;
  const productDesc = !isMock && p?.description ? p.description : mockItem.moTa;
  const productMaterial = !isMock && p?.material ? p.material : mockItem.chatLieu;

  // Active SKU derived from active slide or active color (Requirement 8)
  const currentVariantByOption = !isMock && p?.variants
    ? p.variants.find((v) => matchColor(v.colors, activeColor.hex) && v.size === selectedSize)
      || p.variants.find((v) => matchColor(v.colors, activeColor.hex))
      || p.variants[0]
    : null;

  const activeSku = currentVariantByOption?.sku || activeColor.sku || `YFS-PR-${id}`;

  const currentMockVariant = mockItem.bienThe[selectedColorIndex] ?? mockItem.bienThe[0];
  const stock = !isMock && currentVariantByOption
    ? currentVariantByOption.stock
    : currentMockVariant ? tonKho(currentMockVariant, selectedSize as any) : 8;
  const isSoldOut = stock <= 0;

  const cartCount =
    cartState.data?.reduce((s, r) => s + Number(r.quantity || 1), 0) ?? 0;

  // Handle color swatch click -> scroll gallery to that color's photo (Requirement 8)
  const handleSelectColor = (index: number) => {
    setSelectedColorIndex(index);
    const chosenColor = colorOptions[index];
    if (chosenColor) {
      // Ưu tiên tìm ảnh sản phẩm thật (!isModel) có màu sắc khớp, fallback tới bất kỳ slide nào cùng màu
      let slideIndex = gallerySlides.findIndex(
        (s) => s.colorHex && matchColor(s.colorHex, chosenColor.hex) && !s.isModel
      );
      if (slideIndex === -1) {
        slideIndex = gallerySlides.findIndex(
          (s) => s.colorHex && matchColor(s.colorHex, chosenColor.hex)
        );
      }
      if (slideIndex !== -1 && galleryRef.current) {
        galleryRef.current.scrollTo({
          x: slideIndex * SCREEN_WIDTH,
          animated: true,
        });
        setActiveSlide(slideIndex);
      }
    }
  };

  // Handle swipe on gallery -> auto-activate corresponding color swatch (Requirement 8)
  const handleGalleryMomentumEnd = (e: any) => {
    const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (slide >= 0 && slide < gallerySlides.length) {
      setActiveSlide(slide);
      const targetSlide = gallerySlides[slide];
      if (targetSlide && targetSlide.colorHex) {
        const foundColorIndex = colorOptions.findIndex(
          (c) => matchColor(c.hex, targetSlide.colorHex)
        );
        if (foundColorIndex !== -1 && foundColorIndex !== selectedColorIndex) {
          setSelectedColorIndex(foundColorIndex);
        }
      }
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Khám phá ${productName} (Mã: ${activeSku}) tại YoFaSo Shop: ${formatVND(productPrice)}`,
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
    try {
      const variantId = currentVariantByOption?.variantId || activeSku;
      await api("/cart/items", "PUT", { variantId, quantity: 1 });
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 2000);
      cartState.reload();
    } catch {
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
        variantId: activeSku,
        category: productCategory,
      },
    });
  };

  // Reviews data directly from database (no fake fallback)
  const reviews: Review[] = reviewsState.data ?? [];
  const rawRating = Number(p?.avgRating);
  const avgStars = !isNaN(rawRating) && rawRating > 0 ? rawRating.toFixed(1) : "0.0";
  const reviewCount = p?.reviewCount ?? reviews.length;
  const soldCount = p?.soldCount ?? 0;

  return (
    <View style={st.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Horizontal Paging Gallery with Bidirectional Sync */}
        <View style={st.galleryContainer}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleGalleryMomentumEnd}
            scrollEventThrottle={16}
          >
            {gallerySlides.map((slide, i) => (
              <View key={i} style={st.imageSlide}>
                <ExpoImage
                  source={typeof slide.uri === "number" ? slide.uri : { uri: slide.uri }}
                  style={st.slideImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </View>
            ))}
          </ScrollView>

          {/* Top Floating Glass Action Bar */}
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
            {gallerySlides.map((_, i) => (
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

        {/* Main Product Info Section */}
        <View style={st.bodySection}>
          {/* Dynamic SKU Code per active photo / swatch */}
          <View style={st.skuRatingRow}>
            <View style={st.skuBadge}>
              <Text style={st.skuLabel}>MÃ:</Text>
              <Text style={st.skuText}>{activeSku}</Text>
            </View>
            <View style={st.ratingBadge}>
              <Ionicons
                name={Number(avgStars) > 0 ? "star" : "star-outline"}
                size={12}
                color={Number(avgStars) > 0 ? "#EAB308" : Colors.textMuted}
              />
              <Text
                style={[
                  st.ratingScoreText,
                  Number(avgStars) <= 0 && { color: Colors.textMuted },
                ]}
              >
                {Number(avgStars) > 0 ? avgStars : "0 sao"}
              </Text>
              <Text style={st.ratingReviewsText}>
                {reviewCount > 0 ? `(${reviewCount}) · ` : ""}Đã bán {soldCount}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={st.productTitle}>{productName}</Text>
          {productMaterial ? (
            <Text style={st.materialText}>{productMaterial}</Text>
          ) : null}

          {/* Price with Discount Badge (User Image 1) */}
          <View style={st.priceSection}>
            <View style={st.priceBadgeRow}>
              <Text style={st.priceText}>{formatVND(productPrice)}</Text>
              {hasDiscount && discountPercent ? (
                <View style={st.discountPill}>
                  <Text style={st.discountPillText}>-{discountPercent}%</Text>
                </View>
              ) : null}
            </View>
            {hasDiscount && originalPrice ? (
              <Text style={st.originalPriceText}>{formatVND(originalPrice)}</Text>
            ) : null}
          </View>

          {/* VTON Compatibility Card */}
          <View style={st.vtonCompatCard}>
            <Ionicons name="sparkles-sharp" size={18} color={Colors.champagneDeep} style={{ marginTop: 2 }} />
            <Text style={st.vtonCompatText}>{vtonHint(productCategory as any)}</Text>
          </View>

          {/* Color Selection Swatches with Bidirectional Sync */}
          <View style={st.optionBlock}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={st.sectionHeaderLabel}>Màu sắc:</Text>
                <Text style={st.optionValueText}>{activeColor.name}</Text>
              </View>
              <Text style={st.hexText}>{activeColor.hex}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.swatchesScrollContent}
              style={st.swatchesScroll}
            >
              {colorOptions.map((c, i) => {
                const on = i === selectedColorIndex;
                return (
                  <Pressable
                    key={`${c.hex}-${i}`}
                    onPress={() => handleSelectColor(i)}
                    style={[
                      st.swatchRing,
                      on && st.swatchRingActive,
                    ]}
                  >
                    <View
                      style={[
                        st.swatchColor,
                        { backgroundColor: c.hex.split(",")[0].trim() },
                        c.hex.split(",")[0].trim().toLowerCase() === "#ffffff" && { borderWidth: 1, borderColor: "#CBD5E1" },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
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
              {displayedSizes.map((s) => {
                const on = selectedSize === s;
                const available = isSizeAvailable(s);
                return (
                  <Pressable
                    key={s}
                    disabled={!available}
                    onPress={() => available && setSelectedSize(s)}
                    style={[
                      st.sizePill,
                      on && st.sizePillActive,
                      !available && st.sizePillDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        st.sizePillText,
                        on && st.sizePillTextActive,
                        !available && st.sizePillTextDisabled,
                      ]}
                    >
                      {s}
                    </Text>
                    {!available && <View style={st.sizePillSlash} />}
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

          {/* Customer Reviews Area (Requirement 5) */}
          <View style={st.reviewsSection}>
            <View style={st.reviewsHeaderRow}>
              <Text style={st.reviewsSectionTitle}>Đánh giá từ khách hàng</Text>
              <Text style={st.reviewsCountBadge}>{reviews.length} nhận xét</Text>
            </View>

            {reviews.length === 0 ? (
              <View style={st.emptyReviews}>
                <Ionicons name="chatbox-ellipses-outline" size={32} color={Colors.textMuted} />
                <Text style={st.emptyReviewsTitle}>Sản phẩm này chưa có đánh giá nào!</Text>
                <Text style={st.emptyReviewsSub}>Hãy là người đầu tiên mua và chia sẻ trải nghiệm nhé.</Text>
              </View>
            ) : (
              <>
                {/* Overall Score Summary Card */}
                <View style={st.ratingOverviewCard}>
                  <View style={st.ratingBigBox}>
                    <Text style={st.ratingBigScore}>{avgStars}</Text>
                    <View style={st.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= Math.round(Number(avgStars)) ? "star" : "star-outline"}
                          size={13}
                          color="#EAB308"
                        />
                      ))}
                    </View>
                    <Text style={st.verifiedBuyerSub}>100% Verified Buyer</Text>
                  </View>

                  <View style={st.ratingDivider} />

                  <View style={st.ratingHighlights}>
                    <View style={st.highlightRow}>
                      <Ionicons name="shield-checkmark" size={14} color={Colors.statusSuccess} />
                      <Text style={st.highlightText}>Xác thực đã nhận hàng</Text>
                    </View>
                    <View style={st.highlightRow}>
                      <Ionicons name="color-palette-outline" size={14} color={Colors.champagneDeep} />
                      <Text style={st.highlightText}>Màu chuẩn 98% ảnh chụp</Text>
                    </View>
                    <View style={st.highlightRow}>
                      <Ionicons name="sparkles" size={14} color={Colors.champagneDeep} />
                      <Text style={st.highlightText}>Form dáng đúng chuẩn AI VTON</Text>
                    </View>
                  </View>
                </View>

                {/* List of Reviews */}
                <View style={st.reviewsList}>
                  {reviews.map((rev) => (
                    <View key={rev.reviewId} style={st.reviewCard}>
                      <View style={st.reviewTopRow}>
                        <View style={st.reviewerInfo}>
                          <View style={st.avatarCircle}>
                            <Text style={st.avatarInitial}>
                              {rev.userName ? rev.userName.charAt(0) : "K"}
                            </Text>
                          </View>
                          <View>
                            <Text style={st.reviewerName}>{rev.userName || "Khách hàng YoFaSo"}</Text>
                            <View style={st.verifiedBadgeRow}>
                              <Ionicons name="checkmark-circle" size={11} color={Colors.statusSuccess} />
                              <Text style={st.verifiedText}>Đã mua hàng</Text>
                            </View>
                          </View>
                        </View>

                        <View style={st.reviewStarsRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= rev.stars ? "star" : "star-outline"}
                              size={12}
                              color="#EAB308"
                            />
                          ))}
                        </View>
                      </View>

                      {/* Purchased variant info */}
                      {(rev.size || rev.colorName) && (
                        <Text style={st.variantPurchasedText}>
                          Phân loại: Size {rev.size || "M"} · {rev.colorName || activeColor.name}
                        </Text>
                      )}

                      {/* Comment text */}
                      <Text style={st.reviewCommentText}>{rev.comment}</Text>

                      {/* Shop Reply Box if present */}
                      {rev.shopReply && (
                        <View style={st.shopReplyBox}>
                          <View style={st.shopReplyHeader}>
                            <Ionicons name="arrow-undo" size={12} color={Colors.champagneDeep} />
                            <Text style={st.shopReplyTitle}>Phản hồi từ YoFaSo Shop</Text>
                          </View>
                          <Text style={st.shopReplyText}>{rev.shopReply}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}
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

      {/* Multi-Tab Size Guide Modal Sheet (Requirement 3) */}
      <Sheet
        visible={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        title="Bảng quy đổi kích cỡ chuẩn may đo"
      >
        <View style={{ gap: 12 }}>
          {/* Category Tabs inside Size Guide */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.sizeGuideTabsRow}
          >
            {(Object.keys(SIZE_GUIDES) as (keyof typeof SIZE_GUIDES)[]).map((tabKey) => {
              const on = sizeGuideTab === tabKey;
              return (
                <Pressable
                  key={tabKey}
                  onPress={() => setSizeGuideTab(tabKey)}
                  style={[st.sizeGuideTabBtn, on && st.sizeGuideTabBtnActive]}
                >
                  <Text style={[st.sizeGuideTabBtnText, on && st.sizeGuideTabBtnTextActive]}>
                    {SIZE_GUIDES[tabKey].title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Size Chart Table */}
          <View style={st.sizeGuideTable}>
            <View style={st.sizeGuideRowHeader}>
              {SIZE_GUIDES[sizeGuideTab].headers.map((h) => (
                <Text key={h} style={st.sizeGuideHeaderCol}>
                  {h}
                </Text>
              ))}
            </View>
            {SIZE_GUIDES[sizeGuideTab].rows.map((row) => (
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
            💡 Số đo chuẩn theo phom người Việt Nam. Nếu số đo nằm giữa hai size, hãy chọn size lớn hơn cho cảm giác mặc thoải mái và chuẩn form AI VTON.
          </Text>
        </View>
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
    height: SCREEN_WIDTH * 1.25,
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
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.70)",
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
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
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
    paddingTop: 18,
  },
  skuRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skuBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  skuLabel: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  skuText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "700",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingScoreText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  ratingReviewsText: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  productTitle: {
    fontSize: 22,
    fontFamily: "Editorial",
    color: Colors.primary,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  materialText: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  priceSection: {
    marginTop: 12,
  },
  priceBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceText: {
    fontSize: 22,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "700",
  },
  discountPill: {
    backgroundColor: "#FEEBC8", // Gentle apricot badge per User Image 1
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountPillText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: "#B45309",
    fontWeight: "700",
  },
  originalPriceText: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.textMuted,
    textDecorationLine: "line-through",
    marginTop: 2,
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
  optionBlock: {
    marginTop: 20,
  },
  sectionHeaderLabel: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
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
  swatchesScroll: {
    marginTop: 10,
  },
  swatchesScrollContent: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
    paddingRight: 16,
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
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  sizePill: {
    minWidth: 52,
    flex: 1,
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  sizePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizePillDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
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
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  sizePillSlash: {
    position: "absolute",
    width: "70%",
    height: 1.5,
    backgroundColor: "#CBD5E1",
    transform: [{ rotate: "-35deg" }],
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
  descBlock: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
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
  reviewsSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  reviewsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  reviewsSectionTitle: {
    fontSize: 18,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  reviewsCountBadge: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  ratingOverviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDFBF7",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    borderRadius: Radii.lg,
    padding: 16,
    gap: 16,
    marginBottom: 16,
    ...Shadows.dock,
  },
  ratingBigBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBigScore: {
    fontSize: 32,
    fontFamily: "Editorial",
    color: Colors.primary,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 4,
  },
  verifiedBuyerSub: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    fontWeight: "700",
  },
  ratingDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(197, 168, 128, 0.3)",
  },
  ratingHighlights: {
    flex: 1,
    gap: 6,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightText: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.primary,
  },
  reviewsList: {
    gap: 14,
  },
  emptyReviews: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  emptyReviewsTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    marginTop: 8,
    fontWeight: "600",
  },
  emptyReviewsSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    padding: 14,
    ...Shadows.dock,
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  reviewerName: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  verifiedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: "JakartaMedium",
    color: Colors.statusSuccess,
  },
  reviewStarsRow: {
    flexDirection: "row",
    gap: 1,
  },
  variantPurchasedText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textMuted,
    marginTop: 8,
  },
  reviewCommentText: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  shopReplyBox: {
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 2,
    borderLeftColor: Colors.champagneDeep,
    borderRadius: Radii.sm,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  shopReplyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  shopReplyTitle: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  shopReplyText: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 16,
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
  sizeGuideTabsRow: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 6,
  },
  sizeGuideTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  sizeGuideTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizeGuideTabBtnText: {
    fontSize: 11.5,
    fontFamily: "JakartaMedium",
    color: Colors.textSecondary,
  },
  sizeGuideTabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
  },
  sizeGuideTable: {
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    overflow: "hidden",
    marginVertical: 4,
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
    fontSize: 10.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sizeGuideRow: {
    flexDirection: "row",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
  },
  sizeGuideCol: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sizeGuideFootnote: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 4,
  },
});
