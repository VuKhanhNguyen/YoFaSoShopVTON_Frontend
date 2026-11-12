import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library/legacy";
import { api, publicUrl, requestKey } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { money, type Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND } from "@/lib/catalog-data";
import { Button, Notice, Sheet, colors } from "@/components/shop/ui";

export default function CheckoutScreen() {
  const cart = useResource<Row[]>("/cart");
  const addresses = useResource<Row[]>("/me/addresses");

  const params = useLocalSearchParams<{ paymentMethod?: string; voucher?: string }>();
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VIETQR">(
    params.paymentMethod === "VIETQR" ? "VIETQR" : "COD"
  );
  const [vietQrModalVisible, setVietQrModalVisible] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");

  const isFirstMountRef = useRef(true);
  const prevListRef = useRef<Row[]>([]);

  // Auto-reload addresses & cart whenever returning to Checkout (e.g. from /addresses)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        return;
      }
      addresses.reload();
      cart.reload();
    }, [addresses.reload, cart.reload])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    addresses.reload();
    cart.reload();
  }, [addresses.reload, cart.reload]);

  useEffect(() => {
    if (!addresses.loading && !cart.loading) {
      setRefreshing(false);
    }
  }, [addresses.loading, cart.loading]);

  useEffect(() => {
    if (params.paymentMethod === "VIETQR" || params.paymentMethod === "COD") {
      setPaymentMethod(params.paymentMethod);
    }
  }, [params.paymentMethod]);

  const addressList = addresses.data || [];

  useEffect(() => {
    if (addressList.length > 0) {
      const prevList = prevListRef.current;
      const isNewAdded = prevList.length > 0 && addressList.length > prevList.length;

      if (!selectedAddressId || !addressList.some((a) => String(a.addressId) === selectedAddressId)) {
        const def = addressList.find((a) => a.defaultAddress) || addressList[0];
        setSelectedAddressId(String(def.addressId));
      } else if (isNewAdded) {
        // Auto-select newly added address if user just returned from address management
        const newlyAdded = addressList.find(
          (a) => !prevList.some((p) => String(p.addressId) === String(a.addressId))
        );
        if (newlyAdded) {
          setSelectedAddressId(String(newlyAdded.addressId));
        }
      }
    } else {
      setSelectedAddressId("");
    }
    prevListRef.current = addressList;
  }, [addressList]);

  const cartItems = cart.data || [];
  const subtotal = cartItems.reduce(
    (sum, r) => sum + Number(r.unitPrice || 0) * Number(r.quantity || 1),
    0
  );
  const voucherCode = params.voucher;
  let discount = 0;
  let shippingFee = subtotal > 1000000 || subtotal === 0 ? 0 : 30000;

  if (voucherCode) {
    if (voucherCode === "BIRTHDAY15") {
      discount = Math.round(subtotal * 0.15);
    } else if (voucherCode === "FREESHIP") {
      if (subtotal >= 1000000) {
        shippingFee = 0;
      }
    } else {
      discount = Math.round(subtotal * 0.05);
    }
  }
  const total = Math.max(0, subtotal - discount + shippingFee);

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setError("Túi đồ của bạn đang trống. Vui lòng thêm sản phẩm trước khi đặt hàng.");
      return;
    }
    if (!selectedAddressId) {
      setError("Vui lòng chọn hoặc thêm địa chỉ nhận hàng.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const items = cartItems.map((r) => ({
        variantId: String(r.variantId),
        quantity: Number(r.quantity || 1),
      }));

      const res = await api<Row>(
        "/orders",
        "POST",
        {
          items,
          addressId: selectedAddressId,
          paymentMethod:
            paymentMethod === "VIETQR"
              ? "VIETQR_CHUYEN_KHOAN_ONLINE"
              : "COD_TIEN_MAT_KHI_NHAN",
          voucher: voucherCode,
        },
        requestKey()
      );

      const realOrderId = String(res.orderId || res.MaDonHang || "");
      if (!realOrderId) {
        throw new Error("Không nhận được mã đơn hàng từ hệ thống.");
      }
      setCreatedOrderId(realOrderId);

      if (paymentMethod === "VIETQR") {
        setVietQrModalVisible(true);
      } else {
        router.replace({
          pathname: "/order/[id]",
          params: { id: realOrderId },
        });
      }
    } catch (e: any) {
      setError(
        e?.message ||
          "Không thể tạo đơn hàng. Vui lòng kiểm tra lại kết nối và thử lại."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmVietQrPaid = async () => {
    if (!createdOrderId) return;
    setBusy(true);
    try {
      await api(
        `/orders/${encodeURIComponent(createdOrderId)}/confirm-payment`,
        "POST",
        { transactionRef: `VQR-${Date.now()}` }
      ).catch(() => {});
    } finally {
      setBusy(false);
      setVietQrModalVisible(false);
      router.replace({
        pathname: "/order/[id]",
        params: { id: createdOrderId },
      });
    }
  };

  const copyToClipboard = (text: string) => {
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(text);
    } else {
      Clipboard.setString(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = async () => {
    if (!createdOrderId) return;
    const qrUrl = `https://img.vietqr.io/image/TCB-19038917693011-compact2.png?amount=${total}&addInfo=${encodeURIComponent(
      createdOrderId
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
        link.download = `vietqr-${createdOrderId}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setDownloadNotice("Đã tải mã QR về máy thành công!");
      } else {
        if (!FileSystem.cacheDirectory) {
          throw new Error("Không có thư mục lưu tạm.");
        }
        const local = `${FileSystem.cacheDirectory}vietqr-${createdOrderId}.png`;
        const response = await FileSystem.downloadAsync(qrUrl, local);
        if (response.status !== 200) {
          throw new Error("Không tải được ảnh mã QR.");
        }
        const { granted } = await MediaLibrary.requestPermissionsAsync(true);
        if (granted) {
          await MediaLibrary.createAssetAsync(local);
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

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Xác nhận đặt hàng",
          headerTitleStyle: { fontFamily: "Editorial", fontSize: 20 },
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
        {/* Address Selection */}
        <View style={st.sectionBlock}>
          <View style={st.sectionHeaderRow}>
            <Text style={st.sectionTitle}>Địa chỉ nhận hàng</Text>
            <Pressable onPress={() => router.push("/addresses")}>
              <Text style={st.sectionLink}>
                {addressList.length > 0 ? "Thay đổi / Thêm" : "+ Thêm địa chỉ"}
              </Text>
            </Pressable>
          </View>

          {addressList.length === 0 ? (
            <Pressable
              onPress={() => router.push("/addresses")}
              style={[
                st.addressCard,
                {
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 20,
                  gap: 6,
                },
              ]}
            >
              <Ionicons name="location-outline" size={26} color={Colors.champagneDeep} />
              <View style={{ flexDirection: "column" }}>
              <Text
                style={{
                  fontFamily: "JakartaSemiBold",
                  fontSize: 14,
                  color: Colors.primary,
                }}
              >
                Bạn chưa có địa chỉ nhận hàng
              </Text>
              <Text
                style={{
                  fontFamily: "Jakarta",
                  fontSize: 12,
                  color: Colors.champagneDeep,
                }}
              >
                + Nhấn vào đây để thêm địa chỉ giao hàng
              </Text>
              </View>
            </Pressable>
          ) : (
            addressList.map((addr) => {
              const on = selectedAddressId === String(addr.addressId);
              return (
                <Pressable
                  key={String(addr.addressId)}
                  onPress={() => setSelectedAddressId(String(addr.addressId))}
                  style={[st.addressCard, on && st.addressCardActive]}
                >
                  <View style={[st.radioCircle, on && st.radioCircleActive]}>
                    {on && <View style={st.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={st.recipientName}>{String(addr.recipientName || "")}</Text>
                      <Text style={st.recipientPhone}>{String(addr.phone || "")}</Text>
                    </View>
                    <Text style={st.addressText}>
                      {String(addr.street || "")}, {String(addr.ward || "")}, {String(addr.city || "")}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Order Items Preview */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionTitle}>Kiện hàng ({cartItems.length} món)</Text>
          <View style={st.orderPreviewBox}>
            {cartItems.length === 0 ? (
              <Text style={{ fontSize: 13, color: Colors.textMuted, fontStyle: "italic" }}>
                Chưa có sản phẩm nào trong túi đồ.
              </Text>
            ) : (
              cartItems.map((item, idx) => (
                <View
                  key={String(item.variantId || idx)}
                  style={[
                    { flexDirection: "row", alignItems: "center", gap: 12 },
                    idx > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: Colors.borderHairline,
                      paddingTop: 10,
                      marginTop: 10,
                    },
                  ]}
                >
                  {item.coverUrl ? (
                    <Image
                      source={{ uri: publicUrl(String(item.coverUrl)) }}
                      style={st.previewThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={EditorialImages.shirt}
                      style={st.previewThumb}
                      resizeMode="cover"
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={st.previewName} numberOfLines={1}>
                      {String(item.productName || "Sản phẩm YoFaSo")}
                    </Text>
                    <Text style={st.previewSub}>
                      {String(item.colorName || "")} · Size {String(item.size || "")} · ×{Number(item.quantity || 1)}
                    </Text>
                    <Text style={st.previewPrice}>
                      {formatVND(Number(item.unitPrice || 0) * Number(item.quantity || 1))}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Payment Method */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionTitle}>Hình thức thanh toán</Text>

          <Pressable
            onPress={() => setPaymentMethod("COD")}
            style={[st.payCard, paymentMethod === "COD" && st.payCardActive]}
          >
            <View style={[st.radioCircle, paymentMethod === "COD" && st.radioCircleActive]}>
              {paymentMethod === "COD" && <View style={st.radioInner} />}
            </View>
            <Ionicons name="cash-outline" size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>Thanh toán tiền mặt khi nhận hàng (COD)</Text>
              <Text style={st.paySub}>Kiểm tra hàng trước khi thanh toán cho Shipper</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPaymentMethod("VIETQR")}
            style={[st.payCard, paymentMethod === "VIETQR" && st.payCardActive]}
          >
            <View style={[st.radioCircle, paymentMethod === "VIETQR" && st.radioCircleActive]}>
              {paymentMethod === "VIETQR" && <View style={st.radioInner} />}
            </View>
            <Ionicons name="qr-code-outline" size={22} color={Colors.champagneDeep} />
            <View style={{ flex: 1 }}>
              <Text style={st.payTitle}>Chuyển khoản VietQR (Napas247 tự động)</Text>
              <Text style={st.paySub}>Xác nhận thanh toán tức thì qua Webhook ngân hàng</Text>
            </View>
          </Pressable>
        </View>

        {/* Bill Breakdown */}
        <View style={st.breakdownCard}>
          <View style={st.breakdownRow}>
            <Text style={st.breakdownLabel}>Tiền hàng</Text>
            <Text style={st.breakdownVal}>{formatVND(subtotal)}</Text>
          </View>
          <View style={st.breakdownRow}>
            <Text style={st.breakdownLabel}>
              Ưu đãi Voucher {voucherCode ? `(${voucherCode})` : ""}
            </Text>
            <Text style={[st.breakdownVal, discount > 0 && { color: Colors.statusSuccess }]}>
              {discount > 0 ? `−${formatVND(discount)}` : "Không áp dụng"}
            </Text>
          </View>
          <View style={st.breakdownRow}>
            <Text style={st.breakdownLabel}>Phí vận chuyển giao tận nơi</Text>
            <Text style={st.breakdownVal}>
              {shippingFee === 0 ? "Miễn phí" : formatVND(shippingFee)}
            </Text>
          </View>
          <View style={st.divider} />
          <View style={[st.breakdownRow, { alignItems: "baseline" }]}>
            <Text style={st.totalLabel}>TỔNG THANH TOÁN</Text>
            <Text style={st.totalVal}>{formatVND(total)}</Text>
          </View>
        </View>

        {!!error && <Notice error>{error}</Notice>}

        <Button
          title={
            busy
              ? "Đang tạo đơn hàng..."
              : paymentMethod === "COD"
              ? "XÁC NHẬN ĐẶT HÀNG (COD)"
              : "QUÉT MÃ VIETQR THANH TOÁN"
          }
          disabled={busy}
          onPress={handlePlaceOrder}
          style={{ height: 54, marginTop: 10 }}
        />
      </ScrollView>

      {/* Dynamic VietQR Payment Sheet */}
      <Sheet
        visible={vietQrModalVisible}
        onClose={() => {
          setVietQrModalVisible(false);
          router.replace({
            pathname: "/order/[id]",
            params: { id: createdOrderId },
          });
        }}
        title="Quét mã VietQR Napas247"
      >
        <View style={st.vietQrContainer}>
          <Text style={st.qrInstruction}>
            Mở ứng dụng Ngân hàng của bạn và quét mã QR bên dưới để thanh toán đơn hàng #{createdOrderId}
          </Text>

          <View style={st.qrBox}>
            {createdOrderId ? (
              <Image
                source={{
                  uri: `https://img.vietqr.io/image/TCB-19038917693011-compact2.png?amount=${total}&addInfo=${encodeURIComponent(
                    createdOrderId
                  )}&accountName=${encodeURIComponent("NGUYEN VU KHANH")}`,
                }}
                style={{ width: 220, height: 220, borderRadius: Radii.sm }}
                resizeMode="contain"
              />
            ) : (
              <QRCode
                value={`2|99|19038917693011|NGUYEN VU KHANH||0|0|${total}|${createdOrderId}|transfer_myqr`}
                size={190}
                color={Colors.primary}
                backgroundColor="#FFFFFF"
              />
            )}
          </View>

          <Pressable
            onPress={handleDownloadQr}
            disabled={downloadingQr}
            style={st.downloadQrBtn}
          >
            <Ionicons
              name={downloadingQr ? "hourglass-outline" : "download-outline"}
              size={18}
              color={Colors.primary}
            />
            <Text style={st.downloadQrBtnText}>
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

          <View style={st.bankInfoCard}>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Ngân hàng thụ hưởng:</Text>
              <Text style={st.bankInfoVal}>Techcombank (Ngân hàng Kỹ Thương)</Text>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Số tài khoản:</Text>
              <Pressable
                onPress={() => copyToClipboard("19038917693011")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={st.bankInfoValMono}>19038917693011</Text>
                <Ionicons name="copy-outline" size={14} color={Colors.champagneDeep} />
              </Pressable>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Chủ tài khoản:</Text>
              <Text style={st.bankInfoVal}>NGUYEN VU KHANH</Text>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Số tiền:</Text>
              <Text style={[st.bankInfoValMono, { color: Colors.statusSuccess, fontWeight: "700" }]}>
                {formatVND(total)}
              </Text>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Nội dung:</Text>
              <Text style={st.bankInfoValMono}>{createdOrderId}</Text>
            </View>
          </View>

          {copied && (
            <Text style={{ textAlign: "center", color: Colors.statusSuccess, fontSize: 12, fontFamily: "JakartaSemiBold" }}>
              Đã sao chép vào bộ nhớ tạm!
            </Text>
          )}

          <Button
            title="TÔI ĐÃ CHUYỂN KHOẢN THÀNH CÔNG"
            accent
            disabled={busy}
            onPress={handleConfirmVietQrPaid}
            style={{ marginTop: 14 }}
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
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
    gap: 16,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  sectionLink: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    padding: 14,
    ...Shadows.dock,
  },
  addressCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioCircleActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  recipientName: {
    fontSize: 13.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  recipientPhone: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.textSecondary,
  },
  addressText: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 3,
  },
  orderPreviewBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 12,
  },
  previewThumb: {
    width: 60,
    height: 72,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  previewName: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  previewSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    marginTop: 2,
  },
  previewPrice: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    padding: 14,
  },
  payCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  payTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  paySub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 16,
    gap: 10,
    ...Shadows.dock,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  breakdownVal: {
    fontSize: 13,
    fontFamily: "Mono",
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderHairline,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  totalVal: {
    fontSize: 19,
    fontFamily: "Mono",
    fontWeight: "700",
    color: Colors.statusSuccess,
  },
  vietQrContainer: {
    paddingVertical: 10,
    gap: 14,
  },
  qrInstruction: {
    fontSize: 12.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  qrBox: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: Radii.lg,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.dock,
  },
  downloadQrBtn: {
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
    marginTop: -2,
    width: "100%",
  },
  downloadQrBtnText: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  bankInfoCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 14,
    gap: 8,
  },
  bankInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bankInfoLabel: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  bankInfoVal: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  bankInfoValMono: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.primary,
  },
});
