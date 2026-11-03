import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import type { Page, Product } from "@/lib/models";
import { Colors, Radii } from "@/constants/theme";
import { SAN_PHAM_MOCK } from "@/lib/catalog-data";
import { Sheet } from "./ui";
import { ShirtIcon, PantsSkirtIcon, DressIcon } from "./FashionIcons";
import { ShopHeader } from "./ShopHeader";
import {
  ProductCard,
  CARD_WIDTH,
  COLOR_PALETTE,
  mapApiProduct,
  type UnifiedProduct,
} from "./ProductCard";

export { ProductCard, CARD_WIDTH, type UnifiedProduct };

export interface CatalogProps {
  initialGender?: string;
  initialSort?: string;
  initialCategory?: string;
  initialSearch?: string;
}

export const Catalog = memo(function Catalog({
  initialGender,
  initialSort,
  initialCategory,
  initialSearch,
}: CatalogProps) {
  const routeParams = useLocalSearchParams<{
    gender?: string;
    sort?: string;
    category?: string;
    q?: string;
  }>();

  // Search & Filters state
  const [q, setQ] = useState(initialSearch || routeParams.q || "");
  const [search, setSearch] = useState(initialSearch || routeParams.q || "");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || routeParams.category || "all"
  );
  const [selectedGender, setSelectedGender] = useState<string>(
    initialGender || routeParams.gender || "all"
  );
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedFit, setSelectedFit] = useState<string>("");
  const [selectedPattern, setSelectedPattern] = useState<string>("");
  const [sortOption, setSortOption] = useState<
    "newest" | "best_selling" | "price_asc" | "price_desc"
  >(
    (initialSort || routeParams.sort) === "best_selling"
      ? "best_selling"
      : (initialSort || routeParams.sort) === "price_asc"
      ? "price_asc"
      : (initialSort || routeParams.sort) === "price_desc"
      ? "price_desc"
      : "newest"
  );
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Sync state if routeParams update
  useEffect(() => {
    if (routeParams.gender && routeParams.gender !== selectedGender) {
      setSelectedGender(routeParams.gender);
    }
    if (routeParams.sort && routeParams.sort !== sortOption) {
      setSortOption(routeParams.sort as any);
    }
    if (routeParams.category && routeParams.category !== selectedCategory) {
      setSelectedCategory(routeParams.category);
    }
    if (routeParams.q && routeParams.q !== search) {
      setQ(routeParams.q);
      setSearch(routeParams.q);
    }
  }, [routeParams.gender, routeParams.sort, routeParams.category, routeParams.q]);

  // Catalog Pagination state
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<UnifiedProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Fallback mock items if backend offline
  const getMockFilteredItems = useCallback(
    (pageNum: number): { items: UnifiedProduct[]; total: number } => {
      let filtered = SAN_PHAM_MOCK.filter((p) => {
        if (selectedCategory !== "all" && p.loai !== selectedCategory) return false;
        if (search) {
          const needle = search.toLowerCase();
          if (
            !p.tenSanPham.toLowerCase().includes(needle) &&
            !p.maSanPham.toLowerCase().includes(needle)
          ) {
            return false;
          }
        }
        if (selectedColor) {
          const hasColor = p.bienThe.some(
            (b) =>
              b.tenMau.toLowerCase().includes(selectedColor.toLowerCase()) ||
              b.maMauHex === selectedColor
          );
          if (!hasColor) return false;
        }
        if (selectedFit && p.formDang !== selectedFit) return false;
        return true;
      });

      const mockTotal = filtered.length;
      const pageSize = 20;
      const paged = filtered.slice(pageNum * pageSize, (pageNum + 1) * pageSize);

      const mapped = paged.map((p, i) => {
        const colorDots = p.bienThe.map((b) => ({ hex: b.maMauHex, name: b.tenMau }));
        const hasDiscount = i % 2 === 0;
        const originalPrice = hasDiscount ? Math.round(p.giaBan * 1.25) : undefined;
        const discountPercent = hasDiscount ? 20 : undefined;
        const skuNumber = String(i + 1).padStart(4, "0");
        const sku = `YFS-${
          p.loai === "upper_body" ? "UB" : p.loai === "lower_body" ? "LB" : "DR"
        }-${skuNumber}`;

        return {
          id: p.maSanPham,
          name: p.tenSanPham,
          material: p.chatLieu || "Thời trang thiết kế YoFaSo",
          price: p.giaBan,
          originalPrice,
          hasDiscount,
          discountPercent,
          sku,
          avgRating: 0,
          reviewCount: 0,
          soldCount: 0,
          image: p.hinhAnh,
          vtonCategory: p.loai,
          colorSwatches: colorDots,
          isMock: true,
        };
      });

      return { items: mapped, total: mockTotal };
    },
    [search, selectedCategory, selectedColor, selectedFit]
  );

  // Fetch Catalog data (Full paginated feed)
  const fetchProducts = useCallback(
    async (targetPage: number, isRefresh = false) => {
      if (targetPage === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (selectedCategory !== "all") params.append("vtonCategory", selectedCategory);
      if (selectedGender !== "all") params.append("gender", selectedGender);
      if (selectedColor) params.append("color", selectedColor);
      if (selectedFit) params.append("fit", selectedFit);
      if (selectedPattern) params.append("pattern", selectedPattern);
      params.append("sort", sortOption);
      params.append("page", String(targetPage));
      params.append("limit", "20");

      try {
        const res = await api<Page<Product>>(`/catalog/products?${params.toString()}`);
        if (res && Array.isArray(res.items) && res.items.length > 0) {
          const mapped = res.items.map((p, idx) =>
            mapApiProduct(p, targetPage * 20 + idx)
          );
          if (targetPage === 0 || isRefresh) {
            setItems(mapped);
          } else {
            setItems((prev) => [...prev, ...mapped]);
          }
          setTotalCount(res.total ?? mapped.length);
          setHasMore((targetPage + 1) * 20 < res.total);
        } else {
          const mockResult = getMockFilteredItems(targetPage);
          if (targetPage === 0 || isRefresh) {
            setItems(mockResult.items);
          } else {
            setItems((prev) => [...prev, ...mockResult.items]);
          }
          setTotalCount(mockResult.total);
          setHasMore((targetPage + 1) * 20 < mockResult.total);
        }
      } catch {
        const mockResult = getMockFilteredItems(targetPage);
        if (targetPage === 0 || isRefresh) {
          setItems(mockResult.items);
        } else {
          setItems((prev) => [...prev, ...mockResult.items]);
        }
        setTotalCount(mockResult.total);
        setHasMore((targetPage + 1) * 20 < mockResult.total);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [
      search,
      selectedCategory,
      selectedGender,
      selectedColor,
      selectedFit,
      selectedPattern,
      sortOption,
      getMockFilteredItems,
    ]
  );

  // Trigger initial fetch
  useEffect(() => {
    setPage(0);
    fetchProducts(0);
  }, [fetchProducts]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchProducts(0, true);
  };

  const handleOpenProduct = (item: UnifiedProduct) => {
    router.push({
      pathname: "/product/[id]",
      params: { id: item.id },
    });
  };

  const handleTryOnProduct = (item: UnifiedProduct) => {
    router.push({
      pathname: "/try-on",
      params: { variantId: item.sku || item.id, category: item.vtonCategory },
    });
  };

  const renderCatalogItem = useCallback(
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
      {/* Sticky Header with Search & Filters */}
      <ShopHeader showLogo title="YoFaSo" badgeText="Your Fashion, Your Own Soul">
        {/* Search Bar + Filter Toggle Button */}
        <View style={st.searchBarRow}>
          <View style={st.searchPill}>
            <Ionicons name="search" size={17} color={Colors.textMuted} />
            <TextInput
              placeholder="Tìm theo tên sản phẩm, mã SKU..."
              placeholderTextColor={Colors.textMuted}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => setSearch(q)}
              style={st.searchInput}
              returnKeyType="search"
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bộ lọc nâng cao"
            onPress={() => setFilterSheetVisible(true)}
            style={[
              st.filterToggleBtn,
              (selectedColor ||
                selectedFit ||
                selectedPattern ||
                selectedGender !== "all" ||
                sortOption !== "newest") &&
                st.filterToggleBtnActive,
            ]}
          >
            <Ionicons
              name="options-outline"
              size={19}
              color={
                selectedColor ||
                selectedFit ||
                selectedPattern ||
                selectedGender !== "all" ||
                sortOption !== "newest"
                  ? "#FFFFFF"
                  : Colors.primary
              }
            />
          </Pressable>
        </View>

        {/* Gender Selection Tabs (All / Nữ / Nam) */}
        <View style={st.genderFilterRow}>
          {[
            { id: "all", label: "Tất cả đồ" },
            { id: "NU", label: "Thời trang Nữ" },
            { id: "NAM", label: "Thời trang Nam" },
          ].map((g) => {
            const on = selectedGender === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGender(g.id)}
                style={[st.genderPill, on && st.genderPillActive]}
              >
                <Text style={[st.genderPillText, on && st.genderPillTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 3 Silhouette VTON Category Selector Cards */}
        <View style={st.catCardsRow}>
          {[
            { id: "upper_body", vi: "Áo", en: "Upper Body", Icon: ShirtIcon },
            { id: "lower_body", vi: "Quần & Váy", en: "Lower Body", Icon: PantsSkirtIcon },
            { id: "dress", vi: "Đầm liền", en: "Dresses", Icon: DressIcon },
          ].map((c) => {
            const on = selectedCategory === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCategory(on ? "all" : c.id)}
                style={[st.catCard, on && st.catCardActive]}
              >
                <c.Icon size={22} color={on ? "#FFFFFF" : Colors.champagneDeep} />
                <Text style={[st.catCardVi, on && { color: "#FFFFFF" }]}>{c.vi}</Text>
                <Text
                  style={[
                    st.catCardEn,
                    on && { color: "rgba(255, 255, 255, 0.75)" },
                  ]}
                >
                  {c.en}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ShopHeader>

      {/* Main FlatList Feed with 2-Column Grid */}
      <FlatList
        data={items}
        keyExtractor={(item, idx) => `${item.id}-${item.sku}-${idx}`}
        numColumns={2}
        columnWrapperStyle={st.columnWrapper}
        renderItem={renderCatalogItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.feedContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.champagneDeep}
            colors={[Colors.champagneDeep]}
          />
        }
        ListHeaderComponent={
          <View style={st.sectionHeader}>
            <View>
              <Text style={st.sectionTitle}>
                {selectedCategory === "all"
                  ? selectedGender === "NU"
                    ? "Tất cả thời trang Nữ"
                    : selectedGender === "NAM"
                    ? "Tất cả thời trang Nam"
                    : "Toàn bộ danh mục sản phẩm"
                  : selectedCategory === "upper_body"
                  ? selectedGender === "NU"
                    ? "Áo nữ thời thượng"
                    : selectedGender === "NAM"
                    ? "Áo nam lịch lãm"
                    : "Nhóm Áo VTON"
                  : selectedCategory === "lower_body"
                  ? selectedGender === "NU"
                    ? "Quần & Chân váy nữ"
                    : selectedGender === "NAM"
                    ? "Quần âu & jeans nam"
                    : "Quần & Váy VTON"
                  : "Đầm Liền Thân"}
              </Text>
              <Text style={st.sectionCount}>
                {totalCount > 0
                  ? `Hiển thị ${items.length} / ${totalCount} sản phẩm`
                  : "Đang tải dữ liệu..."}
              </Text>
            </View>

            <Pressable
              onPress={() => setFilterSheetVisible(true)}
              style={st.sortChip}
            >
              <Ionicons name="swap-vertical" size={13} color={Colors.primary} />
              <Text style={st.sortChipText}>
                {sortOption === "newest"
                  ? "Mới nhất"
                  : sortOption === "best_selling"
                  ? "Bán chạy"
                  : sortOption === "price_asc"
                  ? "Giá tăng"
                  : "Giá giảm"}
              </Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingTop: 16, paddingBottom: 80, gap: 12 }}>
            {loadingMore && (
              <View style={st.loadingMoreBox}>
                <ActivityIndicator size="small" color={Colors.champagneDeep} />
                <Text style={st.loadingMoreText}>Đang tải thêm sản phẩm...</Text>
              </View>
            )}

            {!hasMore && items.length > 0 && (
              <Text style={st.endOfListText}>
                — Đã tải toàn bộ {totalCount} thiết kế —
              </Text>
            )}
          </View>
        }
      />

      {/* FILTER BOTTOM SHEET MODAL */}
      <Sheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="Bộ lọc & Sắp xếp nâng cao"
      >
        <ScrollView style={st.sheetBody} showsVerticalScrollIndicator={false}>
          {/* Sắp xếp */}
          <Text style={st.sheetSectionTitle}>Sắp xếp theo</Text>
          <View style={st.sheetOptionsWrap}>
            {[
              { id: "newest", label: "Mới nhất tuần này" },
              { id: "best_selling", label: "Bán chạy nhất" },
              { id: "price_asc", label: "Giá: Thấp đến Cao" },
              { id: "price_desc", label: "Giá: Cao đến Thấp" },
            ].map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setSortOption(opt.id as any)}
                style={[
                  st.sheetOptionChip,
                  sortOption === opt.id && st.sheetOptionChipActive,
                ]}
              >
                <Text
                  style={[
                    st.sheetOptionChipText,
                    sortOption === opt.id && st.sheetOptionChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Giới tính */}
          <Text style={st.sheetSectionTitle}>Giới tính trang phục</Text>
          <View style={st.sheetOptionsWrap}>
            {[
              { id: "all", label: "Tất cả" },
              { id: "NU", label: "Thời trang Nữ" },
              { id: "NAM", label: "Thời trang Nam" },
            ].map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGender(g.id)}
                style={[
                  st.sheetOptionChip,
                  selectedGender === g.id && st.sheetOptionChipActive,
                ]}
              >
                <Text
                  style={[
                    st.sheetOptionChipText,
                    selectedGender === g.id && st.sheetOptionChipTextActive,
                  ]}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Nhóm trang phục VTON */}
          <Text style={st.sheetSectionTitle}>Vùng cơ thể (VTON Router)</Text>
          <View style={st.sheetOptionsWrap}>
            {[
              { id: "all", label: "Tất cả nhóm" },
              { id: "upper_body", label: "Áo (Upper Body)" },
              { id: "lower_body", label: "Quần & Váy (Lower Body)" },
              { id: "dress", label: "Đầm liền (Dress)" },
            ].map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  st.sheetOptionChip,
                  selectedCategory === cat.id && st.sheetOptionChipActive,
                ]}
              >
                <Text
                  style={[
                    st.sheetOptionChipText,
                    selectedCategory === cat.id && st.sheetOptionChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Gam màu */}
          <Text style={st.sheetSectionTitle}>Gam màu chủ đạo</Text>
          <View style={st.colorPaletteWrap}>
            {COLOR_PALETTE.map((c) => {
              const active = selectedColor === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedColor(c.id)}
                  style={[st.colorPaletteChip, active && st.colorPaletteChipActive]}
                >
                  {c.hex !== "transparent" && (
                    <View
                      style={[
                        st.colorDot,
                        { backgroundColor: c.hex },
                        c.hex.toLowerCase() === "#ffffff" && st.whiteSwatchBorder,
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      st.colorPaletteText,
                      active && st.colorPaletteTextActive,
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Form dáng (Fit) */}
          <Text style={st.sheetSectionTitle}>Form dáng (Fit tỉ lệ)</Text>
          <View style={st.sheetOptionsWrap}>
            {[
              { id: "", label: "Tất cả form" },
              { id: "OM_SAT", label: "Ôm sát (Fitted)" },
              { id: "SUONG_VUA", label: "Suông vừa (Regular)" },
              { id: "RONG_OVERSIZE", label: "Rộng (Oversize)" },
            ].map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setSelectedFit(f.id)}
                style={[
                  st.sheetOptionChip,
                  selectedFit === f.id && st.sheetOptionChipActive,
                ]}
              >
                <Text
                  style={[
                    st.sheetOptionChipText,
                    selectedFit === f.id && st.sheetOptionChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Nút đặt lại & Áp dụng */}
          <View style={st.sheetActionsRow}>
            <Pressable
              onPress={() => {
                setSelectedColor("");
                setSelectedFit("");
                setSelectedPattern("");
                setSelectedGender("all");
                setSelectedCategory("all");
                setSortOption("newest");
                setFilterSheetVisible(false);
              }}
              style={st.resetFiltersBtn}
            >
              <Text style={st.resetFiltersBtnText}>Đặt lại</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFilterSheetVisible(false);
              }}
              style={st.applyFiltersBtn}
            >
              <Text style={st.applyFiltersBtnText}>Áp dụng bộ lọc</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
});

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF9",
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
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
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.primary,
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  filterToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  genderPillActive: {
    backgroundColor: Colors.champagneSubtle,
    borderColor: Colors.champagneDeep,
  },
  genderPillText: {
    fontSize: 11.5,
    fontFamily: "JakartaMedium",
    color: Colors.textSecondary,
  },
  genderPillTextActive: {
    color: Colors.primary,
    fontFamily: "JakartaSemiBold",
  },
  catCardsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  catCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catCardVi: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    marginTop: 3,
  },
  catCardEn: {
    fontSize: 8.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  whiteSwatchBorder: {
    borderWidth: 0.8,
    borderColor: "#D1D5DB",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    marginTop: 1,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  sortChipText: {
    fontSize: 11,
    fontFamily: "JakartaMedium",
    color: Colors.primary,
  },
  loadingMoreBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  loadingMoreText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  endOfListText: {
    textAlign: "center",
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    paddingVertical: 10,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    marginTop: 14,
    marginBottom: 8,
  },
  sheetOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sheetOptionChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  sheetOptionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sheetOptionChipText: {
    fontSize: 11.5,
    fontFamily: "JakartaMedium",
    color: Colors.textSecondary,
  },
  sheetOptionChipTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
  },
  colorPaletteWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorPaletteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  colorPaletteChipActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorPaletteText: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  colorPaletteTextActive: {
    color: Colors.primary,
    fontFamily: "JakartaSemiBold",
  },
  sheetActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  resetFiltersBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  resetFiltersBtnText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
  },
  applyFiltersBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyFiltersBtnText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
});
