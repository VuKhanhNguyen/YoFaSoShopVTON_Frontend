import { useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { EditorialImages } from "@/lib/catalog-data";
import { EmptyState, Sheet } from "@/components/shop/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface WardrobeSessionItem {
  sessionId: string;
  score: number;
  itemsSummary: string;
  fittedImage: any;
  date: string;
}

const MOCK_WARDROBE: WardrobeSessionItem[] = [
  {
    sessionId: "YFS-SES-948201",
    score: 95,
    itemsSummary: "Áo Sơ Mi Lụa + Quần Âu Ống Rộng",
    fittedImage: EditorialImages.shirtModel,
    date: "14:30 01/11/2026",
  },
  {
    sessionId: "YFS-SES-712390",
    score: 91,
    itemsSummary: "Đầm Liền Cổ Blazer Linen",
    fittedImage: EditorialImages.dress,
    date: "10:15 28/10/2026",
  },
  {
    sessionId: "YFS-SES-663812",
    score: 88,
    itemsSummary: "Áo Dệt Kim Kẻ Sọc + Chân Váy Chữ A",
    fittedImage: EditorialImages.stripe,
    date: "16:45 25/10/2026",
  },
];

export default function WardrobeScreen() {
  const { user } = useSession();
  const state = useResource<Row[]>(user ? "/try-on/sessions" : null);

  const [selectedPass, setSelectedPass] = useState<WardrobeSessionItem | null>(null);

  // If backend returns sessions, map them, otherwise fallback to mock sessions
  const sessions: WardrobeSessionItem[] =
    state.data && state.data.length > 0
      ? state.data.map((r) => ({
          sessionId: String(r.sessionId || r.operationId || "YFS-SES"),
          score: Number(r.projectedScore || 92),
          itemsSummary: String(r.productName || "Set đồ YoFaSo"),
          fittedImage: EditorialImages.shirtModel,
          date: r.createdAt
            ? new Date(String(r.createdAt)).toLocaleDateString("vi-VN")
            : "Hôm nay",
        }))
      : MOCK_WARDROBE;

  return (
    <View style={st.container}>
      {/* Top Header */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Tủ đồ Thử VTON</Text>
        <Text style={st.headerSub}>
          {sessions.length} set trang phục đã ướm thử cùng Trợ lý Stylist
        </Text>
      </View>

      {sessions.length === 0 ? (
        <EmptyState
          title="Tủ đồ thử của bạn còn trống"
          body="Chọn một thiết kế có nhãn AI VTON Ready và ướm thử trên vóc dáng của bạn — kết quả và vé O2O sẽ được lưu ở đây."
          cta="Khám phá bộ sưu tập ngay"
          onCta={() => router.replace("/(shop)")}
          icon={<Ionicons name="shirt-outline" size={38} color={Colors.champagneDeep} />}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.gridContent}
        >
          <View style={st.cardsGrid}>
            {sessions.map((ses) => {
              const isExcellent = ses.score >= 90;
              return (
                <Pressable
                  key={ses.sessionId}
                  onPress={() => setSelectedPass(ses)}
                  style={st.sessionCard}
                >
                  <View style={st.imageBox}>
                    <Image source={ses.fittedImage} style={st.cardImg} resizeMode="cover" />
                    <View style={st.scoreBadgeOverlay}>
                      <Text
                        style={[
                          st.scoreBadgeText,
                          {
                            color: isExcellent
                              ? Colors.statusSuccess
                              : Colors.statusWarning,
                          },
                        ]}
                      >
                        {ses.score}đ
                      </Text>
                    </View>
                  </View>
                  <View style={st.cardBottom}>
                    <Text style={st.sessionIdText}>{ses.sessionId}</Text>
                    <Text numberOfLines={1} style={st.itemsSummaryText}>
                      {ses.itemsSummary}
                    </Text>
                    <View style={st.passLinkRow}>
                      <Text style={st.passLinkText}>Xem vé O2O</Text>
                      <Ionicons name="arrow-forward" size={12} color={Colors.champagneDeep} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Digital Fitting Pass Sheet Modal */}
      <Sheet
        visible={Boolean(selectedPass)}
        onClose={() => setSelectedPass(null)}
        title="Vé Thử Đồ Tại Quầy (Digital Fitting Pass)"
      >
        {selectedPass && (
          <View style={st.ticketWrapper}>
            <View style={st.ticketTop}>
              <Text style={st.ticketBrandName}>YoFaSo Atelier</Text>
              <Text style={st.ticketBadge}>O2O PASS</Text>
            </View>

            <View style={st.qrBox}>
              <QRCode
                value={`YOFASO-O2O|${selectedPass.sessionId}`}
                size={170}
                color={Colors.primary}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={st.ticketBarcodeText}>{selectedPass.sessionId}</Text>

            <View style={st.dashedLine} />

            <View style={st.ticketDetailsBlock}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Image
                  source={selectedPass.fittedImage}
                  style={st.ticketThumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={st.ticketSetTitle}>{selectedPass.itemsSummary}</Text>
                  <Text style={st.ticketScoreHighlight}>
                    Điểm thẩm mỹ Stylist: {selectedPass.score}/100
                  </Text>
                  <Text style={st.ticketDate}>Tạo lúc: {selectedPass.date}</Text>
                </View>
              </View>
            </View>

            <Text style={st.ticketNotice}>
              Đưa mã QR này cho Thu ngân hoặc Nhân viên quầy YoFaSo Shop để lấy đúng set đồ này thử đồ thực tế!
            </Text>
          </View>
        )}
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
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHairline,
    backgroundColor: "rgba(250, 250, 249, 0.94)",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  gridContent: {
    padding: 16,
    paddingBottom: 100,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sessionCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    overflow: "hidden",
    ...Shadows.dock,
  },
  imageBox: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: Colors.surfaceMuted,
    position: "relative",
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  scoreBadgeOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  scoreBadgeText: {
    fontSize: 11,
    fontFamily: "Mono",
    fontWeight: "700",
  },
  cardBottom: {
    padding: 10,
    gap: 3,
  },
  sessionIdText: {
    fontSize: 9.5,
    fontFamily: "Mono",
    color: Colors.textMuted,
  },
  itemsSummaryText: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  passLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  passLinkText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  ticketWrapper: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    padding: 20,
    marginVertical: 8,
  },
  ticketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  ticketBrandName: {
    fontSize: 20,
    fontFamily: "Editorial",
    color: "#FFFFFF",
  },
  ticketBadge: {
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
  ticketBarcodeText: {
    fontSize: 13,
    fontFamily: "Mono",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 2,
    marginTop: 12,
  },
  dashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderStyle: "dashed",
    marginVertical: 14,
  },
  ticketDetailsBlock: {
    gap: 8,
  },
  ticketThumb: {
    width: 54,
    height: 68,
    borderRadius: Radii.md,
  },
  ticketSetTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  ticketScoreHighlight: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusSuccess,
    marginTop: 2,
  },
  ticketDate: {
    fontSize: 11,
    fontFamily: "Mono",
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 2,
  },
  ticketNotice: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.champagne,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
  },
});
