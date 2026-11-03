import { memo, useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import type { Page, Product } from "@/lib/models";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND } from "@/lib/catalog-data";
import { ShopHeader } from "./ShopHeader";
import { ProductCard, mapApiProduct, type UnifiedProduct } from "./ProductCard";

export const Explore = memo(function Explore() {
  // Quick Search input in Explore header
  const [q, setQ] = useState("");

  // Stylist AI interactive body shape
  const [selectedBodyShape, setSelectedBodyShape] = useState("Đồng hồ cát");

  // Editorial tab: Women vs Men
  const [editorialTab, setEditorialTab] = useState<"NU" | "NAM">("NU");

  // Explore featured data lists
  const [newestItems, setNewestItems] = useState<UnifiedProduct[]>([]);
  const [womenItems, setWomenItems] = useState<UnifiedProduct[]>([]);
  const [menItems, setMenItems] = useState<UnifiedProduct[]>([]);
  const [bestSellerItems, setBestSellerItems] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch Explore data from Catalog API
  const fetchExploreData = useCallback(async () => {
    try {
      const [newestRes, womenRes, menRes, bestSellerRes] = await Promise.allSettled([
        api<Page<Product>>("/catalog/products?sort=newest&limit=6"),
        api<Page<Product>>("/catalog/products?gender=NU&limit=3"),
        api<Page<Product>>("/catalog/products?gender=NAM&limit=3"),
        api<Page<Product>>("/catalog/products?sort=best_selling&limit=4"),
      ]);

      if (newestRes.status === "fulfilled" && newestRes.value?.items) {
        setNewestItems(newestRes.value.items.map((p, i) => mapApiProduct(p, i)));
      }
      if (womenRes.status === "fulfilled" && womenRes.value?.items) {
        setWomenItems(womenRes.value.items.map((p, i) => mapApiProduct(p, i)));
      }
      if (menRes.status === "fulfilled" && menRes.value?.items) {
        setMenItems(menRes.value.items.map((p, i) => mapApiProduct(p, i)));
      }
      if (bestSellerRes.status === "fulfilled" && bestSellerRes.value?.items) {
        setBestSellerItems(bestSellerRes.value.items.map((p, i) => mapApiProduct(p, i)));
      }
    } catch {
      // Retain existing items if any network interruption occurs
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExploreData();
  }, [fetchExploreData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExploreData();
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
      params: {
        variantId: item.sku || item.id,
        category: item.vtonCategory,
      },
    });
  };

  const handleNavigateToCatalog = (opts?: {
    gender?: string;
    sort?: string;
    category?: string;
    q?: string;
  }) => {
    router.push({
      pathname: "/(shop)/catalog",
      params: {
        gender: opts?.gender || "all",
        sort: opts?.sort || "newest",
        category: opts?.category || "all",
        q: opts?.q || "",
      },
    });
  };

  return (
    <View style={st.container}>
      {/* Sticky Header with Logo & Search */}
      <ShopHeader showLogo badgeText="Your Fashion, Your Own Soul">
        <View style={st.searchBarRow}>
          <View style={[st.searchPill, { flex: 1 }]}>
            <Ionicons name="search" size={17} color={Colors.textMuted} />
            <TextInput
              placeholder="Tìm áo vest, sơ mi, đầm lụa, mã màu..."
              placeholderTextColor={Colors.textMuted}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => {
                handleNavigateToCatalog({ q });
              }}
              style={st.searchInput}
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </ShopHeader>

      {/* Scrollable Editorial Discover Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.exploreContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.champagneDeep}
            colors={[Colors.champagneDeep]}
          />
        }
      >
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

          <View style={st.heroGlassBox}>
            <Text style={st.heroCollectionSubtitle}>BỘ SƯU TẬP 2026</Text>
            <Text style={st.heroCollectionTitle}>Form dáng chuẩn VTON</Text>
            <Text style={st.heroCollectionDesc}>
              Trải nghiệm ướm thử trang phục ảo theo số đo thực tế của cơ thể bạn.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ướm thử vào bạn"
              onPress={() =>
                router.push({
                  pathname: "/try-on",
                  params: {
                    variantId: newestItems[0]?.sku || "SKU-WAOGILE-EN-S-001",
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

        {/* Stylist AI Banner Card */}
        <View style={st.stylistCard}>
          <View style={st.stylistTopRow}>
            <View style={st.stylistTitleRow}>
              <View style={st.stylistIconCircle}>
                <Ionicons name="sparkles" size={14} color={Colors.champagneDeep} />
              </View>
              <Text numberOfLines={1} style={st.stylistCardTitle}>
                Stylist AI & Nhận Voucher 100K
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/(shop)/account" as any)}
              style={st.activateProfilePill}
            >
              <Text style={st.activateProfileText}>Kích hoạt</Text>
              <Ionicons name="chevron-forward" size={12} color={Colors.champagneDeep} />
            </Pressable>
          </View>

          <Text style={st.stylistCardSubtitle}>
            Chọn dáng người để AI may đo trang phục & nhận mã ưu đãi cá nhân hóa:
          </Text>

          <View style={st.bodyTypeRow}>
            {["Đồng hồ cát", "Quả lê", "Thước kẻ", "Tam giác"].map((shape) => {
              const active = selectedBodyShape === shape;
              return (
                <Pressable
                  key={shape}
                  onPress={() => setSelectedBodyShape(shape)}
                  style={[st.bodyTypePill, active && st.bodyTypePillActive]}
                >
                  <Text
                    style={[
                      st.bodyTypePillText,
                      active && st.bodyTypePillTextActive,
                    ]}
                  >
                    {shape}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Voucher Ưu Đãi Carousel */}
        <View style={st.voucherSection}>
          <View style={st.sectionHeaderExplore}>
            <View style={st.sectionTitleRow}>
              <Ionicons name="gift-outline" size={16} color={Colors.champagneDeep} />
              <Text style={st.exploreSectionTitle}>Voucher & Đặc Quyền Khách Hàng</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.voucherScroll}
          >
            {[
              {
                code: "YOFASO15",
                discount: "Giảm 15%",
                title: "Đơn Hàng Đầu Tiên",
                condition: "Áp dụng cho đơn từ 350.000 đ",
              },
              {
                code: "FREESHIP",
                discount: "Miễn Phí Vận Chuyển",
                title: "Giao Hàng Toàn Quốc",
                condition: "Áp dụng cho đơn từ 500.000 đ",
              },
              {
                code: "VTON100",
                discount: "Voucher 100.000 đ",
                title: "Kích Hoạt Hồ Sơ AI",
                condition: "Tặng khi lưu dáng người lần đầu",
              },
            ].map((v, i) => (
              <View key={i} style={st.voucherCard}>
                <View style={st.voucherLeft}>
                  <Text style={st.voucherDiscount}>{v.discount}</Text>
                  <Text style={st.voucherTitle}>{v.title}</Text>
                  <Text style={st.voucherCond}>{v.condition}</Text>
                </View>
                <View style={st.voucherDivider} />
                <View style={st.voucherRight}>
                  <Text style={st.voucherCodeLabel}>MÃ VOUCHER</Text>
                  <Text style={st.voucherCodeText}>{v.code}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* GENDER FASHION EDITORIAL SHOWCASE (Thời trang Nam & Nữ tabs) */}
        <View style={st.editorialSection}>
          <View style={st.editorialTabsRow}>
            <Pressable
              onPress={() => setEditorialTab("NU")}
              style={[
                st.editorialTabBtn,
                editorialTab === "NU" && st.editorialTabBtnActive,
              ]}
            >
              <Text
                style={[
                  st.editorialTabBtnText,
                  editorialTab === "NU" && st.editorialTabBtnTextActive,
                ]}
              >
                ✨ Thời trang Nữ
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setEditorialTab("NAM")}
              style={[
                st.editorialTabBtn,
                editorialTab === "NAM" && st.editorialTabBtnActive,
              ]}
            >
              <Text
                style={[
                  st.editorialTabBtnText,
                  editorialTab === "NAM" && st.editorialTabBtnTextActive,
                ]}
              >
                🎩 Thời trang Nam
              </Text>
            </Pressable>
          </View>

          {/* Editorial Narrative Card */}
          <View style={st.narrativeCard}>
            {editorialTab === "NU" ? (
              <>
                <View style={st.narrativeTag}>
                  <Text style={st.narrativeTagText}>QUIET LUXURY • PHÁI ĐẸP</Text>
                </View>
                <Text style={st.narrativeHeadline}>
                  Duyên Dáng Tối Giản • Tôn Vinh Thần Thái Quý Phái
                </Text>
                <Text style={[st.narrativeBody, { textAlign: "justify" }]}>
                  Thời trang nữ tại YoFaSo Shop không chỉ là trang phục, mà còn là lời khẳng định về gu
                  thẩm mỹ tinh tế và lối sống tự do, thanh lịch. Từng đường cắt may tỉ mỉ, chất vải
                  tuytxi dệt cao cấp và lụa mềm mát được nghiên cứu chuẩn mực theo tỉ lệ vàng cơ
                  thể Á Đông 1/3 - 2/3. Dù là chiếc áo gile sắc nét nơi công sở hay tà áo dài tơ
                  tằm thanh tao dạo phố, mỗi thiết kế đều giúp phái đẹp tỏa sáng tự nhiên.
                </Text>

                {/* 3 Representative Women Products */}
                <View style={st.repProductsGrid}>
                  {(womenItems.length > 0 ? womenItems : newestItems.slice(0, 3)).map(
                    (item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleOpenProduct(item)}
                        style={st.repCard}
                      >
                        <Image
                          source={
                            typeof item.image === "number"
                              ? item.image
                              : { uri: item.image }
                          }
                          style={st.repImage}
                          resizeMode="cover"
                        />
                        <Text numberOfLines={1} style={st.repTitle}>
                          {item.name}
                        </Text>
                        <Text style={st.repPrice}>{formatVND(item.price)}</Text>
                      </Pressable>
                    )
                  )}
                </View>

                {/* CTA Button to Men/Women Catalog */}
                <Pressable
                  onPress={() => handleNavigateToCatalog({ gender: "NU" })}
                  style={st.exploreCtaBtn}
                >
                  <Text style={st.exploreCtaBtnText}>
                    Xem toàn bộ Thời trang Nữ ({womenItems.length > 0 ? "66" : "Nữ"})
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </Pressable>
              </>
            ) : (
              <>
                <View style={st.narrativeTag}>
                  <Text style={st.narrativeTagText}>MODERN GENTLEMAN • QUÝ ÔNG</Text>
                </View>
                <Text style={st.narrativeHeadline}>
                  Bản Lĩnh Quý Ông • Phong Thái Đĩnh Đạc Chuẩn Mực
                </Text>
                <Text style={[st.narrativeBody, { textAlign: "justify" }]}>
                  Phong cách ăn mặc của người đàn ông phản ánh chiều sâu tư duy và phong thái
                  sống. YoFaSo Shop mang đến các thiết kế vest may đo sắc nét, sơ mi đứng dáng và quần
                  âu xếp ly chuẩn form châu Âu. Tối giản trong chi tiết, bền bỉ cùng thời gian —
                  đồng hành cùng phái mạnh tự tin làm chủ mọi khoảnh khắc từ phòng họp đến những
                  buổi gặp gỡ thường nhật.
                </Text>

                {/* 3 Representative Men Products */}
                <View style={st.repProductsGrid}>
                  {(menItems.length > 0 ? menItems : newestItems.slice(3, 6)).map(
                    (item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleOpenProduct(item)}
                        style={st.repCard}
                      >
                        <Image
                          source={
                            typeof item.image === "number"
                              ? item.image
                              : { uri: item.image }
                          }
                          style={st.repImage}
                          resizeMode="cover"
                        />
                        <Text numberOfLines={1} style={st.repTitle}>
                          {item.name}
                        </Text>
                        <Text style={st.repPrice}>{formatVND(item.price)}</Text>
                      </Pressable>
                    )
                  )}
                </View>

                {/* CTA Button to Men/Women Catalog */}
                <Pressable
                  onPress={() => handleNavigateToCatalog({ gender: "NAM" })}
                  style={st.exploreCtaBtn}
                >
                  <Text style={st.exploreCtaBtnText}>
                    Xem toàn bộ Thời trang Nam ({menItems.length > 0 ? "55" : "Nam"})
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* THIẾT KẾ MỚI VỀ (New Arrivals) */}
        <View style={st.newArrivalsSection}>
          <View style={st.sectionHeaderExplore}>
            <View>
              <Text style={st.exploreSectionTitle}>Thiết Kế Mới Về</Text>
              <Text style={st.exploreSectionSub}>
                6 thiết kế mới nhất vừa ra mắt tuần này
              </Text>
            </View>
            <Pressable
              onPress={() => handleNavigateToCatalog({ sort: "newest" })}
              style={st.seeAllBtn}
            >
              <Text style={st.seeAllBtnText}>Xem ngay</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.champagneDeep} />
            </Pressable>
          </View>

          {/* 6 Newest Products 2-Column Grid */}
          <View style={st.twoColGrid}>
            {newestItems.slice(0, 6).map((item, idx) => (
              <ProductCard
                key={item.id}
                item={item}
                index={idx}
                onOpen={() => handleOpenProduct(item)}
                onTry={() => handleTryOnProduct(item)}
              />
            ))}
          </View>
        </View>

        {/* THIẾT KẾ BÁN CHẠY (Best Sellers) */}
        <View style={st.newArrivalsSection}>
          <View style={st.sectionHeaderExplore}>
            <View>
              <Text style={st.exploreSectionTitle}>Thiết Kế Bán Chạy</Text>
              <Text style={st.exploreSectionSub}>
                Xu hướng thời trang được lựa chọn nhiều nhất
              </Text>
            </View>
            <Pressable
              onPress={() => handleNavigateToCatalog({ sort: "best_selling" })}
              style={st.seeAllBtn}
            >
              <Text style={st.seeAllBtnText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.champagneDeep} />
            </Pressable>
          </View>

          <View style={st.twoColGrid}>
            {(bestSellerItems.length > 0 ? bestSellerItems : newestItems.slice(2, 6)).map(
              (item, idx) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  index={idx}
                  onOpen={() => handleOpenProduct(item)}
                  onTry={() => handleTryOnProduct(item)}
                />
              )
            )}
          </View>
        </View>

        {/* SHOP THE LOOK • COMBO PHỐI SẴN AI */}
        <View style={st.comboCard}>
          <View style={st.comboHeader}>
            <Text style={st.comboTitle}>Shop The Look • Combo Phối Sẵn</Text>
            <View style={st.comboDiscountBadge}>
              <Text style={st.comboDiscountBadgeText}>Giảm 10% Set</Text>
            </View>
          </View>
          <Text style={st.comboRatingText}>
            ★ Điểm Stylist: 92/100 · Tỉ lệ vàng 1/3 - 2/3
          </Text>
          <View style={st.comboFooter}>
            <View>
              <Text style={st.comboPrice}>3.096.000đ</Text>
              <Text style={st.comboOldPrice}>3.440.000đ</Text>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/try-on",
                  params: {
                    variantId: newestItems[0]?.sku || "SKU-WAOGILE-EN-S-001",
                    category: "upper_body",
                  },
                })
              }
              style={st.comboTryBtn}
            >
              <Text style={st.comboTryBtnText}>Ướm thử cả Set AI</Text>
            </Pressable>
          </View>
        </View>

        {/* TRẢI NGHIỆM THỬ ĐỒ O2O TẠI FLAGSHIP STORE */}
        <View style={st.o2oCard}>
          <View style={st.o2oIconBox}>
            <Ionicons name="home-outline" size={20} color={Colors.champagneDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.o2oTitle}>Trải nghiệm Thử đồ O2O tại Flagship Store</Text>
            <Text style={st.o2oSubtitle}>
              Nhận đồ sẵn tại phòng thử VIP sau 30 phút, Kệ A-01 Flagship.
            </Text>
            <Pressable onPress={() => router.push("/orders")} style={st.o2oLinkRow}>
              <Text style={st.o2oLinkText}>Đặt lịch & Nhận vé Fitting Pass</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.champagneDeep} />
            </Pressable>
          </View>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>
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
  exploreContent: {
    padding: 16,
    gap: 18,
  },
  heroCard: {
    height: 450,
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
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  heroTagText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroGlassBox: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: Radii.lg,
    padding: 14,
    ...Shadows.sheet,
  },
  heroCollectionSubtitle: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    letterSpacing: 1.5,
  },
  heroCollectionTitle: {
    fontSize: 19,
    fontFamily: "Editorial",
    color: Colors.primary,
    marginTop: 2,
  },
  heroCollectionDesc: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 10,
  },
  heroCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    alignSelf: "flex-start",
  },
  heroCtaText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },

  // STYLIST CARD
  stylistCard: {
    backgroundColor: "#FDFBF7",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    borderRadius: Radii.xl,
    padding: 14,
    ...Shadows.dock,
  },
  stylistTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  stylistTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  stylistIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  stylistCardTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    flexShrink: 1,
  },
  activateProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.champagneSubtle,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    flexShrink: 0,
  },
  activateProfileText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  stylistCardSubtitle: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 16,
  },
  bodyTypeRow: {
    flexDirection: "row",
    gap: 6,
  },
  bodyTypePill: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyTypePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bodyTypePillText: {
    fontSize: 10.5,
    fontFamily: "JakartaMedium",
    color: Colors.textSecondary,
  },
  bodyTypePillTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
  },

  // VOUCHERS
  voucherSection: {
    gap: 10,
  },
  sectionHeaderExplore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exploreSectionTitle: {
    fontSize: 16,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.2,
  },
  exploreSectionSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  voucherScroll: {
    gap: 10,
    paddingRight: 10,
  },
  voucherCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    overflow: "hidden",
    width: 250,
    ...Shadows.dock,
  },
  voucherLeft: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  voucherDiscount: {
    fontSize: 13,
    fontFamily: "JakartaBold",
    color: Colors.champagneDeep,
  },
  voucherTitle: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    marginTop: 1,
  },
  voucherCond: {
    fontSize: 9.5,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    marginTop: 2,
  },
  voucherDivider: {
    width: 1,
    borderStyle: "dashed",
    borderWidth: 0.5,
    borderColor: Colors.borderHairline,
    marginVertical: 6,
  },
  voucherRight: {
    width: 75,
    backgroundColor: "#FAF7F2",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  voucherCodeLabel: {
    fontSize: 7.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  voucherCodeText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },

  // GENDER FASHION EDITORIAL SECTION
  editorialSection: {
    gap: 12,
  },
  editorialTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(197, 168, 128, 0.15)",
    borderRadius: Radii.full,
    padding: 4,
    gap: 4,
  },
  editorialTabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  editorialTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  editorialTabBtnText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  editorialTabBtnTextActive: {
    color: "#FFFFFF",
  },
  narrativeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.dock,
  },
  narrativeTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    marginBottom: 6,
  },
  narrativeTagText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  narrativeHeadline: {
    fontSize: 17,
    fontFamily: "Editorial",
    color: Colors.primary,
    lineHeight: 22,
    marginBottom: 8,
  },
  narrativeBody: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  repProductsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  repCard: {
    flex: 1,
    backgroundColor: "#FAFAF9",
    borderRadius: Radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  repImage: {
    width: "100%",
    height: 110,
  },
  repTitle: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    paddingHorizontal: 6,
    paddingTop: 5,
  },
  repPrice: {
    fontSize: 10.5,
    fontFamily: "JakartaBold",
    color: Colors.champagneDeep,
    paddingHorizontal: 6,
    paddingBottom: 6,
    marginTop: 2,
  },
  exploreCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: Radii.md,
  },
  exploreCtaBtnText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },

  // NEW ARRIVALS & 2-COLUMN GRID
  newArrivalsSection: {
    gap: 12,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllBtnText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  twoColGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // COMBO & O2O CARDS
  comboCard: {
    backgroundColor: "#172033",
    borderRadius: Radii.xl,
    padding: 16,
    ...Shadows.dock,
  },
  comboHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comboTitle: {
    fontSize: 14,
    fontFamily: "Editorial",
    color: "#FFFFFF",
  },
  comboDiscountBadge: {
    backgroundColor: "#B45309",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radii.full,
  },
  comboDiscountBadgeText: {
    fontSize: 9.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  comboRatingText: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 4,
    marginBottom: 12,
  },
  comboFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comboPrice: {
    fontSize: 15,
    fontFamily: "JakartaBold",
    color: "#FFFFFF",
  },
  comboOldPrice: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: "rgba(255, 255, 255, 0.5)",
    textDecorationLine: "line-through",
  },
  comboTryBtn: {
    backgroundColor: Colors.champagneDeep,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
  },
  comboTryBtnText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  o2oCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 14,
    gap: 12,
    ...Shadows.dock,
  },
  o2oIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  o2oTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  o2oSubtitle: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  o2oLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  o2oLinkText: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
});

