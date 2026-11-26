import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { api, publicUrl } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { formatVND } from "@/lib/catalog-data";
import { Button, Notice, Sheet } from "@/components/shop/ui";
import { AnimatedToast } from "@/components/shop/MotionPrimitives";
import { ListCardSkeleton, SmartImage } from "@/components/shop/Skeleton";

const ORDER_STEPS: { code: string; label: string; sub?: string }[] = [
  { code: "CHO_XAC_NHAN", label: "Chờ xác nhận đơn hàng" },
  { code: "DANG_DONG_GOI", label: "Kho đang đóng gói kiện hàng" },
  { code: "DANG_GIAO_HANG", label: "Shipper đang giao hàng", sub: "Đơn hàng đang trên đường vận chuyển" },
  { code: "HOAN_TAT", label: "Đã nhận hàng thành công" },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useResource<Row>(`/orders/${encodeURIComponent(id)}`);

  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [vietQrSheetVisible, setVietQrSheetVisible] = useState(false);
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [fitChoice, setFitChoice] = useState("Vừa vặn");
  const [fabricChoice, setFabricChoice] = useState("Đúng mô tả");
  const [reviewPhotoUri, setReviewPhotoUri] = useState<string | null>(null);
  const [reviewPhotoMime, setReviewPhotoMime] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");

  const handleDownloadQr = async () => {
    if (!id) return;
    const amount = Number(o?.total || o?.totalAmount || 0);
    const qrUrl = `https://img.vietqr.io/image/TCB-19038917693011-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      id
    )}&accountName=${encodeURIComponent("NGUYEN VU KHANH")}`;

    setDownloadingQr(true);
    setDownloadNotice("");
    try {
      if (Platform.OS === "web") {
        const response = await fetch(qrUrl);
        if (!response.ok) throw new Error("Không tải được ảnh mã QR.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vietqr-${id}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setDownloadNotice("Đã tải mã QR về máy thành công!");
      } else {
        if (!FileSystem.cacheDirectory) {
          throw new Error("Không có thư mục lưu tạm.");
        }
        const local = `${FileSystem.cacheDirectory}vietqr-${id}.png`;
        const response = await FileSystem.downloadAsync(qrUrl, local);
        if (response.status !== 200) {
          throw new Error("Không tải được ảnh mã QR.");
        }
        const MediaLibrary = await import("expo-media-library");
        const { granted } = await MediaLibrary.requestPermissionsAsync(true);
        if (granted) {
          await MediaLibrary.Asset.create(local);
          setDownloadNotice("Đã lưu mã QR vào thư viện ảnh!");
          Alert.alert("Thành công", "Đã lưu mã QR thanh toán vào thư viện ảnh của bạn!");
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(local, {
            mimeType: "image/png",
            dialogTitle: "Lưu hoặc chia sẻ mã QR thanh toán",
          });
          setDownloadNotice("Đã mở chia sẻ mã QR.");
        } else {
          throw new Error("Chưa cấp quyền lưu ảnh vào thư viện.");
        }
      }
    } catch (e: any) {
      setDownloadNotice(e?.message || "Không thể tải mã QR.");
    } finally {
      setDownloadingQr(false);
      setTimeout(() => setDownloadNotice(""), 3000);
    }
  };

  // Auto-reload order details when screen regains focus (e.g. after returning from bank app)
  useFocusEffect(
    useCallback(() => {
      state.reload();
    }, [state.reload])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    state.reload();
  }, [state.reload]);

  useEffect(() => {
    if (!state.loading) {
      setRefreshing(false);
    }
  }, [state.loading]);

  const o = state.data;
  const isCancelled = o?.status === "DA_HUY";

  const getStepIndex = (status?: string) => {
    switch (status) {
      case "CHO_XAC_NHAN":
        return 0;
      case "DANG_DONG_GOI":
        return 1;
      case "DANG_GIAO_HANG":
        return 2;
      case "HOAN_TAT":
        return 3;
      default:
        return 0;
    }
  };
  const activeStepIndex = getStepIndex(o?.status as string);
  const items = (o?.items || []) as any[];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const handleCancelOrder = async () => {
    try {
      await api(`/orders/${encodeURIComponent(id)}/cancel`, "POST");
      setCancelSheetVisible(false);
      state.reload();
      showToast("Đã hủy đơn hàng thành công");
    } catch (e: any) {
      setCancelSheetVisible(false);
      showToast(e?.message || "Không thể hủy đơn hàng");
    }
  };

  const handleConfirmPaid = () => {
    setVietQrSheetVisible(false);
    state.reload();
  };

  const openReviewForLine = (item: any) => {
    setSelectedOrderLineId(String(item.orderLineId || ""));
    setSelectedProductName(String(item.productName || "Sản phẩm YoFaSo"));
    setReviewRating(5);
    setReviewComment("");
    setFitChoice("Vừa vặn");
    setFabricChoice("Đúng mô tả");
    setReviewPhotoUri(null);
    setReviewPhotoMime(null);
    setReviewError("");
    setReviewSheetVisible(true);
  };

  const handlePickReviewPhoto = async () => {
    setReviewError("");
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setReviewError("Cần cấp quyền thư viện ảnh để đính kèm ảnh đánh giá.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          setReviewError("Ảnh đánh giá vượt quá giới hạn 10MB.");
          return;
        }
        setReviewPhotoUri(asset.uri);
        setReviewPhotoMime(asset.mimeType || null);
      }
    } catch (e: any) {
      setReviewError(e?.message || "Không thể chọn ảnh đánh giá.");
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedOrderLineId || submittingReview) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      const tagsPrefix = `[Phom dáng: ${fitChoice} · Chất vải: ${fabricChoice}]`;
      const trimmed = reviewComment.trim();
      const fullComment = (trimmed ? `${tagsPrefix} ${trimmed}` : tagsPrefix).slice(0, 500);
      if (reviewPhotoUri) {
        const form = new FormData();
        form.append("orderLineId", selectedOrderLineId);
        form.append("stars", String(reviewRating));
        form.append("comment", fullComment);
        const isPng = reviewPhotoMime?.includes("png") || reviewPhotoUri.toLowerCase().endsWith(".png");
        const mimeType = isPng ? "image/png" : "image/jpeg";
        const fileName = isPng ? "review.png" : "review.jpg";
        if (Platform.OS === "web") {
          const res = await fetch(reviewPhotoUri);
          const blob = await res.blob();
          form.append("photo", blob, fileName);
        } else {
          try {
            const file = new ExpoFile(reviewPhotoUri);
            form.append("photo", file as unknown as Blob, fileName);
          } catch {
            form.append("photo", { uri: reviewPhotoUri, type: mimeType, name: fileName } as any);
          }
        }
        await api("/reviews", "POST", form);
      } else {
        await api("/reviews", "POST", {
          orderLineId: selectedOrderLineId,
          stars: reviewRating,
          comment: fullComment,
        });
      }
      setReviewSheetVisible(false);
      setReviewPhotoUri(null);
      setReviewPhotoMime(null);
      setReviewComment("");
      state.reload();
      showToast("Đã gửi đánh giá! Đang chờ shop duyệt hiển thị.");
    } catch (e: any) {
      setReviewError(e?.message || "Gửi đánh giá thất bại. Vui lòng thử lại.");
    } finally {
      setSubmittingReview(false);
    }
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.champagneDeep}
            colors={[Colors.champagneDeep]}
          />
        }
      >
        {state.loading && !state.data ? (
          <ListCardSkeleton variant="cards" count={3} />
        ) : (
          <>
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

        </View>

        {/* VietQR Pending Payment Action if applicable */}
        {String(o?.paymentMethod || "").includes("VIETQR") &&
          o?.paymentStatus === "CHUA_THANH_TOAN" &&
          !isCancelled && !o?.paymentExpired && (
            <View
              style={[
                st.card,
                {
                  backgroundColor: "#FFFBEB",
                  borderColor: "#FDE68A",
                  padding: 16,
                  gap: 10,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="qr-code-outline" size={20} color={Colors.champagneDeep} />
                <Text style={{ fontFamily: "JakartaSemiBold", fontSize: 14, color: Colors.primary }}>
                  Chờ thanh toán qua VietQR
                </Text>
              </View>
              <Text style={{ fontFamily: "Jakarta", fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>
                Đơn giữ hàng trong 15 phút kể từ lúc đặt. Nếu bạn đã chuyển tiền, hãy chờ shop đối soát và kiểm tra lại trạng thái.
              </Text>
              <Button
                title="QUÉT MÃ VIETQR THANH TOÁN"
                accent
                onPress={() => setVietQrSheetVisible(true)}
                style={{ height: 44, marginTop: 4 }}
              />
            </View>
          )}

        {/* Order Items */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Sản phẩm trong kiện ({items.length} món)</Text>
          {items.map((item, idx) => (
            <View
              key={String(item.orderLineId || idx)}
              style={[
                st.orderItemRow,
                idx > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: Colors.borderHairline,
                  paddingTop: 12,
                },
              ]}
            >
              <SmartImage
                source={item.coverUrl ? publicUrl(String(item.coverUrl)) : null}
                style={st.itemThumb}
                contentFit="cover"
                borderRadius={Radii.md}
                iconSize={22}
              />
              <View style={{ flex: 1 }}>
                <Text style={st.itemName} numberOfLines={2}>
                  {String(item.productName || "Sản phẩm YoFaSo")}
                </Text>
                <Text style={st.itemVariant}>
                  {String(item.colorName || "Màu chuẩn")} · Size {String(item.size || "M")} · ×{Number(item.quantity || 1)}
                </Text>
                <Text style={st.itemPrice}>
                  {formatVND(Number(item.unitPrice || 0) * Number(item.quantity || 1))}
                </Text>
                {o?.status === "HOAN_TAT" && (
                  item.reviewId ? (
                    <View style={st.reviewedBadge}>
                      <Ionicons
                        name={item.reviewStatus === "DA_HIEN_THI" ? "checkmark-circle" : "time-outline"}
                        size={12}
                        color={item.reviewStatus === "DA_HIEN_THI" ? Colors.statusSuccess : Colors.champagneDeep}
                      />
                      <Text
                        style={[
                          st.reviewedBadgeText,
                          item.reviewStatus === "DA_HIEN_THI" && { color: Colors.statusSuccess },
                        ]}
                      >
                        {item.reviewStatus === "DA_HIEN_THI"
                          ? "Đã đánh giá"
                          : item.reviewStatus === "DA_AN_VI_PHAM"
                          ? "Đánh giá đã ẩn"
                          : "Đã gửi · Chờ duyệt"}
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => openReviewForLine(item)}
                      style={st.reviewActionBtn}
                    >
                      <Text style={st.reviewActionText}>Đánh giá sản phẩm</Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Address */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Địa chỉ nhận hàng</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "JakartaSemiBold", fontSize: 14, color: Colors.primary }}>
              {String(o?.recipientName || "Khách hàng")}
            </Text>
            <Text style={{ fontFamily: "Jakarta", fontSize: 13, color: Colors.textMuted }}>
              {String(o?.phone || "")}
            </Text>
          </View>
          <Text style={{ fontFamily: "Jakarta", fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>
            {String(o?.address || "Nhận tại cửa hàng")}
          </Text>
        </View>

        {/* Shipping & Payment Details */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Thông tin thanh toán</Text>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Tạm tính tiền hàng</Text>
            <Text style={st.calcVal}>{formatVND(Number(o?.subtotal || 0))}</Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Giảm giá Voucher</Text>
            <Text style={[st.calcVal, { color: Colors.statusSuccess }]}>
              −{formatVND(Number(o?.discount || 0))}
            </Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Phí vận chuyển</Text>
            <Text style={st.calcVal}>
              {Number(o?.shippingFee || 0) > 0 ? formatVND(Number(o?.shippingFee)) : "Miễn phí"}
            </Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Hình thức thanh toán</Text>
            <Text style={st.calcVal}>
              {String(o?.paymentMethod || "").includes("VIETQR")
                ? "Chuyển khoản"
                : "COD (Thanh toán khi nhận hàng)"}
            </Text>
          </View>
          <View style={st.calcRow}>
            <Text style={st.calcLabel}>Trạng thái thanh toán</Text>
            <Text
              style={[
                st.calcVal,
                {
                  color:
                    o?.paymentStatus === "DA_THANH_TOAN"
                      ? Colors.statusSuccess
                      : Colors.champagneDeep,
                  fontFamily: "JakartaSemiBold",
                },
              ]}
            >
              {o?.paymentStatus === "DA_THANH_TOAN"
                ? "Đã thanh toán"
                : "Chưa thanh toán"}
            </Text>
          </View>
          <View style={st.dividerHairline} />
          <View style={[st.calcRow, { alignItems: "baseline" }]}>
            <Text style={st.totalTitle}>TỔNG THANH TOÁN</Text>
            <Text style={st.totalAmount}>
              {formatVND(Number(o?.total ?? o?.totalAmount ?? o?.collectAmount ?? 0))}
            </Text>
          </View>
        </View>

        {/* Cancel Order Action */}
        {!isCancelled && o?.status === "CHO_XAC_NHAN" && (
          <Pressable
            onPress={() => setCancelSheetVisible(true)}
            style={st.cancelBtn}
          >
            <Text style={st.cancelBtnText}>HỦY ĐƠN HÀNG</Text>
          </Pressable>
        )}
          </>
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
        onClose={() => !submittingReview && setReviewSheetVisible(false)}
        title="Đánh giá sản phẩm"
      >
        <View style={{ gap: 14 }}>
          {!!selectedProductName && (
            <Text
              numberOfLines={2}
              style={{ fontSize: 13, fontFamily: "JakartaSemiBold", color: Colors.primary }}
            >
              {selectedProductName}
            </Text>
          )}

          {/* 5-Star Rating Row */}
          <View style={{ alignItems: "center", gap: 6, marginVertical: 4 }}>
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
            maxLength={420}
            style={st.reviewInput}
          />

          {/* Optional Photo Upload */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {reviewPhotoUri ? (
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: reviewPhotoUri }}
                  style={{ width: 72, height: 72, borderRadius: Radii.md, backgroundColor: Colors.surfaceMuted }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => {
                    setReviewPhotoUri(null);
                    setReviewPhotoMime(null);
                  }}
                  style={st.removePhotoBtn}
                  accessibilityLabel="Xóa ảnh đính kèm"
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={handlePickReviewPhoto} style={st.addPhotoBtn}>
                <Ionicons name="camera-outline" size={20} color={Colors.champagneDeep} />
                <Text style={{ fontSize: 12, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
                  Thêm ảnh thực tế (tùy chọn)
                </Text>
              </Pressable>
            )}
          </View>

          {!!reviewError && <Notice error>{reviewError}</Notice>}

          <Button
            title={submittingReview ? "ĐANG GỬI ĐÁNH GIÁ..." : "GỬI ĐÁNH GIÁ"}
            accent
            disabled={submittingReview}
            onPress={handleSubmitReview}
          />
        </View>
      </Sheet>

      {/* VietQR Payment Sheet */}
      <Sheet
        visible={vietQrSheetVisible}
        onClose={() => setVietQrSheetVisible(false)}
        title="Quét mã VietQR Napas247"
      >
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 10 }}>
          <Text
            style={{
              fontSize: 13,
              color: Colors.textSecondary,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Mở ứng dụng Ngân hàng của bạn và quét mã QR để thanh toán đơn hàng #{id}
          </Text>

          <View
            style={{
              padding: 12,
              backgroundColor: "#FFFFFF",
              borderRadius: Radii.md,
              borderWidth: 1,
              borderColor: Colors.borderHairline,
            }}
          >
            <Image
              source={{
                uri: `https://img.vietqr.io/image/TCB-19038917693011-compact2.png?amount=${Number(
                  o?.total || o?.totalAmount || 0
                )}&addInfo=${encodeURIComponent(id)}&accountName=${encodeURIComponent(
                  "NGUYEN VU KHANH"
                )}`,
              }}
              style={{ width: 220, height: 220, borderRadius: Radii.sm }}
              resizeMode="contain"
            />
          </View>

          <Pressable
            onPress={handleDownloadQr}
            disabled={downloadingQr}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: Radii.md,
              backgroundColor: Colors.canvas,
              borderWidth: 1,
              borderColor: Colors.borderHairline,
              width: "100%",
            }}
          >
            <Ionicons
              name={downloadingQr ? "hourglass-outline" : "download-outline"}
              size={18}
              color={Colors.primary}
            />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "JakartaSemiBold",
                color: Colors.primary,
              }}
            >
              {downloadingQr ? "Đang tải ảnh mã QR..." : "Tải mã QR thanh toán về máy"}
            </Text>
          </Pressable>

          {!!downloadNotice && (
            <Text
              style={{
                textAlign: "center",
                color: downloadNotice.includes("lưu") || downloadNotice.includes("tải")
                  ? Colors.statusSuccess
                  : "#DC2626",
                fontSize: 12,
                fontFamily: "JakartaSemiBold",
              }}
            >
              {downloadNotice}
            </Text>
          )}

          <View
            style={{
              width: "100%",
              backgroundColor: Colors.canvas,
              padding: 14,
              borderRadius: Radii.md,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>Ngân hàng:</Text>
              <Text style={{ fontSize: 12, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
                Techcombank (Ngân hàng Kỹ Thương)
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>Số tài khoản:</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Mono",
                  color: Colors.primary,
                }}
              >
                19038917693011
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>Chủ tài khoản:</Text>
              <Text style={{ fontSize: 12, fontFamily: "JakartaSemiBold", color: Colors.primary }}>
                NGUYEN VU KHANH
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>Số tiền:</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Mono",
                  color: Colors.statusSuccess,
                }}
              >
                {formatVND(Number(o?.total || o?.totalAmount || 0))}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>Nội dung chuyển khoản:</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Mono",
                  color: Colors.champagneDeep,
                }}
              >
                {id}
              </Text>
            </View>
          </View>

          <Button
            title="Kiểm tra trạng thái thanh toán"
            accent
            onPress={handleConfirmPaid}
            style={{ width: "100%", marginTop: 4 }}
          />
        </View>
      </Sheet>

      {/* Toast Feedback */}
      <AnimatedToast message={toast} tone="success" offset={24} />
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
  reviewedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    marginTop: 6,
  },
  reviewedBadgeText: {
    fontSize: 10.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.champagneDeep,
    backgroundColor: Colors.champagneSubtle,
  },
  removePhotoBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.statusDanger,
    alignItems: "center",
    justifyContent: "center",
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
