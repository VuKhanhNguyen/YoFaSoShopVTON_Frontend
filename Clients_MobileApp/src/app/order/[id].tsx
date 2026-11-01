import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND } from "@/lib/catalog-data";
import { Button, Notice, Sheet, colors } from "@/components/shop/ui";

const ORDER_STEPS = [
  { code: "CHO_XAC_NHAN", label: "Đã đặt đơn thành công" },
  { code: "DA_THANH_TOAN", label: "Shop đã xác nhận đơn hàng" },
  { code: "DANG_DONG_GOI", label: "Kho đang đóng gói kiện hàng" },
  { code: "DANG_GIAO_HANG", label: "Shipper đang giao hàng", sub: "Shipper nội bộ: Nguyễn Văn Hùng · 0988.***.321" },
  { code: "HOAN_TAT", label: "Đã nhận hàng thành công" },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useResource<Row>(`/orders/${encodeURIComponent(id)}`);

  const [activeStepIndex, setActiveStepIndex] = useState(2); // Simulated progress
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [fitChoice, setFitChoice] = useState("Vừa vặn");
  const [fabricChoice, setFabricChoice] = useState("Đúng mô tả");
  const [toast, setToast] = useState("");

  const o = state.data;
  const isCancelled = o?.status === "DA_HUY";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const handleCancelOrder = async () => {
    try {
      await api(`/orders/${id}/cancel`, "POST").catch(() => {});
      setCancelSheetVisible(false);
      state.reload();
      showToast("Đã hủy đơn hàng thành công");
    } catch {
      setCancelSheetVisible(false);
      showToast("Đã hủy đơn hàng");
    }
  };

  const handleSubmitReview = async () => {
    setReviewSheetVisible(false);
    showToast("Cảm ơn bạn đã gửi đánh giá sản phẩm!");
  };

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: `Đơn hàng #${id}`,
          headerTitleStyle: { fontFamily: "Mono", fontSize: 16 },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        {/* Status Stepper Timeline */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Hành trình đơn hàng</Text>
          {isCancelled ? (
            <Notice error>Đơn hàng này đã được hủy.</Notice>
          ) : (
            <View style={st.timelineList}>
              {ORDER_STEPS.map((step, idx) => {
                const isPassed = idx <= activeStepIndex;
                const isCurrent = idx === activeStepIndex;
                const isLast = idx === ORDER_STEPS.length - 1;

                return (
                  <View key={step.code} style={st.timelineItem}>
                    {/* Vertical connecting line */}
                    {!isLast && (
                      <View
                        style={[
                          st.timelineLine,
                          {
                            backgroundColor:
                              idx < activeStepIndex ? Colors.statusSuccess : Colors.borderHairline,
                          },
                        ]}
                      />
                    )}

                    {/* Step Icon */}
                    <View
                      style={[
                        st.timelineNode,
                        isPassed && st.timelineNodePassed,
                        isCurrent && st.timelineNodeCurrent,
                      ]}
                    >
                      {isPassed ? (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      ) : (
                        <View style={st.timelineNodeInactive} />
                      )}
                    </View>

                    {/* Step Content */}
                    <View style={st.timelineTextCol}>
                      <Text
                        style={[
                          st.timelineStepLabel,
                          isPassed && { color: Colors.primary, fontFamily: "JakartaSemiBold" },
                        ]}
                      >
                        {step.label}
                      </Text>
                      {step.sub && isCurrent && (
                        <Text style={st.timelineStepSub}>{step.sub}</Text>
                      )}
                      <Text style={st.timelineStepCode}>{step.code}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Simulation button */}
          {!isCancelled && activeStepIndex < ORDER_STEPS.length - 1 && (
            <Pressable
              onPress={() => setActiveStepIndex((prev) => prev + 1)}
              style={st.simulateBtn}
            >
              <Text style={st.simulateBtnText}>
                Mô phỏng cập nhật trạng thái tiếp theo →
              </Text>
            </Pressable>
          )}
        </View>

        {/* Order Items */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Sản phẩm trong kiện</Text>
          <View style={st.orderItemRow}>
            <Image source={EditorialImages.shirt} style={st.itemThumb} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>Áo Sơ Mi Lụa Dáng Rộng Cổ V</Text>
              <Text style={st.itemVariant}>Trắng ngà · Size M · ×1</Text>
              <Text style={st.itemPrice}>{formatVND(450000)}</Text>
              {activeStepIndex === ORDER_STEPS.length - 1 && (
                <Pressable
                  onPress={() => setReviewSheetVisible(true)}
                  style={st.reviewActionBtn}
                >
                  <Text style={st.reviewActionText}>Đánh giá sản phẩm</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={[st.orderItemRow, { borderTopWidth: 1, borderTopColor: Colors.borderHairline, paddingTop: 12 }]}>
            <Image source={EditorialImages.pants} style={st.itemThumb} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>Quần Âu Ống Rộng Xếp Ly Cạp Cao</Text>
              <Text style={st.itemVariant}>Xanh rêu · Size M · ×1</Text>
              <Text style={st.itemPrice}>{formatVND(1150000)}</Text>
              {activeStepIndex === ORDER_STEPS.length - 1 && (
                <Pressable
                  onPress={() => setReviewSheetVisible(true)}
                  style={st.reviewActionBtn}
                >
                  <Text style={st.reviewActionText}>Đánh giá sản phẩm</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Shipping & Payment Details */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Thông tin thanh toán</Text>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Tạm tính tiền hàng</Text>
            <Text style={st.calcVal}>{formatVND(1600000)}</Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Giảm giá Voucher (VTON5)</Text>
            <Text style={[st.calcVal, { color: Colors.statusSuccess }]}>−{formatVND(80000)}</Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Phí vận chuyển</Text>
            <Text style={st.calcVal}>Miễn phí</Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Hình thức thanh toán</Text>
            <Text style={st.calcVal}>COD (Thanh toán khi nhận hàng)</Text>
          </View>
          <View style={st.dividerHairline} />
          <View style={[st.calcRow, { alignItems: "baseline" }]}>
            <Text style={st.totalTitle}>TỔNG THANH TOÁN</Text>
            <Text style={st.totalAmount}>{formatVND(1520000)}</Text>
          </View>
        </View>

        {/* Cancel Order Action */}
        {!isCancelled && activeStepIndex === 0 && (
          <Pressable
            onPress={() => setCancelSheetVisible(true)}
            style={st.cancelBtn}
          >
            <Text style={st.cancelBtnText}>HỦY ĐƠN HÀNG</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Cancel Order Confirmation Sheet */}
      <Sheet
        visible={cancelSheetVisible}
        onClose={() => setCancelSheetVisible(false)}
        title="Hủy đơn hàng"
      >
        <View style={{ gap: 14 }}>
          <Text style={{ fontSize: 13, fontFamily: "Jakarta", color: Colors.textSecondary, lineHeight: 18 }}>
            Bạn có chắc muốn hủy đơn hàng #{id}? Cho YoFaSo biết lý do để cải thiện dịch vụ nhé:
          </Text>

          {["Đổi ý không mua nữa", "Muốn đổi size/màu khác", "Thời gian giao quá lâu", "Lý do khác"].map(
            (reason, i) => (
              <Pressable
                key={i}
                onPress={handleCancelOrder}
                style={st.cancelReasonOption}
              >
                <Text style={st.cancelReasonText}>{reason}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            )
          )}
        </View>
      </Sheet>

      {/* Product Review Sheet */}
      <Sheet
        visible={reviewSheetVisible}
        onClose={() => setReviewSheetVisible(false)}
        title="Đánh giá sản phẩm"
      >
        <View style={{ gap: 14 }}>
          {/* 5-Star Rating Row */}
          <View style={{ alignItems: "center", gap: 6, marginVertical: 8 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewRating(star)}
                >
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={32}
                    color={star <= reviewRating ? Colors.champagne : Colors.borderHairline}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 12, fontFamily: "JakartaSemiBold", color: Colors.champagneDeep }}>
              {reviewRating === 5 ? "Tuyệt vời · Rất hài lòng" : `${reviewRating} sao`}
            </Text>
          </View>

          {/* Fit Chips */}
          <Text style={{ fontSize: 13, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
            Độ vừa vặn phom dáng:
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["Chật", "Vừa vặn", "Rộng"].map((f) => (
              <Pressable
                key={f}
                onPress={() => setFitChoice(f)}
                style={[st.chipBtn, fitChoice === f && st.chipBtnActive]}
              >
                <Text style={[st.chipText, fitChoice === f && st.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>

          {/* Fabric Quality Chips */}
          <Text style={{ fontSize: 13, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
            Chất vải thực tế:
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["Mỏng nhẹ", "Đúng mô tả", "Dày dặn", "Cao cấp"].map((c) => (
              <Pressable
                key={c}
                onPress={() => setFabricChoice(c)}
                style={[st.chipBtn, fabricChoice === c && st.chipBtnActive]}
              >
                <Text style={[st.chipText, fabricChoice === c && st.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="Chia sẻ thêm cảm nhận của bạn về sản phẩm..."
            placeholderTextColor={Colors.textMuted}
            value={reviewComment}
            onChangeText={setReviewComment}
            multiline
            numberOfLines={3}
            style={st.reviewInput}
          />

          <Button title="GỬI ĐÁNH GIÁ" accent onPress={handleSubmitReview} />
        </View>
      </Sheet>

      {/* Toast Feedback */}
      {!!toast && (
        <View style={st.toastPopup}>
          <Ionicons name="checkmark-circle" size={17} color={Colors.statusSuccess} />
          <Text style={st.toastPopupText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 16,
    gap: 14,
    ...Shadows.dock,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  timelineList: {
    gap: 20,
    paddingVertical: 6,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    left: 11,
    top: 22,
    bottom: -22,
    width: 2,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineNodePassed: {
    backgroundColor: Colors.statusSuccess,
    borderColor: Colors.statusSuccess,
  },
  timelineNodeCurrent: {
    borderColor: Colors.statusSuccess,
    borderWidth: 3,
  },
  timelineNodeInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderHairline,
  },
  timelineTextCol: {
    flex: 1,
  },
  timelineStepLabel: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  timelineStepSub: {
    fontSize: 11.5,
    fontFamily: "Jakarta",
    color: Colors.champagneDeep,
    marginTop: 2,
  },
  timelineStepCode: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.textMuted,
    marginTop: 2,
  },
  simulateBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  simulateBtnText: {
    fontSize: 11.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
    textDecorationLine: "underline",
  },
  orderItemRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  itemThumb: {
    width: 64,
    height: 80,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  itemName: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  itemVariant: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
    marginTop: 4,
  },
  reviewActionBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginTop: 6,
  },
  reviewActionText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calcLabel: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  calcVal: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
  },
  dividerHairline: {
    height: 1,
    backgroundColor: Colors.borderHairline,
    marginVertical: 4,
  },
  totalTitle: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  cancelBtn: {
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: Colors.statusDangerSubtle,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.statusDanger,
  },
  cancelReasonOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  cancelReasonText: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.primary,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
  },
  chipBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    padding: 12,
    fontSize: 13,
    fontFamily: "Jakarta",
    minHeight: 70,
    textAlignVertical: "top",
  },
  toastPopup: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.toast,
  },
  toastPopupText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
});
