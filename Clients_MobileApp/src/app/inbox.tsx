import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import type { Row } from "@/lib/models";
import {
  LoaiThongBao,
  SEED_NOTIFICATIONS,
  ThongBao,
  timeAgo,
} from "@/lib/orders-data";
import { EmptyState } from "@/components/shop/ui";

const TABS: { id: "all" | LoaiThongBao; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "DON_HANG", label: "Đơn hàng" },
  { id: "THU_DO_VTON", label: "Thử đồ VTON" },
  { id: "KHUYEN_MAI", label: "Khuyến mãi" },
];

export default function InboxScreen() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<"all" | LoaiThongBao>("all");
  const [localNotifications, setLocalNotifications] =
    useState<ThongBao[]>(SEED_NOTIFICATIONS);

  // Live API for logged in users
  const apiResource = useResource<Row[]>(user ? "/notifications?page=0&size=50" : null);

  // Combined notifications: prefer live API if data returned, otherwise fall back to seed
  const notifications: ThongBao[] =
    apiResource.data && apiResource.data.length > 0
      ? apiResource.data.map((r, i) => ({
          id: String(r.notificationId || `api-${i}`),
          loai: (r.type as LoaiThongBao) || "HE_THONG",
          tieuDe: String(r.title || "Thông báo từ YoFaSo"),
          noiDung: String(r.content || r.message || ""),
          time: r.createdAt ? new Date(String(r.createdAt)).getTime() : Date.now(),
          daDoc: Boolean(r.readStatus),
          link: r.orderId
            ? { pathname: "/order/[id]", params: { id: String(r.orderId) } }
            : r.sessionId
              ? { pathname: "/session/[id]", params: { id: String(r.sessionId) } }
              : undefined,
        }))
      : localNotifications;

  const filtered = notifications.filter(
    (n) => activeTab === "all" || n.loai === activeTab
  );

  const unreadCount = notifications.filter((n) => !n.daDoc).length;

  const handleMarkAllRead = () => {
    setLocalNotifications((prev) =>
      prev.map((item) => ({ ...item, daDoc: true }))
    );
    if (user) {
      notifications.forEach((n) => {
        if (!n.daDoc && !n.id.startsWith("n")) {
          api(`/notifications/${n.id}/read`, "POST").catch(() => {});
        }
      });
      apiResource.reload();
    }
  };

  const handleOpenNotification = (n: ThongBao) => {
    setLocalNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, daDoc: true } : item))
    );
    if (user && !n.id.startsWith("n")) {
      api(`/notifications/${n.id}/read`, "POST").catch(() => {});
      apiResource.reload();
    }
    if (n.link) {
      router.push(n.link as any);
    }
  };

  const renderIcon = (loai: LoaiThongBao) => {
    switch (loai) {
      case "DON_HANG":
        return {
          name: "cube-outline" as const,
          bg: "#ECFDF5",
          color: "#059669",
        };
      case "THU_DO_VTON":
        return {
          name: "sparkles" as const,
          bg: Colors.champagneSubtle,
          color: Colors.champagneDeep,
        };
      case "CANH_BAO_KHO":
        return {
          name: "alert-circle-outline" as const,
          bg: "#FFFBEB",
          color: "#D97706",
        };
      case "KHUYEN_MAI":
        return {
          name: "pricetag-outline" as const,
          bg: "#FEF2F2",
          color: "#DC2626",
        };
      case "HE_THONG":
      default:
        return {
          name: "information-circle-outline" as const,
          bg: "#F1F5F9",
          color: "#64748B",
        };
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ThongBao }) => {
      const cfg = renderIcon(item.loai);
      return (
        <Pressable
          style={({ pressed }) => [
            st.itemRow,
            !item.daDoc && st.itemRowUnread,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => handleOpenNotification(item)}
        >
          <View style={[st.iconCircle, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.name} size={20} color={cfg.color} />
          </View>
          <View style={st.itemBody}>
            <View style={st.itemHeaderLine}>
              <Text
                style={[st.itemTitle, !item.daDoc && st.itemTitleUnread]}
                numberOfLines={1}
              >
                {item.tieuDe}
              </Text>
              {!item.daDoc && <View style={st.unreadDot} />}
            </View>
            <Text style={st.itemContent} numberOfLines={2}>
              {item.noiDung}
            </Text>
            <Text style={st.itemTime}>{timeAgo(item.time)}</Text>
          </View>
        </Pressable>
      );
    },
    []
  );

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Thông báo",
          headerTitleStyle: {
            fontFamily: "Editorial",
            fontSize: 18,
            color: Colors.primary,
          },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
          headerRight: () => (
            <Pressable
              onPress={handleMarkAllRead}
              style={({ pressed }) => [
                st.headerActionBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityLabel="Đánh dấu đã đọc tất cả"
            >
              <Ionicons
                name="checkmark-done-circle-outline"
                size={24}
                color={Colors.primary}
              />
            </Pressable>
          ),
        }}
      />

      {/* Category Filter Pills */}
      <View style={st.filterBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[st.tabChip, active && st.tabChipActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[st.tabChipText, active && st.tabChipTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Unread Counter Bar */}
      <View style={st.statusBar}>
        <Text style={st.statusText}>
          {unreadCount > 0
            ? `${unreadCount} thông báo chưa đọc`
            : "Đã đọc tất cả thông báo"}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
            title="Hộp thư đang trống"
            body="Thông báo về đơn hàng, kết quả ướm thử AI và các ưu đãi thành viên sẽ hiển thị tại đây."
            cta="Khám phá ngay"
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
  headerActionBtn: {
    padding: 6,
    borderRadius: 20,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  statusBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 40,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    gap: 12,
  },
  itemRowUnread: {
    backgroundColor: "rgba(247, 243, 235, 0.45)",
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    flex: 1,
  },
  itemTitleUnread: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginLeft: 6,
  },
  itemContent: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.muted,
    marginBottom: 4,
  },
  itemTime: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.muted,
  },
});
