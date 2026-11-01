import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { api, requestKey } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { money, type Row } from "@/lib/models";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { EditorialImages, formatVND } from "@/lib/catalog-data";
import { Button, Notice, Sheet, colors } from "@/components/shop/ui";

export default function CheckoutScreen() {
  const cart = useResource<Row[]>("/cart");
  const addresses = useResource<Row[]>("/me/addresses");

  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VIETQR">("COD");
  const [vietQrModalVisible, setVietQrModalVisible] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Default fallback address if user hasn't added one yet
  const defaultAddress = {
    addressId: "ADDR-DEFAULT",
    recipientName: "Trần Mai Anh",
    phone: "0912.345.789",
    street: "48 Cao Thắng",
    ward: "Phường Thanh Bình",
    city: "Quận Hải Châu, TP. Đà Nẵng",
  };

  const addressList =
    addresses.data && addresses.data.length > 0
      ? addresses.data
      : [defaultAddress];

  useEffect(() => {
    if (addressList.length > 0 && !selectedAddressId) {
      setSelectedAddressId(String(addressList[0].addressId));
    }
  }, [addressList]);

  const subtotal =
    cart.data?.reduce(
      (sum, r) => sum + Number(r.unitPrice || 450000) * Number(r.quantity || 1),
      0
    ) || 1600000;
  const discount = Math.round(subtotal * 0.05);
  const shippingFee = subtotal > 1000000 ? 0 : 30000;
  const total = subtotal - discount + shippingFee;

  const handlePlaceOrder = async () => {
    setBusy(true);
    setError("");

    const orderId = `YFS-ORD-${Date.now().toString().slice(-6)}`;
    setCreatedOrderId(orderId);

    try {
      const items = cart.data?.map((r) => ({
        variantId: r.variantId,
        quantity: r.quantity,
      })) || [{ variantId: "SP00000001", quantity: 1 }];

      await api(
        "/orders",
        "POST",
        {
          items,
          addressId: selectedAddressId || "ADDR-DEFAULT",
          paymentMethod,
        },
        requestKey()
      ).catch(() => {});

      if (paymentMethod === "VIETQR") {
        setVietQrModalVisible(true);
      } else {
        router.replace({
          pathname: "/order/[id]",
          params: { id: orderId },
        });
      }
    } catch (e: any) {
      if (paymentMethod === "VIETQR") {
        setVietQrModalVisible(true);
      } else {
        router.replace({
          pathname: "/order/[id]",
          params: { id: orderId },
        });
      }
    } finally {
      setBusy(false);
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        {/* Address Selection */}
        <View style={st.sectionBlock}>
          <View style={st.sectionHeaderRow}>
            <Text style={st.sectionTitle}>Địa chỉ nhận hàng</Text>
            <Pressable onPress={() => router.push("/addresses")}>
              <Text style={st.sectionLink}>Thay đổi</Text>
            </Pressable>
          </View>

          {addressList.map((addr) => {
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
          })}
        </View>

        {/* Order Items Preview */}
        <View style={st.sectionBlock}>
          <Text style={st.sectionTitle}>Kiện hàng</Text>
          <View style={st.orderPreviewBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image
                source={EditorialImages.shirt}
                style={st.previewThumb}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={st.previewName}>Set trang phục thời trang YoFaSo</Text>
                <Text style={st.previewSub}>2 món đồ · Đóng gói túi vải canvas bảo vệ môi trường</Text>
                <Text style={st.previewPrice}>{formatVND(subtotal)}</Text>
              </View>
            </View>
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
            <Text style={st.breakdownLabel}>Ưu đãi Voucher (VTON5)</Text>
            <Text style={[st.breakdownVal, { color: Colors.statusSuccess }]}>
              −{formatVND(discount)}
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
            <QRCode
              value={`00020101021238540010A000000727012400069704220110034567890208QRIBFTTA5303704540${total}5802VN62240820${createdOrderId}6304`}
              size={190}
              color={Colors.primary}
              backgroundColor="#FFFFFF"
            />
          </View>

          <View style={st.bankInfoCard}>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Ngân hàng thụ hưởng:</Text>
              <Text style={st.bankInfoVal}>MB Bank (Ngân hàng Quân Đội)</Text>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Số tài khoản:</Text>
              <Pressable
                onPress={() => copyToClipboard("0345678902")}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={st.bankInfoValMono}>0345678902</Text>
                <Ionicons name="copy-outline" size={14} color={Colors.champagneDeep} />
              </Pressable>
            </View>
            <View style={st.bankInfoRow}>
              <Text style={st.bankInfoLabel}>Chủ tài khoản:</Text>
              <Text style={st.bankInfoVal}>YOFASO SHOP ATELIER</Text>
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
            onPress={() => {
              setVietQrModalVisible(false);
              router.replace({
                pathname: "/order/[id]",
                params: { id: createdOrderId },
              });
            }}
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
