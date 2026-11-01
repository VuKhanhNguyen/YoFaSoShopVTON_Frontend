import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { api, imageSource } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import {
  EditorialImages,
  SAN_PHAM_MOCK,
  SanPham,
  formatVND,
} from "@/lib/catalog-data";
import {
  chamDiem,
  diemTong,
  goiYBanKem,
  loiNhanXet,
  nhanXepHang,
  xepHang,
  MonDo,
} from "@/lib/vton-engine";
import { Button, Sheet, colors } from "@/components/shop/ui";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SessionResultScreen() {
  const { id, variantId, before } = useLocalSearchParams<{
    id: string;
    variantId?: string;
    before?: string;
  }>();

  // Find product info
  const product =
    SAN_PHAM_MOCK.find((p) => p.maSanPham === variantId) || SAN_PHAM_MOCK[0];
  const primaryItem: MonDo = {
    p: product,
    b: product.bienThe[0],
  };

  const [secondaryItem, setSecondaryItem] = useState<MonDo | undefined>(undefined);
  const [splitPos, setSplitPos] = useState(50); // 0 to 100 percentage
  const [zoom, setZoom] = useState(false);
  const [scoreSheetExpanded, setScoreSheetExpanded] = useState(true);
  const [fittingPassOpen, setFittingPassOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Photos
  const beforePhoto = before || Image.resolveAssetSource(EditorialImages.onboard1).uri;
  // After photo (fitted model image or primary variant model photo)
  const afterPhoto =
    primaryItem.b.anhNguoiMau?.[0]
      ? typeof primaryItem.b.anhNguoiMau[0] === "number"
        ? Image.resolveAssetSource(primaryItem.b.anhNguoiMau[0]).uri
        : primaryItem.b.anhNguoiMau[0]
      : typeof primaryItem.p.hinhAnh === "number"
      ? Image.resolveAssetSource(primaryItem.p.hinhAnh).uri
      : primaryItem.p.hinhAnh;

  // Aesthetic Scoring Calculation (40-40-20)
  const scoreData = chamDiem(primaryItem, secondaryItem);
  const totalScore = diemTong(scoreData);
  const rank = xepHang(totalScore);
  const isHighQuality = totalScore >= 85;

  // Cross-sell recommendations
  const suggestions = goiYBanKem(primaryItem, SAN_PHAM_MOCK).filter(
    (g) => g.p.maSanPham !== secondaryItem?.p.maSanPham
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2200);
  };

  // Drag responder for Before/After split handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newPos = Math.max(
          5,
          Math.min(95, ((gestureState.moveX - 18) / (SCREEN_WIDTH - 36)) * 100)
        );
        setSplitPos(newPos);
      },
    })
  ).current;

  return (
    <View style={st.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={st.headerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng kết quả"
          onPress={() => router.replace("/(shop)")}
          style={st.iconRoundBtn}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={st.headerMonoTag}>UC_VTON · RESULT & STYLIST</Text>
          <Text style={st.headerItemTitle}>
            {primaryItem.p.tenSanPham.split("(")[0]}
            {secondaryItem ? ` + ${secondaryItem.p.tenSanPham.split("(")[0]}` : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem vé thử đồ O2O"
          onPress={() => setFittingPassOpen(true)}
          style={st.iconRoundBtn}
        >
          <Ionicons name="qr-code-outline" size={19} color={Colors.champagne} />
        </Pressable>
      </View>

      {/* Main Split-slider Viewport */}
      <View style={st.sliderViewport}>
        {/* Full Image Container */}
        <View style={st.sliderBox}>
          {/* AFTER Image (Full background) */}
          <Image
            source={{ uri: afterPhoto }}
            style={[st.imageLayer, zoom && { transform: [{ scale: 1.35 }] }]}
            resizeMode="cover"
          />

          {/* BEFORE Image (Clipped with splitPos) */}
          <View
            style={[
              st.clippedBeforeContainer,
              { width: `${splitPos}%` },
            ]}
          >
            <Image
              source={{ uri: beforePhoto }}
              style={[
                st.imageLayer,
                { width: SCREEN_WIDTH - 36 },
                zoom && { transform: [{ scale: 1.35 }] },
              ]}
              resizeMode="cover"
            />
          </View>

          {/* Split divider vertical line & handle */}
          <View
            style={[
              st.splitDividerLine,
              { left: `${splitPos}%` },
            ]}
          >
            <View {...panResponder.panHandlers} style={st.splitHandleCircle}>
              <Text style={st.splitHandleArrow}>‹ ›</Text>
            </View>
          </View>

          {/* Badges: TRƯỚC vs SAU · AI */}
          <View style={st.badgeBefore}>
            <Text style={st.badgeBeforeText}>TRƯỚC</Text>
          </View>
          <View style={st.badgeAfter}>
            <Text style={st.badgeAfterText}>SAU · AI</Text>
          </View>

          {/* Floating Action Controls on Right */}
          <View style={st.floatingTools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={zoom ? "Thu nhỏ" : "Phóng to chi tiết"}
              onPress={() => setZoom(!zoom)}
              style={st.toolCircleBtn}
            >
              <Ionicons
                name={zoom ? "contract-outline" : "expand-outline"}
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lưu ảnh"
              onPress={() => showToast("Đã lưu ảnh thử đồ vào thư viện")}
              style={st.toolCircleBtn}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Expandable Aesthetic Score Bottom Sheet */}
        <View
          style={[
            st.aestheticSheet,
            !scoreSheetExpanded && { height: 96 },
          ]}
        >
          {/* Sheet drag toggle button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={scoreSheetExpanded ? "Thu gọn bảng điểm" : "Mở rộng bảng điểm"}
            onPress={() => setScoreSheetExpanded(!scoreSheetExpanded)}
            style={st.sheetToggleBar}
          >
            <View style={st.sheetHandle} />
            <Ionicons
              name={scoreSheetExpanded ? "chevron-down" : "chevron-up"}
              size={18}
              color={Colors.textMuted}
            />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            {/* Score Ring & Overall Rank */}
            <View style={st.scoreSummaryRow}>
              <View style={st.scoreRingCircle}>
                <Text style={st.scoreNumberText}>{totalScore}</Text>
                <Text style={st.scoreSubText}>/100</Text>
              </View>

              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={st.scoreIdLabel}>PHIẾU ĐIỂM THẨM MỸ · {id || "YFS-VTON"}</Text>
                <View
                  style={[
                    st.rankBadge,
                    {
                      backgroundColor: isHighQuality
                        ? Colors.statusSuccessSubtle
                        : Colors.statusWarningSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.rankBadgeText,
                      {
                        color: isHighQuality
                          ? Colors.statusSuccess
                          : Colors.statusWarning,
                      },
                    ]}
                  >
                    {nhanXepHang[rank]}
                  </Text>
                </View>
                <Text style={st.formulaText}>
                  S = 0.4·{scoreData.tiLe} + 0.4·{scoreData.mauSac} + 0.2·{scoreData.hoaTiet}
                  {scoreData.phat > 0 ? ` − ${scoreData.phat}` : ""}
                </Text>
              </View>
            </View>

            {/* 3 Progress Bars */}
            <View style={st.progressBarsBlock}>
              {[
                { label: "Tỉ lệ vóc dáng (40%)", val: scoreData.tiLe, note: scoreData.ghiChu[0] },
                { label: "Phối màu bánh xe màu (40%)", val: scoreData.mauSac, note: scoreData.ghiChu[1] },
                { label: "Cân bằng họa tiết (20%)", val: scoreData.hoaTiet, note: scoreData.ghiChu[2] },
              ].map((bar, i) => (
                <View key={i} style={st.progressBarItem}>
                  <View style={st.progressBarHeader}>
                    <Text style={st.barLabel}>{bar.label}</Text>
                    <Text style={st.barValue}>{bar.val}/100</Text>
                  </View>
                  <View style={st.barTrack}>
                    <View
                      style={[
                        st.barFill,
                        {
                          width: `${bar.val}%`,
                          backgroundColor:
                            bar.val >= 85 ? Colors.statusSuccess : Colors.champagne,
                        },
                      ]}
                    />
                  </View>
                  <Text style={st.barNoteText}>{bar.note}</Text>
                </View>
              ))}
            </View>

            {/* Stylist Quote Box */}
            <View style={st.stylistQuoteCard}>
              <Ionicons name="sparkles" size={17} color={Colors.champagneDeep} style={{ marginTop: 2 }} />
              <Text style={st.stylistQuoteText}>
                “{loiNhanXet(totalScore)}”
                <Text style={st.stylistSignature}> — AI Fashion Stylist</Text>
              </Text>
            </View>

            {/* Cross-Sell Recommendations Carousel */}
            {suggestions.length > 0 && (
              <View style={st.crossSellSection}>
                <Text style={st.crossSellTitle}>
                  Thử thêm {suggestions[0].p.tenSanPham.toLowerCase()} để đạt{" "}
                  {suggestions[0].diem} điểm!
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.crossSellScroll}
                >
                  {suggestions.map((sug) => (
                    <View key={sug.p.maSanPham} style={st.crossSellCard}>
                      <Image
                        source={sug.p.hinhAnh}
                        style={st.crossSellImg}
                        resizeMode="cover"
                      />
                      <Text numberOfLines={1} style={st.crossSellName}>
                        {sug.p.tenSanPham}
                      </Text>
                      <View style={st.crossSellPriceRow}>
                        <Text style={st.crossSellPrice}>
                          {formatVND(sug.p.giaBan)}
                        </Text>
                        <Text style={st.crossSellScore}>{sug.diem}đ</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSecondaryItem(sug);
                          showToast(`Đã chọn phối cùng ${sug.p.tenSanPham}`);
                        }}
                        style={st.tryComboBtn}
                      >
                        <Text style={st.tryComboText}>Ướm thử set này</Text>
                        <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Combo Purchase CTA Buttons */}
            <View style={st.ctaRow}>
              <Pressable
                onPress={() => showToast("Đã thêm sản phẩm chính vào túi đồ")}
                style={st.singleBuyBtn}
              >
                <Text style={st.singleBuyText}>Mua riêng sản phẩm này</Text>
              </Pressable>

              <Pressable
                onPress={() => showToast("Đã thêm trọn bộ combo (−5%) vào túi đồ!")}
                style={st.comboBuyBtn}
              >
                <Text style={st.comboBuyText}>Mua trọn bộ combo (−5%)</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Toast Notification */}
      {!!toastMessage && (
        <View style={st.toastFloatingBox}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.statusSuccess} />
          <Text style={st.toastFloatingText}>{toastMessage}</Text>
        </View>
      )}

      {/* Digital Fitting Pass Modal (O2O) */}
      <Sheet
        visible={fittingPassOpen}
        onClose={() => setFittingPassOpen(false)}
        title="Vé thử đồ tại quầy YoFaSo (O2O Pass)"
      >
        <View style={st.ticketContainer}>
          <View style={st.ticketHeader}>
            <Text style={st.ticketBrand}>YoFaSo Atelier</Text>
            <Text style={st.ticketTag}>FITTING PASS</Text>
          </View>

          <View style={st.qrBox}>
            <QRCode
              value={`YOFASO-O2O|${id || "SESSION-VTON"}`}
              size={180}
              color={Colors.primary}
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={st.ticketCode}>{id || "YFS-ATELIER-2026"}</Text>

          <View style={st.ticketDividerDashed} />

          <View style={st.ticketItemSummary}>
            <Text style={st.ticketItemTitle}>Set trang phục ướm thử:</Text>
            <Text style={st.ticketItemLine}>
              • {primaryItem.p.tenSanPham} ({primaryItem.b.tenMau})
            </Text>
            {secondaryItem && (
              <Text style={st.ticketItemLine}>
                • {secondaryItem.p.tenSanPham} ({secondaryItem.b.tenMau})
              </Text>
            )}
            <Text style={st.ticketScoreHighlight}>
              Điểm thẩm mỹ Stylist: {totalScore}/100 — {nhanXepHang[rank]}
            </Text>
          </View>

          <Text style={st.ticketInstruction}>
            Đưa mã này cho Thu ngân hoặc Nhân viên quầy YoFaSo Shop để lấy đúng set đồ này thử đồ thực tế!
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 36,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  iconRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMonoTag: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.champagne,
    letterSpacing: 1.2,
  },
  headerItemTitle: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
    marginTop: 2,
  },
  sliderViewport: {
    flex: 1,
    position: "relative",
  },
  sliderBox: {
    marginHorizontal: 18,
    height: SCREEN_HEIGHT * 0.46,
    borderRadius: Radii.xl,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  imageLayer: {
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  clippedBeforeContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    zIndex: 2,
  },
  splitDividerLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  splitHandleCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.dock,
  },
  splitHandleArrow: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  badgeBefore: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    zIndex: 3,
  },
  badgeBeforeText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  badgeAfter: {
    position: "absolute",
    top: 12,
    right: 56,
    backgroundColor: Colors.champagne,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    zIndex: 3,
  },
  badgeAfterText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  floatingTools: {
    position: "absolute",
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 6,
  },
  toolCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.dock,
  },
  aestheticSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.44,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    ...Shadows.sheet,
  },
  sheetToggleBar: {
    alignItems: "center",
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderHairline,
    marginBottom: 4,
  },
  scoreSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  scoreRingCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.champagneSubtle,
  },
  scoreNumberText: {
    fontSize: 22,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.primary,
    lineHeight: 24,
  },
  scoreSubText: {
    fontSize: 9,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  scoreIdLabel: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  rankBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    marginTop: 4,
    marginBottom: 4,
  },
  rankBadgeText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
  },
  formulaText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  progressBarsBlock: {
    marginTop: 16,
    gap: 10,
  },
  progressBarItem: {
    gap: 3,
  },
  progressBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabel: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  barValue: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textSecondary,
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  barNoteText: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  stylistQuoteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    borderRadius: Radii.lg,
    padding: 12,
    marginTop: 16,
  },
  stylistQuoteText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.primary,
    lineHeight: 18,
    fontStyle: "italic",
  },
  stylistSignature: {
    fontStyle: "normal",
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  crossSellSection: {
    marginTop: 18,
  },
  crossSellTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  crossSellScroll: {
    gap: 12,
    marginTop: 10,
    paddingRight: 10,
  },
  crossSellCard: {
    width: 140,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    padding: 8,
    ...Shadows.dock,
  },
  crossSellImg: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: Radii.md,
  },
  crossSellName: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    marginTop: 6,
  },
  crossSellPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  crossSellPrice: {
    fontSize: 10.5,
    fontFamily: "Mono",
    color: Colors.textSecondary,
  },
  crossSellScore: {
    fontSize: 10.5,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  tryComboBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radii.sm,
    paddingVertical: 6,
    marginTop: 8,
  },
  tryComboText: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  singleBuyBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  singleBuyText: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  comboBuyBtn: {
    flex: 3,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  comboBuyText: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  toastFloatingBox: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.full,
    zIndex: 99,
    ...Shadows.toast,
  },
  toastFloatingText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  ticketContainer: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    padding: 20,
    marginVertical: 10,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  ticketBrand: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: "#FFFFFF",
  },
  ticketTag: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.champagne,
    letterSpacing: 2,
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: Radii.lg,
    alignSelf: "center",
  },
  ticketCode: {
    fontSize: 14,
    fontFamily: "Mono",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 2,
    marginTop: 12,
  },
  ticketDividerDashed: {
    height: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderStyle: "dashed",
    marginVertical: 16,
  },
  ticketItemSummary: {
    gap: 6,
  },
  ticketItemTitle: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagne,
  },
  ticketItemLine: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: "#FFFFFF",
  },
  ticketScoreHighlight: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusSuccess,
    marginTop: 4,
  },
  ticketInstruction: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.champagne,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
  },
});
