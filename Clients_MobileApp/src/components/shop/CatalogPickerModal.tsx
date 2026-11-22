import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import type { Page, Product } from "@/lib/models";
import {
  checkTryOnCompatibility,
  type FashionGender,
} from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { ShirtIcon, PantsSkirtIcon, DressIcon } from "./FashionIcons";
import { AnimatedToast, ScalePressable } from "./MotionPrimitives";
import { ProductGridSkeleton } from "./Skeleton";
import {
  COLOR_PALETTE,
  ProductCard,
  mapApiProduct,
  type UnifiedProduct,
} from "./ProductCard";

export interface CatalogPickerModalProps {
  visible: boolean;
  onClose: () => void;
  lockedGender: FashionGender;
  selectedProductId?: string;
  frame?: string;
  shopModelId?: string;
  chainedFromCategory?: string;
  chainedFromFrame?: string;
  onSelect: (product: UnifiedProduct) => void;
}

const CATEGORY_CARDS = [
  { id: "upper_body", vi: "Áo", en: "Upper Body", Icon: ShirtIcon },
  { id: "lower_body", vi: "Quần & Váy", en: "Lower Body", Icon: PantsSkirtIcon },
  { id: "dress", vi: "Đầm liền", en: "Dresses", Icon: DressIcon },
] as const;

