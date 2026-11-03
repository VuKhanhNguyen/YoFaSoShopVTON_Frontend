import { memo } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND } from "@/lib/catalog-data";
import { publicUrl } from "@/lib/api";
import type { Product } from "@/lib/models";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export const COLOR_PALETTE = [
  { id: "", name: "Tất cả màu", hex: "transparent" },
  { id: "Trắng", name: "Trắng", hex: "#FFFFFF" },
  { id: "Đen", name: "Đen", hex: "#111827" },
  { id: "Be", name: "Be kem", hex: "#EAD8C3" },
  { id: "Nâu", name: "Nâu đất", hex: "#78350F" },
  { id: "Xanh", name: "Xanh navy", hex: "#1E3A8A" },
  { id: "Xám", name: "Xám tiêu", hex: "#6B7280" },
  { id: "Rêu", name: "Xanh rêu", hex: "#3F6212" },
  { id: "Hồng", name: "Hồng pastel", hex: "#F472B6" },
];

export interface UnifiedProduct {
  id: string;
  name: string;
  material: string;
  price: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountPercent?: number;
  sku: string;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
  image: any;
  vtonCategory: string;
  gender?: "NAM" | "NU" | "UNISEX";
  colorSwatches?: { hex: string; name: string }[];
  isMock?: boolean;
}

export function mapApiProduct(p: Product, idx: number = 0): UnifiedProduct {
  const img = p.coverUrl ? publicUrl(p.coverUrl) : EditorialImages.shirt;
  const representativeSku =
    p.sku ||
    (p.variants && p.variants[0]?.sku) ||
    `YFS-PR-${String(idx + 1).padStart(4, "0")}`;
  const rawRating = Number(p.avgRating);
  const avgRating = !isNaN(rawRating) && rawRating > 0 ? rawRating : 0;
  const soldCount = typeof p.soldCount === "number" ? p.soldCount : (Number(p.soldCount) || 0);

  const colors: { hex: string; name: string }[] = [];
  if (p.colorSwatches && Array.isArray(p.colorSwatches)) {
    p.colorSwatches.forEach((c) => {
      if (typeof c === "object" && c.hex) {
        colors.push({ hex: c.hex, name: c.name || "" });
      }
    });
  } else if (p.variants && p.variants.length > 0) {
    const seen = new Set<string>();
    p.variants.forEach((v) => {
      if (v.colors && !seen.has(v.colors)) {
        seen.add(v.colors);
        colors.push({ hex: v.colors, name: v.colorName || "" });
      }
    });
  }

  return {
    id: p.productId,
    name: p.name,
    material: p.material || p.fit || "Chất liệu cao cấp",
    price: p.minPrice ? Number(p.minPrice) : 350000,
    originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
    hasDiscount: Boolean(p.hasDiscount),
    discountPercent: p.discountPercent || 0,
    sku: representativeSku,
    avgRating,
    reviewCount: p.reviewCount || 0,
    soldCount,
    image: img,
    vtonCategory: p.vtonCategory || "upper_body",
    gender: p.gender as any,
    colorSwatches: colors,
    isMock: false,
  };
}

