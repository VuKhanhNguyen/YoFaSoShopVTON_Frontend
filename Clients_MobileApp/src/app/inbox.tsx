import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { useSession } from "@/lib/session";
import {
  resolveMobileNotificationTarget,
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";
import { timeAgo } from "@/lib/orders-data";
import { EmptyState } from "@/components/shop/ui";
import { ScalePressable } from "@/components/shop/MotionPrimitives";
import { ListCardSkeleton } from "@/components/shop/Skeleton";

const TABS: { id: "all" | NotificationType; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "DON_HANG", label: "Đơn hàng" },
  { id: "THU_DO_VTON", label: "Thử đồ VTON" },
  { id: "KHUYEN_MAI", label: "Khuyến mãi" },
  { id: "HE_THONG", label: "Hệ thống" },
];

const TYPE_META: Record<
  NotificationType,
  { name: keyof typeof Ionicons.glyphMap; bg: string; color: string; label: string }
> = {
  DON_HANG: {
    name: "cube-outline",
    bg: "#ECFDF5",
    color: "#059669",
    label: "Đơn hàng",
  },
  THU_DO_VTON: {
    name: "sparkles",
    bg: Colors.champagneSubtle,
    color: Colors.champagneDeep,
    label: "Thử đồ VTON",
  },
  CANH_BAO_KHO: {
    name: "alert-circle-outline",
    bg: "#FFFBEB",
    color: "#D97706",
    label: "Cảnh báo kho",
  },
  KHUYEN_MAI: {
    name: "pricetag-outline",
    bg: "#FEF2F2",
    color: "#DC2626",
    label: "Khuyến mãi",
  },
  HE_THONG: {
    name: "information-circle-outline",
    bg: "#F1F5F9",
    color: "#64748B",
    label: "Hệ thống",
  },
};

