import { useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { formatVND } from "@/lib/catalog-data";
import {
  DonHang,
  LUONG_TRANG_THAI,
  nhanTrangThai,
  SEED_ORDERS,
  TrangThaiDonHang,
} from "@/lib/orders-data";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";
import { EmptyState } from "@/components/shop/ui";

const TABS: { id: "all" | TrangThaiDonHang; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "CHO_XAC_NHAN", label: "Chờ xác nhận" },
  { id: "DANG_DONG_GOI", label: "Đang đóng gói" },
  { id: "DANG_GIAO_HANG", label: "Đang giao" },
  { id: "HOAN_TAT", label: "Hoàn tất" },
  { id: "DA_HUY", label: "Đã huỷ" },
];

export default function OrdersScreen() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<"all" | TrangThaiDonHang>("all");

  const apiResource = useResource<Row[]>(user ? "/orders?page=0&size=50" : null);

  const orders: DonHang[] =
    apiResource.data && apiResource.data.length > 0
      ? apiResource.data.map((r, i) => ({
          maDonHang: String(r.orderId || `DH${String(i + 1).padStart(8, "0")}`),
          ngayDat: r.createdAt ? new Date(String(r.createdAt)).getTime() : Date.now(),
          lines: ((r.lines || r.items || []) as any[]).map((l, j) => ({
            id: String(l.orderItemId || `item-${j}`),
            maSanPham: String(l.productId || l.maSanPham || "SP00000001"),
            tenSanPham: String(l.productName || l.tenSanPham || "Sản phẩm YoFaSo"),
            hinhAnh: l.imageUrl || l.hinhAnh,
            donGia: Number(l.price || l.donGia || 0),
            tenMau: String(l.colorName || l.tenMau || "Màu chuẩn"),
            maMauHex: String(l.colorHex || l.maMauHex || "#1E293B"),
            size: String(l.size || "M"),
            soLuong: Number(l.quantity || l.soLuong || 1),
          })),
          phuongThuc: (r.paymentMethod === "VIETQR" ? "VIETQR" : "COD") as "COD" | "VIETQR",
          trangThai: (r.status as TrangThaiDonHang) || "DANG_DONG_GOI",
          tongTien: Number(r.totalAmount || r.total || 0),
        }))
      : SEED_ORDERS;

  const filteredOrders = orders.filter(
    (o) => activeTab === "all" || o.trangThai === activeTab
  );

  const getStatusBadgeStyle = (status: TrangThaiDonHang) => {
    switch (status) {
      case "HOAN_TAT":
        return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
      case "DANG_GIAO_HANG":
        return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
      case "DANG_DONG_GOI":
      case "DA_THANH_TOAN":
        return { bg: Colors.champagneSubtle, text: Colors.champagneDeep, border: Colors.champagne };
      case "DA_HUY":
        return { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
      case "CHO_XAC_NHAN":
      default:
        return { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" };
    }
  };

  const renderOrderItem = ({ item }: { item: DonHang }) => {
    const badge = getStatusBadgeStyle(item.trangThai);
    const dateFormatted = new Date(item.ngayDat).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={st.orderCard}>
        {/* Card Header */}
        <View style={st.cardHeader}>
          <View style={st.cardHeaderLeft}>
            <View style={st.orderIconWrap}>
              <Ionicons name="cube-outline" size={18} color={Colors.champagneDeep} />
            </View>
            <View>
              <Text style={st.orderCode}>#{item.maDonHang}</Text>
              <Text style={st.orderDate}>{dateFormatted}</Text>
            </View>
          </View>
          <View
            style={[
              st.statusBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[st.statusBadgeText, { color: badge.text }]}>
              {nhanTrangThai[item.trangThai]}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={st.divider} />

        {/* Product Items Preview */}
        <View style={st.itemsContainer}>
          {item.lines.slice(0, 2).map((line, idx) => (
            <View key={line.id || idx} style={st.productRow}>
              {line.hinhAnh ? (
                <Image
                  source={typeof line.hinhAnh === "string" ? { uri: line.hinhAnh } : line.hinhAnh}
                  style={st.productThumb}
                />
              ) : (
                <View style={[st.productThumb, st.productThumbPlaceholder]}>
                  <Ionicons name="shirt-outline" size={20} color={Colors.muted} />
                </View>
              )}
              <View style={st.productInfo}>
                <Text style={st.productName} numberOfLines={1}>
                  {line.tenSanPham}
                </Text>
                <Text style={st.productMeta}>
                  {line.tenMau} · Size {line.size} · ×{line.soLuong}
                </Text>
              </View>
              <Text style={st.productPrice}>{formatVND(line.donGia * line.soLuong)}</Text>
            </View>
          ))}
          {item.lines.length > 2 && (
            <Text style={st.moreItemsText}>
              + thêm {item.lines.length - 2} sản phẩm khác
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={st.divider} />

        {/* Card Footer */}
        <View style={st.cardFooter}>
          <View style={st.paymentInfo}>
            <Text style={st.paymentLabel}>
              {item.phuongThuc === "VIETQR" ? "VietQR 24/7" : "Thanh toán khi nhận (COD)"}
            </Text>
            <View style={st.totalRow}>
              <Text style={st.totalLabel}>Tổng tiền: </Text>
              <Text style={st.totalAmount}>{formatVND(item.tongTien)}</Text>
            </View>
          </View>

          <View style={st.actionRow}>
            <Pressable
              style={({ pressed }) => [st.detailBtn, pressed && { opacity: 0.8 }]}
              onPress={() =>
                router.push({
                  pathname: "/order/[id]",
                  params: { id: item.maDonHang },
                })
              }
            >
              <Text style={st.detailBtnText}>Chi tiết đơn</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Đơn hàng của tôi",
          headerTitleStyle: {
            fontFamily: "Editorial",
            fontSize: 18,
            color: Colors.primary,
          },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      {/* Horizontal Tabs */}
      <View style={st.tabBarContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.tabScrollContent}
          renderItem={({ item }) => {
            const active = activeTab === item.id;
            return (
              <Pressable
                style={[st.tabChip, active && st.tabChipActive]}
                onPress={() => setActiveTab(item.id)}
              >
                <Text style={[st.tabChipText, active && st.tabChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.maDonHang}
        renderItem={renderOrderItem}
        contentContainerStyle={st.listContent}
        refreshControl={
          <RefreshControl
            refreshing={apiResource.loading}
            onRefresh={() => {
              if (user) apiResource.reload();
            }}
            tintColor={Colors.champagne}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Chưa có đơn hàng nào"
            body="Những bộ trang phục bạn đã đặt sẽ xuất hiện tại đây cùng lộ trình giao nhận theo thời gian thực."
            cta="Khám phá bộ sưu tập"
            onCta={() => router.replace("/(shop)")}
          />
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  tabBarContainer: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    backgroundColor: Colors.canvas,
  },
  tabScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surface,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabChipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.muted,
  },
  tabChipTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.canvas,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 40,
    gap: 16,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  orderCode: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  orderDate: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.muted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.hairline,
    marginVertical: Spacing.sm,
  },
  itemsContainer: {
    gap: 10,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  productThumb: {
    width: 44,
    height: 52,
    borderRadius: Radii.sm,
    backgroundColor: Colors.champagneSubtle,
  },
  productThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  productMeta: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  productPrice: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.primary,
  },
  moreItemsText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontStyle: "italic",
    color: Colors.muted,
    textAlign: "right",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  paymentInfo: {
    gap: 2,
  },
  paymentLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.muted,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.muted,
  },
  totalAmount: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  detailBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
});