export interface ProductCardProps {
  item: UnifiedProduct;
  index?: number;
  onOpen: () => void;
  onTry: () => void;
  /** Bật hiệu ứng so le (stagger) 18px cho cột bên phải theo phong cách Editorial. Mặc định: true */
  stagger?: boolean;
  /** Độ rộng tùy biến của card (mặc định theo CARD_WIDTH) */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export const ProductCard = memo(function ProductCard({
  item,
  index = 0,
  onOpen,
  onTry,
  stagger = true,
  width,
  style,
}: ProductCardProps) {
  const isRightCol = index % 2 === 1;
  const cardW = width ?? CARD_WIDTH;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem ${item.name}`}
      onPress={onOpen}
      style={[
        st.cardWrapper,
        { width: cardW },
        stagger && isRightCol && st.staggerMargin,
        style,
      ]}
    >
      <View style={[st.imageContainer, { width: cardW, height: cardW * 1.35 }]}>
        {typeof item.image === "number" ? (
          <Image source={item.image} style={st.cardImage} resizeMode="cover" />
        ) : (
          <Image
            source={{ uri: item.image }}
            style={st.cardImage}
            resizeMode="cover"
          />
        )}

        {/* VTON Badge */}
        <View style={st.cardBadge}>
          <Ionicons name="sparkles" size={9} color={Colors.champagneDeep} />
          <Text style={st.cardBadgeText}>VTON</Text>
        </View>

        {/* Discount Badge */}
        {item.hasDiscount && item.discountPercent ? (
          <View style={st.cardDiscountBadge}>
            <Text style={st.cardDiscountText}>-{item.discountPercent}%</Text>
          </View>
        ) : null}

        {/* Overlay Try-On Pill */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ướm thử AI"
          onPress={(e) => {
            e.stopPropagation();
            onTry();
          }}
          style={st.overlayTryPill}
        >
          <Ionicons name="sparkles" size={10} color={Colors.primary} />
          <Text style={st.overlayTryText}>Ướm thử AI</Text>
        </Pressable>
      </View>

      {/* Info Section */}
      <View style={st.cardInfo}>
        <Text numberOfLines={2} style={st.cardTitle}>
          {item.name}
        </Text>

        <Text style={st.cardSku}>{item.sku || item.id}</Text>

        {/* Rating & Sold Count */}
        <View style={st.ratingSoldCountRow}>
          {item.avgRating > 0 ? (
            <View style={st.starRow}>
              <Ionicons name="star" size={11} color="#EAB308" />
              <Text style={st.ratingVal}>{item.avgRating.toFixed(1)}</Text>
            </View>
          ) : (
            <View style={st.starRow}>
              <Ionicons name="sparkles" size={10} color={Colors.champagneDeep} />
              <Text style={st.ratingNew}>Mới</Text>
            </View>
          )}
          <Text style={st.ratingDot}>•</Text>
          <Text style={st.soldCountText}>Đã bán {item.soldCount}</Text>
        </View>

        {/* Color Swatches */}
        {item.colorSwatches && item.colorSwatches.length > 0 && (
          <View style={st.swatchesRow}>
            {item.colorSwatches.slice(0, 4).map((sw, sIdx) => {
              const hexPrimary = sw.hex.split(",")[0] || "#999999";
              return (
                <View
                  key={sIdx}
                  style={[
                    st.swatchDot,
                    { backgroundColor: hexPrimary },
                    hexPrimary.toLowerCase() === "#ffffff" && st.whiteSwatchBorder,
                  ]}
                />
              );
            })}
            {item.colorSwatches.length > 4 && (
              <Text style={st.swatchMoreText}>+{item.colorSwatches.length - 4}</Text>
            )}
          </View>
        )}

        {/* Price Row */}
        <View style={st.cardPriceRow}>
          <Text style={st.cardPrice}>{formatVND(item.price)}</Text>
          {item.originalPrice && item.originalPrice > item.price && (
            <Text style={st.cardOldPrice}>{formatVND(item.originalPrice)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const st = StyleSheet.create({
  cardWrapper: {
    marginBottom: 14,
  },
  staggerMargin: {
    marginTop: 18,
  },
  imageContainer: {
    borderRadius: Radii.lg,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radii.full,
  },
  cardBadgeText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cardDiscountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#DC2626",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  cardDiscountText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  overlayTryPill: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    ...Shadows.dock,
  },
  overlayTryText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  cardInfo: {
    marginTop: 8,
    gap: 2,
  },
  cardTitle: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    lineHeight: 17,
  },
  cardSku: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  ratingSoldCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingVal: {
    fontSize: 10.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  ratingNew: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
    letterSpacing: 0.2,
  },
  ratingDot: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  soldCountText: {
    fontSize: 10,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  swatchesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  swatchDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  whiteSwatchBorder: {
    borderWidth: 0.8,
    borderColor: "#D1D5DB",
  },
  swatchMoreText: {
    fontSize: 8.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  cardPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  cardPrice: {
    fontSize: 13.5,
    fontFamily: "JakartaBold",
    color: Colors.primary,
  },
  cardOldPrice: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
});
