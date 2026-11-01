import { memo, useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useResource } from "@/hooks/use-resource";
import { publicUrl } from "@/lib/api";
import { money, type Page, type Product, type Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import {
  EditorialImages,
  SAN_PHAM_MOCK,
  SanPham,
  formatVND,
} from "@/lib/catalog-data";
import { Badge, Button, Sheet, colors } from "./ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface UnifiedProduct {
  id: string;
  name: string;
  material: string;
  price: number;
  image: any;
  vtonCategory: string;
  isMock?: boolean;
}

const ProductCard = memo(function ProductCard({
  item,
  index,
  onOpen,
  onTry,
}: {
  item: UnifiedProduct;
  index: number;
  onOpen: () => void;
  onTry: () => void;
}) {
  const isRightCol = index % 2 === 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem ${item.name}`}
      onPress={onOpen}
      style={[
        st.cardWrapper,
        {
          marginTop: isRightCol ? 28 : 0, // Asymmetric Staggered Feed (Design.md)
        },
      ]}
    >
      <View style={st.imageContainer}>
        {typeof item.image === "number" ? (
          <Image source={item.image} style={st.cardImage} resizeMode="cover" />
        ) : (
          <Image
            source={{ uri: item.image }}
            style={st.cardImage}
            resizeMode="cover"
          />
        )}

        <View style={st.cardBadge}>
          <Ionicons name="sparkles" size={10} color={Colors.champagneDeep} />
          <Text style={st.cardBadgeText}>VTON Ready</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ướm thử ngay"
          onPress={(e) => {
            e.stopPropagation();
            onTry();
          }}
          style={st.quickTryBtn}
        >
          <Ionicons name="shirt-outline" size={14} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={st.cardInfo}>
        <Text numberOfLines={2} style={st.cardTitle}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={st.cardMaterial}>
          {item.material}
        </Text>
        <Text style={st.cardPrice}>{formatVND(item.price)}</Text>
      </View>
    </Pressable>
  );
});

export function Catalog({ discover = false }: { discover?: boolean }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [sortOption, setSortOption] = useState<"vton" | "new" | "price">("vton");

  // Filter criteria
  const [selectedFit, setSelectedFit] = useState<string>("");
  const [selectedPattern, setSelectedPattern] = useState<string>("");

  // Backend API query
  const query = `/catalog/products?q=${encodeURIComponent(search)}&categoryId=${encodeURIComponent(
    selectedCategory === "all" ? "" : selectedCategory
  )}&limit=20`;
  const state = useResource<Page<Product>>(query);
  const cartState = useResource<Row[]>("/cart");
  const notifState = useResource<Row[]>("/notifications?size=10");

  const cartCount =
    cartState.data?.reduce((s, r) => s + Number(r.quantity || 1), 0) ?? 0;
  const unreadNotif =
    notifState.data?.some((n) => !n.readStatus) ?? false;

  // Build unified items list with fallback to SAN_PHAM_MOCK
  const items: UnifiedProduct[] = [];
  if (state.data && state.data.items && state.data.items.length > 0) {
    state.data.items.forEach((p) => {
      const img = p.coverUrl ? publicUrl(p.coverUrl) : EditorialImages.shirt;
      items.push({
        id: p.productId,
        name: p.name,
        material: p.material || p.fit || "Chất liệu cao cấp",
        price: p.minPrice ?? 450000,
        image: img,
        vtonCategory: p.vtonCategory || "upper_body",
        isMock: false,
      });
    });
  } else {
    // Fallback to rich mock catalog
    SAN_PHAM_MOCK.forEach((p) => {
      if (
        selectedCategory !== "all" &&
        p.loai !== selectedCategory
      ) {
        return;
      }
      if (search) {
        const needle = search.toLowerCase();
        if (
          !p.tenSanPham.toLowerCase().includes(needle) &&
          !p.maSanPham.toLowerCase().includes(needle)
        ) {
          return;
        }
      }
      items.push({
        id: p.maSanPham,
        name: p.tenSanPham,
        material: p.chatLieu || "Thời trang thiết kế YoFaSo",
        price: p.giaBan,
        image: p.hinhAnh,
        vtonCategory: p.loai,
        isMock: true,
      });
    });
  }

  const handleOpenProduct = (item: UnifiedProduct) => {
    router.push({
      pathname: "/product/[id]",
      params: { id: item.id },
    });
  };

  const handleTryOnProduct = (item: UnifiedProduct) => {
    router.push({
      pathname: "/try-on",
      params: { variantId: item.id, category: item.vtonCategory },
    });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: UnifiedProduct; index: number }) => (
      <ProductCard
        item={item}
        index={index}
        onOpen={() => handleOpenProduct(item)}
        onTry={() => handleTryOnProduct(item)}
      />
    ),
    []
  );

  return (
    <View style={st.container}>
      {/* Sticky Header */}
      <View style={st.header}>
        <View style={st.headerTop}>
          <View style={st.brandBlock}>
            <Text style={st.brandTitle}>YoFaSo</Text>
            <View style={st.badgePill}>
              <Text style={st.badgePillText}>AI Stylist Inside</Text>
            </View>
          </View>
          <View style={st.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thông báo"
              onPress={() => router.push("/inbox")}
              style={st.iconBtn}
            >
              <Ionicons name="notifications-outline" size={21} color={Colors.primary} />
              {unreadNotif && <View style={st.unreadDot} />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Túi đồ"
              onPress={() => router.push("/cart")}
              style={st.iconBtn}
            >
              <Ionicons name="bag-handle-outline" size={21} color={Colors.primary} />
              {cartCount > 0 && (
                <View style={st.cartBadge}>
                  <Text style={st.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Search Pill */}
        <View style={st.searchBarRow}>
          <View style={st.searchPill}>
            <Ionicons name="search" size={17} color={Colors.textMuted} />
            <TextInput
              placeholder="Tìm áo sơ mi, blazer, quần âu hoặc màu sắc..."
              placeholderTextColor={Colors.textMuted}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => setSearch(q)}
              style={st.searchInput}
            />
            {q ? (
              <Pressable
                onPress={() => {
                  setQ("");
                  setSearch("");
                }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {!discover && (
            <Pressable
              onPress={() => setFilterSheetVisible(true)}
              style={st.filterToggleBtn}
            >
              <Ionicons name="options-outline" size={19} color={Colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Product Feed */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.feedContent}
        ListHeaderComponent={
          discover ? (
            <View style={{ marginBottom: 16 }}>
              {/* Asymmetric Hero Lookbook Card */}
              <View style={st.heroCard}>
                <Image
                  source={EditorialImages.hero}
                  style={st.heroImage}
                  resizeMode="cover"
                />
                <View style={st.heroTagBadge}>
                  <Text style={st.heroTagText}>N°01 / SS26</Text>
                </View>

                {/* Floating Glass Box inside Hero */}
                <View style={st.heroGlassBox}>
                  <Text style={st.heroCollectionSubtitle}>BỘ SƯU TẬP 2026</Text>
                  <Text style={st.heroCollectionTitle}>Form dáng chuẩn VTON</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ướm thử vào bạn"
                    onPress={() =>
                      router.push({
                        pathname: "/try-on",
                        params: {
                          variantId: items[0]?.id || "SP00000001",
                          category: "upper_body",
                        },
                      })
                    }
                    style={st.heroCtaBtn}
                  >
                    <Text style={st.heroCtaText}>Ướm thử vào bạn</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>Mới về tuần này</Text>
                <Text style={st.sectionCount}>{items.length} thiết kế</Text>
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: 12 }}>
              {/* 3 Silhouette VTON Category Selector Cards */}
              <View style={st.catCardsRow}>
                {[
                  { id: "upper_body", vi: "Áo", en: "Upper Body", icon: "shirt-outline" as const },
                  { id: "lower_body", vi: "Quần & Váy", en: "Lower Body", icon: "layers-outline" as const },
                  { id: "dress", vi: "Đầm liền", en: "Dresses", icon: "sparkles-outline" as const },
                ].map((c) => {
                  const on = selectedCategory === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() =>
                        setSelectedCategory(on ? "all" : c.id)
                      }
                      style={[st.catCard, on && st.catCardActive]}
                    >
                      <Ionicons
                        name={c.icon}
                        size={22}
                        color={on ? Colors.champagne : Colors.champagneDeep}
                      />
                      <Text style={[st.catCardVi, on && { color: "#FFFFFF" }]}>
                        {c.vi}
                      </Text>
                      <Text
                        style={[
                          st.catCardEn,
                          on && { color: "rgba(255, 255, 255, 0.7)" },
                        ]}
                      >
                        {c.en}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>
                  {selectedCategory === "all"
                    ? "Tất cả thiết kế"
                    : selectedCategory === "upper_body"
                    ? "Nhóm Áo VTON"
                    : selectedCategory === "lower_body"
                    ? "Nhóm Quần & Váy VTON"
                    : "Nhóm Đầm Liền VTON"}
                </Text>
                <Text style={st.sectionCount}>{items.length} sản phẩm</Text>
              </View>
            </View>
          )
        }
      />

      {/* Filter Bottom Sheet */}
      <Sheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="Bộ lọc sản phẩm VTON"
      >
        <View style={{ gap: 16 }}>
          <Text style={st.filterGroupTitle}>Nhóm đồ VTON</Text>
          <View style={st.filterPillsRow}>
            {[
              { id: "all", l: "Tất cả" },
              { id: "upper_body", l: "Áo (Upper Body)" },
              { id: "lower_body", l: "Quần/Váy (Lower Body)" },
              { id: "dress", l: "Đầm liền (Dress)" },
            ].map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  st.filterPill,
                  selectedCategory === cat.id && st.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    st.filterPillText,
                    selectedCategory === cat.id && st.filterPillTextActive,
                  ]}
                >
                  {cat.l}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={st.filterGroupTitle}>Phom dáng (Fit)</Text>
          <View style={st.filterPillsRow}>
            {[
              { id: "", l: "Tất cả phom" },
              { id: "SUONG_VUA", l: "Suông vừa (Regular)" },
              { id: "OM_SAT", l: "Ôm sát (Slim)" },
              { id: "RONG_OVERSIZE", l: "Rộng (Oversize)" },
            ].map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setSelectedFit(f.id)}
                style={[st.filterPill, selectedFit === f.id && st.filterPillActive]}
              >
                <Text
                  style={[
                    st.filterPillText,
                    selectedFit === f.id && st.filterPillTextActive,
                  ]}
                >
                  {f.l}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            title="Áp dụng bộ lọc"
            onPress={() => setFilterSheetVisible(false)}
            accent
            style={{ marginTop: 16 }}
          />
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
  header: {
    backgroundColor: "rgba(250, 250, 249, 0.94)",
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.4,
  },
  badgePill: {
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  badgePillText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.statusDanger,
  },
  cartBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontFamily: "Mono",
    fontWeight: "700",
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  searchPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.full,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    ...Shadows.dock,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.primary,
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  feedContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 110, // Avoid floating dock overlap
  },
  heroCard: {
    height: 440,
    borderRadius: Radii.xl,
    overflow: "hidden",
    position: "relative",
    ...Shadows.dock,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTagBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(250, 250, 249, 0.88)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  heroTagText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  heroGlassBox: {
    position: "absolute",
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: Radii.lg,
    padding: 16,
    ...Shadows.sheet,
  },
  heroCollectionSubtitle: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    letterSpacing: 1.5,
  },
  heroCollectionTitle: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.3,
    marginTop: 2,
    marginBottom: 10,
  },
  heroCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    alignSelf: "flex-start",
  },
  heroCtaText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  catCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  catCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    padding: 12,
    alignItems: "flex-start",
    gap: 4,
  },
  catCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catCardVi: {
    fontSize: 13,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  catCardEn: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginHorizontal: 5,
    marginBottom: 16,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: Radii.lg,
    overflow: "hidden",
    position: "relative",
    backgroundColor: Colors.surfaceMuted,
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
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  cardBadgeText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  quickTryBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.dock,
  },
  cardInfo: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  cardTitle: {
    fontSize: 13.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    lineHeight: 18,
  },
  cardMaterial: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 3,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: "Mono",
    color: Colors.primary,
    marginTop: 6,
  },
  filterGroupTitle: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  filterPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
  },
});
