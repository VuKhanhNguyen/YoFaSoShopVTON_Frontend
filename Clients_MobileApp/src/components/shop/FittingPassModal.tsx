import { useEffect, useState } from "react";
import {
  Clipboard,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle, Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { publicUrl } from "@/lib/api";
import {
  buildFittingPassQrPayload,
  primaryHexOf,
  type TryOnSession,
} from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { SmartImage } from "./Skeleton";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TICKET_WIDTH = Math.min(SCREEN_WIDTH - 28, 372);
const NOTCH_BG = "#040812";

export interface FittingPassModalProps {
  visible: boolean;
  onClose: () => void;
  session: TryOnSession;
  liveScore?: { total: number; tier?: string; tierLabel?: string };
}

type TicketProductItem = {
  key: string;
  sessionId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  imageUrl: string;
  tag?: string;
};

function scoreColor(score: number): string {
  if (score <= 0) return "#CBD5E1";
  if (score >= 85) return Colors.statusSuccess;
  if (score >= 70) return "#D97706";
  return Colors.statusDanger;
}

function categoryTag(cat?: string): string | undefined {
  if (cat === "upper_body") return "Áo";
  if (cat === "lower_body") return "Quần/Váy";
  if (cat === "dress") return "Đầm liền";
  return undefined;
}

export function FittingPassModal({
  visible,
  onClose,
  session,
  liveScore,
}: FittingPassModalProps) {
  const reducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [session.sessionId, visible]);

  const rawScore = Number(liveScore?.total ?? session.score ?? 0);
  const vtonScore = Number.isFinite(rawScore) && rawScore > 0 ? Math.round(rawScore) : 0;
  const resolvedCurrentImageUrl = session.productImageUrl
    ? publicUrl(session.productImageUrl)
    : "";
  const resolvedPairedImageUrl = session.pairedItem?.productImageUrl
    ? publicUrl(session.pairedItem.productImageUrl)
    : "";

  const qrValue = buildFittingPassQrPayload(
    session,
    resolvedCurrentImageUrl,
    vtonScore,
    resolvedPairedImageUrl
  );

  const items: TicketProductItem[] = [];
  if (session.pairedItem) {
    const p = session.pairedItem;
    items.push({
      key: `prev-${p.sessionId}`,
      sessionId: p.sessionId,
      productId: p.productId,
      productName: p.productName,
      sku: p.sku || p.variantId,
      size: p.size || "—",
      colorName: p.colorName || "Tiêu chuẩn",
      colorHex: primaryHexOf(p.colorHex, "#94A3B8"),
      imageUrl: resolvedPairedImageUrl,
      tag: categoryTag(p.vtonCategory),
    });
  }
  items.push({
    key: `cur-${session.sessionId}`,
    sessionId: session.sessionId,
    productId: session.productId,
    productName: session.productName,
    sku: session.sku || session.variantId,
    size: session.size || "—",
    colorName: session.colorName || "Tiêu chuẩn",
    colorHex: primaryHexOf(session.colorHex, "#94A3B8"),
    imageUrl: resolvedCurrentImageUrl,
    tag: categoryTag(session.vtonCategory),
  });

  const isMultiItem = items.length > 1;
  const qrSize = isMultiItem ? 154 : 176;
  const tierHeading =
    vtonScore > 0
      ? String(
          liveScore?.tierLabel ||
            session.tierLabel ||
            (vtonScore >= 85
              ? "RẤT HỢP · RECOMMENDED"
              : vtonScore >= 70
              ? "PHỐI ỔN · ACCEPTABLE"
              : "CẦN ĐIỀU CHỈNH")
        ).toUpperCase()
      : "CHƯA CHẤM ĐIỂM";

  const spacedCode = session.sessionId.split("").join(" ");
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const ringOffset = circumference * (1 - Math.min(100, Math.max(0, vtonScore)) / 100);

  const handleCopy = () => {
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(session.sessionId);
    } else {
      Clipboard.setString(session.sessionId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const renderScoreBox = () => (
    <View style={st.scoreBox}>
      <View style={st.ringWrap}>
        <Svg width={36} height={36} viewBox="0 0 38 38">
          <Circle
            cx="19"
            cy="19"
            r={radius}
            stroke="#E7DFD3"
            strokeWidth="3"
            fill="none"
          />
          <Circle
            cx="19"
            cy="19"
            r={radius}
            stroke={scoreColor(vtonScore)}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={ringOffset}
            fill="none"
            transform="rotate(-90 19 19)"
          />
        </Svg>
        <Text style={st.ringValue}>{vtonScore}</Text>
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <Text style={st.scoreTier} numberOfLines={2}>
          {tierHeading}
        </Text>
        <Text style={st.scoreCaption}>Điểm VTON: {vtonScore}/100</Text>
      </View>

      <Ionicons name="ribbon-outline" size={17} color={Colors.champagneDeep} />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <ScrollView
          style={{ width: "100%" }}
          contentContainerStyle={st.centerScroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.duration(220)}
            style={st.ticket}
          >
            {/* Top Brand Header */}
            <View style={st.topHeader}>
              <View>
                <Text style={st.brandTitle}>YoFaSo Atelier</Text>
                <Text style={st.brandSub}>PREMIUM FASHION</Text>
              </View>

              <View style={st.headerRight}>
                <View style={st.passBadge}>
                  <View style={st.passDot} />
                  <Text style={st.passBadgeText}>FITTING PASS</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng vé thử đồ"
                  onPress={onClose}
                  style={st.closeBtn}
                >
                  <Ionicons name="close" size={16} color="#E2E8F0" />
                </Pressable>
              </View>
            </View>

            {/* Centered Session Code + Copy */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sao chép mã phiên ${session.sessionId}`}
              onPress={handleCopy}
              style={st.codeRow}
            >
              <Text style={st.codeText}>{spacedCode}</Text>
              <Ionicons
                name={copied ? "checkmark-circle" : "copy-outline"}
                size={15}
                color={copied ? "#34D399" : "#94A3B8"}
              />
            </Pressable>
            {copied && <Text style={st.copiedHint}>Đã sao chép mã phiên</Text>}

            {/* White QR Container */}
            <View style={st.qrBox}>
              <QRCode
                value={qrValue}
                size={qrSize}
                color="#0F172A"
                backgroundColor="#FFFFFF"
                ecl={qrValue.length > 420 ? "L" : "M"}
              />
            </View>

            {/* Perforated Ticket Divider with Side Notches & True SVG Dashes */}
            <View style={st.perforationRow}>
              <View style={[st.notch, st.notchLeft]} />
              <View style={st.dashedLineWrap}>
                <Svg width="100%" height={2}>
                  <Line
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="rgba(148, 163, 184, 0.42)"
                    strokeWidth="1.5"
                    strokeDasharray="5, 5"
                  />
                </Svg>
              </View>
              <View style={[st.notch, st.notchRight]} />
            </View>

            {/* Bottom White Product Card (1 item or 2-item chained set A + B) */}
            <View style={st.productCard}>
              {isMultiItem && (
                <View style={st.setHeaderRow}>
                  <Ionicons name="layers-outline" size={13} color={Colors.champagneDeep} />
                  <Text style={st.setHeaderText}>
                    SET PHỐI 2 MÓN · #{items[0].sessionId} + #{items[1].sessionId}
                  </Text>
                </View>
              )}

              {items.map((item, idx) => {
                const thumbW = isMultiItem ? 58 : 78;
                const thumbH = isMultiItem ? 74 : 100;
                const isLightSwatch =
                  item.colorHex.toLowerCase() === "#ffffff" ||
                  item.colorHex.toLowerCase() === "#fff";

                return (
                  <View
                    key={item.key}
                    style={[
                      st.productRow,
                      idx > 0 && st.productRowDivider,
                    ]}
                  >
                    <View style={[st.productThumbWrap, { width: thumbW, height: thumbH }]}>
                      <SmartImage
                        source={item.imageUrl || null}
                        style={{ width: thumbW, height: thumbH }}
                        contentFit="cover"
                        iconSize={20}
                      />
                      <View style={st.sizeOverlayBadge}>
                        <Text style={st.sizeOverlayText}>Size {item.size}</Text>
                      </View>
                    </View>

                    <View style={st.productInfo}>
                      <View style={st.productTitleRow}>
                        <View
                          style={[
                            st.swatchDot,
                            { backgroundColor: item.colorHex },
                            isLightSwatch && st.lightSwatchBorder,
                          ]}
                        />
                        <Text
                          style={[st.productName, isMultiItem && st.productNameCompact]}
                          numberOfLines={2}
                        >
                          {item.productName}
                        </Text>
                      </View>

                      <Text style={st.metaLine} numberOfLines={1}>
                        Màu: {item.colorName} · SKU: {item.sku}
                      </Text>
                      <Text style={st.metaCode} numberOfLines={1}>
                        Mã SP: {item.productId}
                        {isMultiItem && item.tag ? ` · ${item.tag}` : ` · Phiên: ${item.sessionId}`}
                      </Text>

                      {!isMultiItem && renderScoreBox()}
                    </View>
                  </View>
                );
              })}

              {isMultiItem && <View style={st.multiScoreWrap}>{renderScoreBox()}</View>}
            </View>

            {/* Footer Cashier Note */}
            <View style={st.footerNote}>
              <Ionicons name="storefront-outline" size={17} color="#E6D3B3" />
              <Text style={st.footerText}>
                Đưa mã này cho{" "}
                <Text style={st.footerTextBold}>Thu ngân YoFaSo Shop</Text> để nhận{" "}
                {isMultiItem ? "trọn bộ 2 món" : "set đồ"} chuẩn bị sẵn trong phòng thử thực tế.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 8, 18, 0.86)",
    justifyContent: "center",
    alignItems: "center",
  },
  centerScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  ticket: {
    width: TICKET_WIDTH,
    backgroundColor: "#111927",
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...Shadows.lg,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 10,
  },
  brandTitle: {
    fontFamily: "Editorial",
    fontSize: 21,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  brandSub: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: "#C5A880",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(197, 168, 128, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  passDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C5A880",
  },
  passBadgeText: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: "#E8D5B7",
    letterSpacing: 0.9,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  codeText: {
    fontFamily: "Mono",
    fontSize: 13,
    color: "#E8D5B7",
    letterSpacing: 1.3,
  },
  copiedHint: {
    textAlign: "center",
    fontFamily: "JakartaSemiBold",
    fontSize: 11,
    color: "#34D399",
    marginTop: -6,
    marginBottom: 6,
  },
  qrBox: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 13,
    ...Shadows.md,
  },
  perforationRow: {
    height: 24,
    marginVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NOTCH_BG,
  },
  notchLeft: {
    marginLeft: -12,
  },
  notchRight: {
    marginRight: -12,
  },
  dashedLineWrap: {
    flex: 1,
    marginHorizontal: 10,
    height: 2,
    justifyContent: "center",
  },
  productCard: {
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  setHeaderText: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: Colors.champagneDeep,
    letterSpacing: 0.6,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  productRowDivider: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  productThumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.surfaceMuted,
    position: "relative",
    flexShrink: 0,
  },
  productThumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeOverlayBadge: {
    position: "absolute",
    left: 5,
    bottom: 5,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sizeOverlayText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 9.5,
    color: "#FFFFFF",
  },
  productInfo: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 3,
  },
  productTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  lightSwatchBorder: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  productName: {
    flex: 1,
    fontFamily: "Editorial",
    fontSize: 13.5,
    color: Colors.primary,
    lineHeight: 17,
  },
  productNameCompact: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  metaLine: {
    fontFamily: "Jakarta",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  metaCode: {
    fontFamily: "Mono",
    fontSize: 9.5,
    color: Colors.textMuted,
  },
  multiScoreWrap: {
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FAF6F0",
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.28)",
  },
  ringWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringValue: {
    position: "absolute",
    fontFamily: "Mono",
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "700",
  },
  scoreTier: {
    fontFamily: "JakartaSemiBold",
    fontSize: 9.5,
    color: "#7C5E32",
    letterSpacing: 0.3,
  },
  scoreCaption: {
    fontFamily: "Jakarta",
    fontSize: 10.5,
    color: Colors.textSecondary,
  },
  footerNote: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  footerText: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 11,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  footerTextBold: {
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
});