export function CatalogPickerModal({
  visible,
  onClose,
  lockedGender,
  selectedProductId,
  frame,
  shopModelId,
  chainedFromCategory,
  chainedFromFrame,
  onSelect,
}: CatalogPickerModalProps) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedFit, setSelectedFit] = useState<string>("");
  const [sortOption, setSortOption] = useState<
    "newest" | "best_selling" | "price_asc" | "price_desc"
  >("newest");
  const [filterOpen, setFilterOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [items, setItems] = useState<UnifiedProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Reset incompatible category filter when gender or modal context changes
  useEffect(() => {
    if (!visible) {
      setFilterOpen(false);
      return;
    }
    if (lockedGender === "NAM" && selectedCategory === "dress") {
      setSelectedCategory("all");
    } else if (selectedCategory !== "all") {
      const compat = checkTryOnCompatibility({
        targetCategory: selectedCategory,
        frame,
        shopModelId,
        chainedFromCategory,
        chainedFromFrame,
      });
      if (!compat.allowed) setSelectedCategory("all");
    }
  }, [visible, lockedGender, frame, shopModelId, chainedFromCategory, chainedFromFrame, selectedCategory]);

  const fetchProducts = useCallback(
    async (targetPage: number, isRefresh = false) => {
      if (!visible) return;
      if (targetPage === 0) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.append("gender", lockedGender);
      if (search) params.append("q", search);
      if (selectedCategory !== "all") params.append("vtonCategory", selectedCategory);
      if (selectedColor) params.append("color", selectedColor);
      if (selectedFit) params.append("fit", selectedFit);
      params.append("sort", sortOption);
      params.append("page", String(targetPage));
      params.append("limit", "20");

      try {
        const res = await api<Page<Product>>(`/catalog/products?${params.toString()}`);
        const mapped = (res?.items || []).map((p, idx) =>
          mapApiProduct(p, targetPage * 20 + idx)
        );
        if (targetPage === 0 || isRefresh) {
          setItems(mapped);
        } else {
          setItems((prev) => [...prev, ...mapped]);
        }
        const total = res?.total ?? mapped.length;
        setTotalCount(total);
        setHasMore((targetPage + 1) * 20 < total);
      } catch (e) {
        if (targetPage === 0) {
          setItems([]);
          setTotalCount(0);
          setHasMore(false);
        }
        showToast((e as Error).message || "Không tải được danh mục sản phẩm.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [visible, lockedGender, search, selectedCategory, selectedColor, selectedFit, sortOption, showToast]
  );

  useEffect(() => {
    if (!visible) return;
    setPage(0);
    void fetchProducts(0);
  }, [visible, fetchProducts]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      void fetchProducts(next);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    void fetchProducts(0, true);
  };

  const handleCategoryTap = (catId: string) => {
    if (selectedCategory === catId) {
      setSelectedCategory("all");
      return;
    }
    const compat = checkTryOnCompatibility({
      targetCategory: catId,
      frame,
      shopModelId,
      chainedFromCategory,
      chainedFromFrame,
    });
    if (!compat.allowed) {
      showToast(compat.reason);
      return;
    }
    setSelectedCategory(catId);
  };

  const handlePickProduct = useCallback(
    (item: UnifiedProduct) => {
      const compat = checkTryOnCompatibility({
        targetCategory: item.vtonCategory,
        frame,
        shopModelId,
        chainedFromCategory,
        chainedFromFrame,
      });
      if (!compat.allowed) {
        showToast(compat.reason);
        return;
      }
      onSelect(item);
      onClose();
    },
    [frame, shopModelId, chainedFromCategory, chainedFromFrame, onSelect, onClose, showToast]
  );

  const visibleCategories = CATEGORY_CARDS.filter(
    (c) => !(lockedGender === "NAM" && c.id === "dress")
  );
  const hasActiveFilter = Boolean(selectedColor || selectedFit || sortOption !== "newest");

  const renderItem = useCallback(
    ({ item, index }: { item: UnifiedProduct; index: number }) => {
      const isSelected = selectedProductId === item.id;
      return (
        <View style={isSelected ? st.selectedCardRing : undefined}>
          <ProductCard
            item={item}
            index={index}
            stagger={false}
            onOpenItem={handlePickProduct}
            onTryItem={handlePickProduct}
          />
          {isSelected && (
            <View style={st.selectedTag}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              <Text style={st.selectedTagText}>Đang chọn</Text>
            </View>
          )}
        </View>
      );
    },
    [selectedProductId, handlePickProduct]
  );

  const keyExtractor = useCallback(
    (item: UnifiedProduct, idx: number) => `${item.id}-${item.sku}-${idx}`,
    []
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={st.container} edges={["top", "left", "right", "bottom"]}>
        {/* Top Modal Header */}
        <View style={st.header}>
          <View style={st.headerTopRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.headerTitle}>Chọn trang phục thử đồ</Text>
              <View style={st.lockedGenderBadge}>
                <Ionicons name="lock-closed-outline" size={11} color={Colors.champagneDeep} />
                <Text style={st.lockedGenderText}>
                  {lockedGender === "NAM" ? "Thời trang Nam" : "Thời trang Nữ"}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng chọn trang phục"
              onPress={onClose}
              style={st.closeBtn}
            >
              <Ionicons name="close" size={20} color={Colors.primary} />
            </Pressable>
          </View>

          {/* Search & Filter Toggle */}
          <View style={st.searchBarRow}>
            <View style={st.searchPill}>
              <Ionicons name="search" size={17} color={Colors.textMuted} />
              <TextInput
                placeholder="Tìm theo tên sản phẩm, mã SKU..."
                placeholderTextColor={Colors.textMuted}
                value={q}
                onChangeText={setQ}
                onSubmitEditing={() => setSearch(q.trim())}
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
              onPress={() => setFilterOpen(true)}
              style={[st.filterToggleBtn, hasActiveFilter && st.filterToggleBtnActive]}
            >
              <Ionicons
                name="options-outline"
                size={19}
                color={hasActiveFilter ? "#FFFFFF" : Colors.primary}
              />
            </Pressable>
          </View>

          {/* VTON Category Cards */}
          <View style={st.catCardsRow}>
            {visibleCategories.map((c) => {
              const on = selectedCategory === c.id;
              const compat = checkTryOnCompatibility({
                targetCategory: c.id,
                frame,
                shopModelId,
                chainedFromCategory,
                chainedFromFrame,
              });
              return (
                <Pressable
                  key={c.id}
                  onPress={() => handleCategoryTap(c.id)}
                  style={[
                    st.catCard,
                    on && st.catCardActive,
                    !compat.allowed && st.catCardMuted,
                  ]}
                >
                  <c.Icon size={21} color={on ? "#FFFFFF" : Colors.champagneDeep} />
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
        </View>

        {/* 2-Column Product Grid matching Catalog.tsx */}
        <FlatList
          data={loading && items.length === 0 ? [] : items}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={st.columnWrapper}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.feedContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={6}
          removeClippedSubviews={Platform.OS === "android"}
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
                    ? lockedGender === "NAM"
                      ? "Tất cả thời trang Nam"
                      : "Tất cả thời trang Nữ"
                    : selectedCategory === "upper_body"
                    ? lockedGender === "NAM"
                      ? "Áo nam lịch lãm"
                      : "Áo nữ thời thượng"
                    : selectedCategory === "lower_body"
                    ? lockedGender === "NAM"
                      ? "Quần âu & jeans nam"
                      : "Quần & Chân váy nữ"
                    : "Đầm Liền Thân"}
                </Text>
                <Text style={st.sectionCount}>
                  {loading
                    ? "Đang tải dữ liệu..."
                    : `Hiển thị ${items.length} / ${totalCount} sản phẩm`}
                </Text>
              </View>

              <ScalePressable activeScale={0.94} onPress={() => setFilterOpen(true)} style={st.sortChip}>
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
              </ScalePressable>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ProductGridSkeleton count={6} stagger={false} />
            ) : (
              <View style={st.emptyBox}>
                <Ionicons name="shirt-outline" size={40} color={Colors.textMuted} />
                <Text style={st.emptyTitle}>Không tìm thấy sản phẩm phù hợp</Text>
                <Text style={st.emptySub}>
                  Thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc màu sắc / form dáng.
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            <View style={{ paddingTop: 12, paddingBottom: 40 }}>
              {loadingMore && <ProductGridSkeleton count={2} stagger={false} />}
              {!hasMore && items.length > 0 && (
                <Text style={st.endOfListText}>
                  — Đã tải toàn bộ {totalCount} thiết kế —
                </Text>
              )}
            </View>
          }
        />

        {/* Inline Advanced Filter Overlay (avoids nested Modal issues on iOS/RN) */}
        {filterOpen && (
          <View style={st.filterOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
            <View style={st.filterDrawer}>
              <View style={st.filterDrawerHeader}>
                <Text style={st.filterDrawerTitle}>Bộ lọc & Sắp xếp</Text>
                <Pressable onPress={() => setFilterOpen(false)} style={st.closeBtn}>
                  <Ionicons name="close" size={18} color={Colors.primary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.filterBody}>
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
                      onPress={() => setSortOption(opt.id as typeof sortOption)}
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

                <Text style={st.sheetSectionTitle}>Gam màu chủ đạo</Text>
                <View style={st.sheetOptionsWrap}>
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

                <View style={st.sheetActionsRow}>
                  <Pressable
                    onPress={() => {
                      setSelectedColor("");
                      setSelectedFit("");
                      setSelectedCategory("all");
                      setSortOption("newest");
                      setFilterOpen(false);
                    }}
                    style={st.resetFiltersBtn}
                  >
                    <Text style={st.resetFiltersBtnText}>Đặt lại</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterOpen(false)}
                    style={st.applyFiltersBtn}
                  >
                    <Text style={st.applyFiltersBtnText}>Áp dụng bộ lọc</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Blocking Toast Feedback inside Modal */}
        <AnimatedToast message={toast} tone="warning" offset={24} />
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: Colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    fontFamily: "Editorial",
    fontSize: 20,
    color: Colors.primary,
  },
  lockedGenderBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
  },
  lockedGenderText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 11,
    color: Colors.champagneDeep,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  catCardsRow: {
    flexDirection: "row",
    gap: 8,
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
  catCardMuted: {
    opacity: 0.45,
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  selectedCardRing: {
    position: "relative",
  },
  selectedTag: {
    position: "absolute",
    top: 32,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.statusSuccess,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  selectedTagText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 9.5,
    color: "#FFFFFF",
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
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  emptyBox: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
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
  filterOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  filterDrawer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: "78%",
    paddingTop: 14,
    ...Shadows.sheet,
  },
  filterDrawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
  },
  filterDrawerTitle: {
    fontFamily: "Editorial",
    fontSize: 18,
    color: Colors.primary,
  },
  filterBody: {
    paddingHorizontal: 20,
    paddingBottom: 28,
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
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  sheetOptionChipTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
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
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  whiteSwatchBorder: {
    borderWidth: 0.8,
    borderColor: "#D1D5DB",
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
    marginTop: 22,
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
  toastPopup: {
    position: "absolute",
    top: 60,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    zIndex: 999,
    ...Shadows.toast,
  },
  toastPopupText: {
    flex: 1,
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
    lineHeight: 17,
  },
});