function formatFullTimestamp(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InboxScreen() {
  const { user } = useSession();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    navigateToTarget,
  } = useNotifications();
  const [activeTab, setActiveTab] = useState<"all" | NotificationType>("all");
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  const filtered = useMemo(
    () =>
      notifications.filter(
        (n) => activeTab === "all" || n.loai === activeTab,
      ),
    [notifications, activeTab],
  );

  const handleMarkAllRead = useCallback(() => {
    if (!user || unreadCount === 0) return;
    void markAllRead();
  }, [user, unreadCount, markAllRead]);

  const handleOpenNotification = useCallback(
    (n: AppNotification) => {
      if (!n.daDoc) {
        void markRead(n.id);
      }
      setSelectedNotif({ ...n, daDoc: true });
    },
    [markRead],
  );

  const selectedTarget = useMemo(
    () =>
      selectedNotif
        ? resolveMobileNotificationTarget(selectedNotif.rawLink, selectedNotif.loai)
        : null,
    [selectedNotif],
  );

  const handleNavigateFromModal = useCallback(() => {
    if (!selectedNotif) return;
    const { rawLink, loai } = selectedNotif;
    setSelectedNotif(null);
    navigateToTarget(rawLink, loai);
  }, [selectedNotif, navigateToTarget]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const cfg = TYPE_META[item.loai] || TYPE_META.HE_THONG;
      const target = resolveMobileNotificationTarget(item.rawLink, item.loai);
      return (
        <ScalePressable
          activeScale={0.985}
          style={[st.itemRow, !item.daDoc && st.itemRowUnread]}
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
            <View style={st.itemFooterLine}>
              <Text style={st.itemTime}>{timeAgo(item.time)}</Text>
              {target && (
                <View style={st.linkHint}>
                  <Text style={st.linkHintText}>Xem chi tiết</Text>
                  <Ionicons name="chevron-forward" size={12} color={Colors.champagneDeep} />
                </View>
              )}
            </View>
          </View>
        </ScalePressable>
      );
    },
    [handleOpenNotification],
  );

  const selectedMeta = selectedNotif
    ? TYPE_META[selectedNotif.loai] || TYPE_META.HE_THONG
    : null;

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
            <ScalePressable
              activeScale={0.9}
              hitSlop={6}
              onPress={handleMarkAllRead}
              disabled={!user || unreadCount === 0}
              style={[
                st.headerActionBtn,
                (!user || unreadCount === 0) && { opacity: 0.35 },
              ]}
              accessibilityLabel="Đánh dấu đã đọc tất cả"
            >
              <Ionicons
                name="checkmark-done-circle-outline"
                size={24}
                color={Colors.primary}
              />
            </ScalePressable>
          ),
        }}
      />

      {/* Category Filter Pills */}
      <View style={st.filterBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.filterBar}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <ScalePressable
                key={tab.id}
                activeScale={0.95}
                style={[st.tabChip, active && st.tabChipActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text
                  style={[st.tabChipText, active && st.tabChipTextActive]}
                >
                  {tab.label}
                </Text>
              </ScalePressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Unread Counter Bar */}
      <View style={st.statusBar}>
        <Text style={st.statusText}>
          {!user
            ? "Đăng nhập để nhận thông báo đơn hàng & VTON"
            : unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Đã đọc tất cả thông báo"}
        </Text>
        {!!user && (
          <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
            <Text style={st.settingsLink}>Cài đặt Push</Text>
          </Pressable>
        )}
      </View>

      {!!error && (
        <View style={st.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <Text style={st.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={!user || (loading && notifications.length === 0) ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={st.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              if (user) void refresh(false);
            }}
            tintColor={Colors.champagne}
          />
        }
        ListEmptyComponent={
          !user ? (
            <EmptyState
              title="Bạn chưa đăng nhập"
              body="Đăng nhập tài khoản YoFaSo để theo dõi cập nhật đơn hàng, kết quả thử đồ AI và ưu đãi thành viên."
              cta="Đăng nhập ngay"
              onCta={() => router.push("/auth")}
            />
          ) : loading && notifications.length === 0 ? (
            <ListCardSkeleton variant="rows" count={4} />
          ) : (
            <EmptyState
              title="Hộp thư đang trống"
              body="Thông báo về đơn hàng, kết quả ướm thử AI và các ưu đãi thành viên sẽ hiển thị tại đây."
              cta="Khám phá ngay"
              onCta={() => router.replace("/(shop)")}
            />
          )
        }
      />

      {/* Notification Detail Modal */}
      <Modal
        visible={selectedNotif !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotif(null)}
      >
        <Pressable
          style={st.modalBackdrop}
          onPress={() => setSelectedNotif(null)}
        >
          <Pressable
            style={st.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedNotif && selectedMeta && (
              <>
                <View style={st.modalHeader}>
                  <View style={st.modalCategoryRow}>
                    <View
                      style={[
                        st.modalIconCircle,
                        { backgroundColor: selectedMeta.bg },
                      ]}
                    >
                      <Ionicons
                        name={selectedMeta.name}
                        size={18}
                        color={selectedMeta.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          st.modalCategoryLabel,
                          { color: selectedMeta.color },
                        ]}
                      >
                        {selectedMeta.label}
                      </Text>
                      <Text style={st.modalTimestamp}>
                        {formatFullTimestamp(selectedNotif.time)} ({timeAgo(selectedNotif.time)})
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setSelectedNotif(null)}
                    hitSlop={10}
                    accessibilityLabel="Đóng chi tiết thông báo"
                    style={st.modalCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={Colors.muted} />
                  </Pressable>
                </View>

                <Text style={st.modalTitle}>{selectedNotif.tieuDe}</Text>

                <ScrollView
                  style={st.modalBodyScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={st.modalBodyText}>
                    {selectedNotif.noiDung || "Không có nội dung chi tiết bổ sung."}
                  </Text>
                </ScrollView>

                <View style={st.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      st.modalSecondaryBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedNotif(null)}
                  >
                    <Text style={st.modalSecondaryText}>Đóng</Text>
                  </Pressable>
                  {selectedTarget && (
                    <Pressable
                      style={({ pressed }) => [
                        st.modalPrimaryBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={handleNavigateFromModal}
                    >
                      <Text style={st.modalPrimaryText}>{selectedTarget.label}</Text>
                      <Ionicons name="arrow-forward" size={15} color={Colors.canvas} />
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  filterBarWrap: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
  },
  settingsLink: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: Colors.champagneDeep,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    padding: 10,
    borderRadius: Radii.sm,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: "#92400E",
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
    backgroundColor: "rgba(247, 243, 235, 0.55)",
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
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.muted,
    marginBottom: 6,
  },
  itemFooterLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTime: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: Colors.muted,
  },
  linkHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkHintText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: Colors.champagneDeep,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 16, 14, 0.52)",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.lg,
    maxHeight: "78%",
    ...Shadows.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: Spacing.sm,
  },
  modalCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCategoryLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  modalTimestamp: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: Colors.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontFamily: "Editorial",
    fontSize: 18,
    lineHeight: 24,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  modalBodyScroll: {
    maxHeight: 260,
    marginBottom: Spacing.md,
  },
  modalBodyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  modalSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.canvas,
  },
  modalSecondaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  modalPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primary,
    flexShrink: 1,
  },
  modalPrimaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.canvas,
  },
});
