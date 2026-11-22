import { memo, useCallback, useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useResource } from "@/hooks/use-resource";
import { PrivateImage } from "./PrivateImage";
import { ShopHeader } from "./ShopHeader";
import { useSession } from "@/lib/session";
import { isPending, statusLabel, type TryOnSession } from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { Button, EmptyState, State } from "./ui";
import { ScalePressable } from "./MotionPrimitives";

const PAGE_SIZE = 20;

const PendingPulseDot = memo(function PendingPulseDot({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active || reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.32, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, [active, reducedMotion, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[st.pendingDot, animStyle]} />;
});

function scoreTone(score: number) {
  if (score >= 85) return { text: Colors.statusSuccess, bg: Colors.statusSuccessSubtle };
  if (score >= 70) return { text: Colors.statusInfo, bg: Colors.statusInfoSubtle };
  if (score >= 50) return { text: Colors.statusWarning, bg: Colors.statusWarningSubtle };
  return { text: Colors.statusDanger, bg: Colors.statusDangerSubtle };
}

export function Wardrobe() {
  const { user } = useSession();
  const [page, setPage] = useState(0);
  const state = useResource<TryOnSession[]>(user ? "/try-on/sessions?size=" + PAGE_SIZE + "&page=" + page : null);
  const { reload } = state;
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");

  useFocusEffect(useCallback(() => {
    setFocused(true);
    reload();
    return () => setFocused(false);
  }, [reload]));

  useEffect(() => {
    const listener = AppState.addEventListener("change", next => {
      setForeground(next === "active");
      if (next === "active" && focused && user) reload();
    });
    return () => listener.remove();
  }, [focused, reload, user]);

  useEffect(() => {
    if (!user || !focused || !foreground || state.loading || !state.data?.some(item => isPending(item.status))) return;
    const timer = setTimeout(reload, state.error ? 12000 : 3500);
    return () => clearTimeout(timer);
  }, [user, focused, foreground, state.data, state.loading, state.error, reload]);

  return (
    <View style={st.page}>
      <ShopHeader
        showLogo
        title="YoFaSo"
        badgeText="Your Fashion, Your Own Soul"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
      >
        <View style={st.titleBanner}>
          <View style={st.titleRow}>
            <Text style={st.sectionTitle}>Tủ đồ VTON</Text>
            <View style={st.studioPill}>
              <Text style={st.studioPillText}>AI Studio</Text>
            </View>
          </View>
          <Text style={st.sectionSubtitle}>
            Lưu trữ các phiên ướm thử & bảng điểm Stylist
          </Text>
        </View>
        {!user ? (
          <EmptyState
            title="Đăng nhập để mở tủ đồ"
            body="Lưu lại toàn bộ kết quả thử đồ AI, so sánh trước sau và nhận gợi ý phối đồ cá nhân."
            cta="Đăng nhập ngay"
            onCta={() => router.push("/auth")}
          />
        ) : (
          <>
            <State
              loading={!state.data && state.loading}
              error={state.error}
              retry={reload}
              variant="grid"
              skeletonCount={4}
            />

            {state.data?.length === 0 && (
              <EmptyState
                title="Tủ đồ VTON còn trống"
                body="Hãy chọn một sản phẩm yêu thích và bấm Thử đồ để xem phối cảnh thực tế."
                cta="Mở phòng thử đồ"
                onCta={() => router.push("/try-on")}
              />
            )}

            <View style={st.grid}>
              {state.data?.map(item => {
                const pending = isPending(item.status);
                const tone = item.score != null ? scoreTone(item.score) : null;
                return (
                  <ScalePressable
                    key={item.sessionId}
                    style={st.card}
                    activeScale={0.97}
                    onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.sessionId } })}
                  >
                    <View style={st.thumbWrapper}>
                      {item.resultAssetId ? (
                        <PrivateImage assetId={item.resultAssetId} thumbnail style={st.thumb} resizeMode="cover" />
                      ) : item.personAssetId ? (
                        <PrivateImage assetId={item.personAssetId} thumbnail style={st.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[st.thumb, st.emptyThumb]}>
                          <Ionicons name="shirt-outline" size={28} color={Colors.textMuted} />
                        </View>
                      )}

                      {pending && (
                        <View style={st.pendingPill}>
                          <PendingPulseDot active={focused && foreground} />
                          <Text style={st.pendingPillText}>
                            {item.progress && item.progress > 0 ? `${item.progress}%` : "Đang xử lý"}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={st.cardBody}>
                      <View style={st.cardMeta}>
                        <Text style={st.sessionId} numberOfLines={1}>{item.sessionId}</Text>
                        {tone && item.score != null ? (
                          <View style={[st.scoreBadge, { backgroundColor: tone.bg }]}>
                            <Text style={[st.scoreText, { color: tone.text }]}>{item.score}đ</Text>
                          </View>
                        ) : (
                          <Text style={st.statusText}>{statusLabel(item.status)}</Text>
                        )}
                      </View>
                      <Text style={st.productName} numberOfLines={1}>{item.productName}</Text>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>

            {(page > 0 || state.data?.length === PAGE_SIZE) && (
              <View style={st.paginationRow}>
                {page > 0 && <Button secondary title="Trang trước" onPress={() => setPage(page - 1)} style={{ flex: 1 }} />}
                {state.data?.length === PAGE_SIZE && <Button secondary title="Trang sau" onPress={() => setPage(page + 1)} style={{ flex: 1 }} />}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  newTryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 112,
    gap: 16,
  },
  titleBanner: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  studioPill: {
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
  },
  studioPillText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  card: {
    width: "48.2%",
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.sm,
  },
  thumbWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: Colors.surfaceMuted,
    position: "relative",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  emptyThumb: {
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.5)",
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.champagneDeep,
  },
  pendingPillText: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.primary,
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  sessionId: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: "Mono",
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  scoreText: {
    fontSize: 11,
    fontFamily: "Mono",
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
  },
  productName: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  paginationRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
