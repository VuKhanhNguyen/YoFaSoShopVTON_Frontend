import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { useChatModal } from "@/lib/chat-context";
import {
  RETURN_POLICY_POINTS,
  SHOP_SUPPORT,
  SIZE_GUIDE_ROWS,
  SUPPORT_FAQS,
  openPhoneDialer,
  openShowroomMaps,
  openSupportEmail,
  openZaloChat,
} from "@/lib/support-config";
import { ScalePressable } from "@/components/shop/MotionPrimitives";

export default function SupportScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { user } = useSession();
  const { openChat } = useChatModal();

  const ordersState = useResource<Row[]>(user ? "/orders" : null);
  const vtonState = useResource<Row[]>(user ? "/try-on/sessions" : null);

  const [openFaqId, setOpenFaqId] = useState<string | null>(
    section === "size" ? "size" : SUPPORT_FAQS[0].id,
  );

  const recentOrders = (ordersState.data || []).slice(0, 2);
  const recentSessions = (vtonState.data || []).slice(0, 2);

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Trung tâm Hỗ trợ & Showroom",
          headerTitleStyle: {
            fontFamily: Fonts.editorial,
            fontSize: 18,
            color: Colors.primary,
          },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        {/* 1. KÊNH TƯ VẤN & LIÊN HỆ TRỰC TIẾP */}
        <View style={st.heroCard}>
          <View style={st.heroBadge}>
            <Ionicons name="sparkles" size={12} color={Colors.champagne} />
            <Text style={st.heroBadgeText}>YOFASO CONCIERGE · HỖ TRỢ ĐA KÊNH</Text>
          </View>
          <Text style={st.heroTitle}>Shop có thể giúp gì cho bạn?</Text>
          <Text style={st.heroDesc}>
            Tư vấn chọn size, phối đồ VTON tức thì 24/7 cùng Trợ lý AI hoặc trao đổi trực tiếp cùng Chủ shop ({SHOP_SUPPORT.hours}).
          </Text>

          <View style={st.heroActions}>
            <ScalePressable
              onPress={() => openChat({ channel: "TRO_LY_AI" })}
              style={st.heroPrimaryBtn}
            >
              <Ionicons name="sparkles" size={17} color={Colors.primary} />
              <Text style={st.heroPrimaryText}>Chat với Trợ lý AI (24/7)</Text>
            </ScalePressable>

            <ScalePressable
              onPress={() => openChat({ channel: "CHU_SHOP" })}
              style={st.heroSecondaryBtn}
            >
              <Ionicons name="chatbubbles-outline" size={17} color="#FFFFFF" />
              <Text style={st.heroSecondaryText}>Nhắn tin trực tiếp với Chủ shop</Text>
            </ScalePressable>
          </View>
        </View>

        {/* 1 CHẠM: HOTLINE / ZALO / EMAIL */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionLabel}>LIÊN HỆ CHỦ SHOP</Text>
          <View style={st.quickContactRow}>
            <ScalePressable
              accessibilityLabel={`Gọi Hotline ${SHOP_SUPPORT.hotlineDisplay}`}
              onPress={() => void openPhoneDialer()}
              style={st.contactTile}
            >
              <View style={[st.contactIconWrap, { backgroundColor: Colors.statusSuccessSubtle }]}>
                <Ionicons name="call" size={20} color={Colors.statusSuccess} />
              </View>
              <Text style={st.contactTileTitle}>Gọi Hotline</Text>
              <Text style={st.contactTileSub}>{SHOP_SUPPORT.hotlineDisplay}</Text>
            </ScalePressable>

            <ScalePressable
              accessibilityLabel={`Nhắn Zalo ${SHOP_SUPPORT.hotlineDisplay}`}
              onPress={() => void openZaloChat()}
              style={st.contactTile}
            >
              <View style={[st.contactIconWrap, { backgroundColor: Colors.statusInfoSubtle }]}>
                <Ionicons name="chatbubble-ellipses" size={20} color={Colors.statusInfo} />
              </View>
              <Text style={st.contactTileTitle}>Nhắn Zalo</Text>
              <Text style={st.contactTileSub}>{SHOP_SUPPORT.hotlineDisplay}</Text>
            </ScalePressable>

            <ScalePressable
              accessibilityLabel={`Gửi Email ${SHOP_SUPPORT.email}`}
              onPress={() => void openSupportEmail()}
              style={st.contactTile}
            >
              <View style={[st.contactIconWrap, { backgroundColor: Colors.champagneSubtle }]}>
                <Ionicons name="mail" size={20} color={Colors.champagneDeep} />
              </View>
              <Text style={st.contactTileTitle}>Gửi Email</Text>
              <Text style={st.contactTileSub} numberOfLines={1}>
                CSKH YoFaSo
              </Text>
            </ScalePressable>
          </View>
          <Text style={st.emailHint}>Email trực tiếp: {SHOP_SUPPORT.email}</Text>
        </View>

        {/* 2. HỖ TRỢ NHANH THEO NGỮ CẢNH CÁ NHÂN (chỉ hiện khi đã đăng nhập) */}
        {user && (recentOrders.length > 0 || recentSessions.length > 0) && (
          <View style={st.sectionBlock}>
            <Text style={st.sectionLabel}>HỖ TRỢ NHANH THEO NGỮ CẢNH CỦA BẠN</Text>
            <View style={st.card}>
              {recentOrders.map((ord, idx) => {
                const orderId = String(ord.orderId || ord.maDonHang || "");
                const status = String(ord.status || ord.trangThaiDonHang || "");
                if (!orderId) return null;
                return (
                  <ScalePressable
                    key={`ord-${orderId}`}
                    onPress={() =>
                      openChat({
                        channel: "TRO_LY_AI",
                        orderId,
                        prefill: `Kiểm tra trạng thái giao hàng và hỗ trợ giúp mình đơn hàng ${orderId} nhé.`,
                      })
                    }
                    style={[st.contextRow, idx > 0 && st.rowDivider]}
                  >
                    <View style={[st.rowIconCircle, { backgroundColor: Colors.statusSuccessSubtle }]}>
                      <Ionicons name="cube-outline" size={18} color={Colors.statusSuccess} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.rowTitle}>Hỏi về đơn hàng {orderId}</Text>
                      <Text style={st.rowSub}>Trạng thái hiện tại: {status || "Đang xử lý"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </ScalePressable>
                );
              })}

              {recentSessions.map((ses, idx) => {
                const sessionId = String(ses.sessionId || ses.maPhienThuDo || "");
                const productName = String(ses.productName || ses.tenSanPham || "Phiên thử đồ AI");
                if (!sessionId) return null;
                return (
                  <ScalePressable
                    key={`vton-${sessionId}`}
                    onPress={() =>
                      openChat({
                        channel: "TRO_LY_AI",
                        vtonSessionId: sessionId,
                        prefill: `Phân tích điểm thẩm mỹ và gợi ý phối thêm đồ cho phiên thử đồ ${sessionId} giúp mình nhé.`,
                      })
                    }
                    style={[
                      st.contextRow,
                      (recentOrders.length > 0 || idx > 0) && st.rowDivider,
                    ]}
                  >
                    <View style={[st.rowIconCircle, { backgroundColor: Colors.champagneSubtle }]}>
                      <Ionicons name="shirt-outline" size={18} color={Colors.champagneDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.rowTitle} numberOfLines={1}>
                        Tư vấn phối đồ: {productName}
                      </Text>
                      <Text style={st.rowSub}>Mã phiên VTON: {sessionId}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </ScalePressable>
                );
              })}
            </View>
          </View>
        )}

        {/* 3. CÂU HỎI THƯỜNG GẶP (FAQ ACCORDION + BẢNG SIZE) */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionLabel}>CÂU HỎI THƯỜNG GẶP & BẢNG SIZE</Text>
          <View style={st.card}>
            {SUPPORT_FAQS.map((faq, idx) => {
              const expanded = openFaqId === faq.id;
              return (
                <View key={faq.id} style={idx > 0 ? st.rowDivider : undefined}>
                  <ScalePressable
                    onPress={() => setOpenFaqId(expanded ? null : faq.id)}
                    style={st.faqHeader}
                  >
                    <Text style={st.faqTitle}>{faq.title}</Text>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={Colors.textMuted}
                    />
                  </ScalePressable>
                  {expanded && (
                    <View style={st.faqBodyWrap}>
                      <Text style={st.faqBody}>{faq.body}</Text>
                      {"showSizeTable" in faq && faq.showSizeTable && (
                        <View style={st.sizeTable}>
                          <View style={[st.sizeRow, st.sizeRowHeader]}>
                            <Text style={[st.sizeCell, st.sizeCellHead, { flex: 0.7 }]}>Size</Text>
                            <Text style={[st.sizeCell, st.sizeCellHead]}>Chiều cao</Text>
                            <Text style={[st.sizeCell, st.sizeCellHead]}>Cân nặng</Text>
                            <Text style={[st.sizeCell, st.sizeCellHead]}>Form</Text>
                          </View>
                          {SIZE_GUIDE_ROWS.map((r) => (
                            <View key={r.size} style={st.sizeRow}>
                              <Text style={[st.sizeCell, st.sizeBold, { flex: 0.7 }]}>{r.size}</Text>
                              <Text style={st.sizeCell}>{r.height}</Text>
                              <Text style={st.sizeCell}>{r.weight}</Text>
                              <Text style={st.sizeCell}>{r.fit}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 4. CHÍNH SÁCH ĐỔI TRẢ & BẢO HÀNH O2O */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionLabel}>CHÍNH SÁCH ĐỔI TRẢ & BẢO HÀNH O2O</Text>
          <View style={[st.card, { padding: 16, gap: 10 }]}>
            {RETURN_POLICY_POINTS.map((point, idx) => (
              <View key={idx} style={st.policyRow}>
                <Ionicons name="checkmark-circle" size={17} color={Colors.statusSuccess} />
                <Text style={st.policyText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5. HỆ THỐNG SHOWROOM & VỀ YOFASO SHOP */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionLabel}>HỆ THỐNG SHOWROOM & THƯƠNG HIỆU</Text>
          <View style={[st.card, { padding: 16, gap: 12 }]}>
            <View style={st.showroomHead}>
              <View style={[st.rowIconCircle, { backgroundColor: Colors.champagneSubtle }]}>
                <Ionicons name="storefront-outline" size={20} color={Colors.champagneDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.showroomName}>{SHOP_SUPPORT.showroomName}</Text>
                <Text style={st.showroomMeta}>{SHOP_SUPPORT.hours}</Text>
              </View>
            </View>
            <Text style={st.showroomAddress}>{SHOP_SUPPORT.showroomAddress}</Text>
            <Text style={st.aboutDesc}>
              YoFaSo Shop tiên phong mô hình bán lẻ thời trang đa kênh O2O kết hợp Phòng thử đồ ảo AI VTON và chấm điểm thẩm mỹ trực quan, giúp bạn chọn đúng size, phối chuẩn dáng ngay tại nhà hoặc tại Showroom.
            </Text>

            <View style={st.showroomActions}>
              <ScalePressable
                onPress={() => void openShowroomMaps()}
                style={st.mapBtn}
              >
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                <Text style={st.mapBtnText}>Chỉ đường</Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => void openPhoneDialer()}
                style={st.callOutlineBtn}
              >
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
                <Text style={st.callOutlineText}>Gọi quầy</Text>
              </ScalePressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 42,
    gap: 18,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.xl,
    padding: 20,
    gap: 10,
    ...Shadows.md,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(197, 168, 128, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  heroBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.champagne,
  },
  heroTitle: {
    fontFamily: Fonts.editorial,
    fontSize: 22,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  heroDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 19,
  },
  heroActions: {
    gap: 10,
    marginTop: 6,
  },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: Radii.lg,
    backgroundColor: Colors.champagne,
  },
  heroPrimaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: Radii.lg,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroSecondaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  quickContactRow: {
    flexDirection: "row",
    gap: 10,
  },
  contactTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    ...Shadows.sm,
  },
  contactIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  contactTileTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  contactTileSub: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: Colors.textSecondary,
  },
  emailHint: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    overflow: "hidden",
    ...Shadows.sm,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  rowIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.primary,
  },
  rowSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  faqTitle: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.primary,
  },
  faqBodyWrap: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 10,
  },
  faqBody: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  sizeTable: {
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    overflow: "hidden",
  },
  sizeRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  sizeRowHeader: {
    borderTopWidth: 0,
    backgroundColor: Colors.surfaceMuted,
  },
  sizeCell: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  sizeCellHead: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.primary,
  },
  sizeBold: {
    fontFamily: Fonts.mono,
    color: Colors.primary,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  policyText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  showroomHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  showroomName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.primary,
  },
  showroomMeta: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.champagneDeep,
    marginTop: 2,
  },
  showroomAddress: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  aboutDesc: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  showroomActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  mapBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
  },
  mapBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  callOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.canvas,
  },
  callOutlineText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
});
