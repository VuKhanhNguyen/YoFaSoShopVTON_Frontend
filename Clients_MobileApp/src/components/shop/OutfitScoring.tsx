import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { api, publicUrl } from "@/lib/api";
import { formatVND } from "@/lib/catalog-data";
import { useResource } from "@/hooks/use-resource";
import type { Page, Product, Row } from "@/lib/models";
import type { ColorSwatch } from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { SelectField } from "./SelectField";
import { Button, Field, Notice, State } from "./ui";
import { AnimatedProgressBar, ScalePressable } from "./MotionPrimitives";
import { SmartImage } from "./Skeleton";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * 38;

export type RecommendedTryOnItem = {
  productId: string;
  variantId: string;
  category: string;
  name: string;
  imageUrl?: string;
  projectedScore?: number;
};

export type OutfitScoringProps = {
  sessionId: string;
  variantId: string;
  category?: string;
  shopModelId?: string;
  initialScore?: number | null;
  initialAdvice?: string;
  initialProportion?: number;
  initialColor?: number;
  initialPattern?: number;
  initialPenalty?: number;
  initialTier?: string;
  initialTierLabel?: string;
  initialProportionRule?: string;
  initialProportionNote?: string;
  initialColorNote?: string;
  initialColorSwatches?: ColorSwatch[];
  initialRecommendedColors?: ColorSwatch[];
  singleItemPreview?: {
    evaluated: boolean;
    singleItem: boolean;
    colorName?: string;
    colorNote?: string;
    colorSwatches?: ColorSwatch[];
    recommendedColors?: ColorSwatch[];
    patternRule?: string;
    patternNote?: string;
    source?: string;
  };
  onTry?: (item: RecommendedTryOnItem) => void;
  onScoreUpdated?: (update: { total: number; tier?: string; tierLabel?: string }) => void;
  onSingleBuy?: () => void;
  onComboBuy?: (secondVariantId?: string) => void;
};

function tierVisual(total: number, rawTier?: string) {
  const tier = rawTier || (total >= 85 ? "RECOMMENDED" : total >= 70 ? "ACCEPTABLE" : total >= 50 ? "NEEDS_ADJUSTMENT" : "NOT_RECOMMENDED");
  if (tier === "RECOMMENDED" || total >= 85) {
    return {
      tier,
      color: Colors.statusSuccess,
      bg: Colors.statusSuccessSubtle,
    };
  }
  if (tier === "ACCEPTABLE" || total >= 70) {
    return {
      tier,
      color: Colors.statusInfo,
      bg: Colors.statusInfoSubtle,
    };
  }
  if (tier === "NEEDS_ADJUSTMENT" || total >= 50) {
    return {
      tier,
      color: Colors.statusWarning,
      bg: Colors.statusWarningSubtle,
    };
  }
  return {
    tier,
    color: Colors.statusDanger,
    bg: Colors.statusDangerSubtle,
  };
}

const HEX_PAIR_RE = /([^+()]+?)\s*\((#[0-9A-Fa-f]{6})\)/g;

function stripHexAndLegacyPrefix(text: string): string {
  return text
    .replace(/^Ước tính quy tắc catalog;\s*/i, "")
    .replace(/\s*\(#[0-9A-Fa-f]{6}\)/g, "")
    .replace(/#[0-9A-Fa-f]{6}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSwatches(raw: unknown, fallbackText?: string): ColorSwatch[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
      .map((x) => ({
        name: stripHexAndLegacyPrefix(String(x.name || "")),
        hex: String(x.hex || "#CBD5E1"),
        score: x.score != null ? Number(x.score) : undefined,
      }))
      .filter((x) => x.name.length > 0 && /^#[0-9A-Fa-f]{6}$/.test(x.hex));
  }
  if (!fallbackText) return [];
  const parsed: ColorSwatch[] = [];
  for (const match of fallbackText.matchAll(HEX_PAIR_RE)) {
    const name = match[1].replace(/^\+\s*/, "").trim();
    const hex = match[2].toUpperCase();
    if (name && !parsed.some((p) => p.hex === hex)) {
      parsed.push({ name, hex });
    }
  }
  return parsed;
}

function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 215;
}

export function OutfitScoring({
  sessionId,
  variantId,
  category,
  shopModelId,
  initialScore,
  initialAdvice,
  initialProportion,
  initialColor,
  initialPattern,
  initialPenalty,
  initialTier,
  initialTierLabel,
  initialProportionRule,
  initialProportionNote,
  initialColorNote,
  initialColorSwatches,
  initialRecommendedColors,
  singleItemPreview,
  onTry,
  onScoreUpdated,
  onSingleBuy,
  onComboBuy,
}: OutfitScoringProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [productId, setProduct] = useState("");
  const [second, setSecond] = useState("");
  const [tucked, setTucked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [score, setScore] = useState<Row | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<Row[]>([]);

  const savedSuggestions = useResource<Row[]>(
    category !== "dress" ? `/scoring/sessions/${sessionId}/recommendations` : null,
  );

  useEffect(() => {
    if (savedSuggestions.data) {
      setSuggestions(savedSuggestions.data);
    }
  }, [savedSuggestions.data]);

  const products = useResource<Page<Product>>(
    search ? `/catalog/products?q=${encodeURIComponent(search)}&limit=20` : null,
  );
  const detail = useResource<Product>(
    productId ? `/catalog/products/${productId}` : null,
  );

  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function evaluatePairing(pairVariantId: string) {
    await task(async () => {
      setSecond(pairVariantId);
      const res = await api<Row>(`/scoring/sessions/${sessionId}`, "POST", {
        firstVariantId: variantId,
        ...(pairVariantId ? { secondVariantId: pairVariantId } : {}),
        tucked,
      });
      setScore(res);
      onScoreUpdated?.({
        total: Number(res.total ?? 0),
        tier: res.tier ? String(res.tier) : undefined,
        tierLabel: res.tierLabel ? String(res.tierLabel) : undefined,
      });
    });
  }

  const hasFullScore = score != null || initialScore != null;
  const total = Number(score?.total ?? initialScore ?? 0);
  const proportion = Number(score?.proportion ?? initialProportion ?? 0);
  const color = Number(score?.color ?? initialColor ?? 0);
  const pattern = Number(score?.pattern ?? initialPattern ?? 0);
  const penalty = Number(score?.penalty ?? initialPenalty ?? 0);

  const visual = tierVisual(total, (score?.tier ?? initialTier) as string | undefined);
  const tierLabel = String(score?.tierLabel ?? initialTierLabel ?? visual.tier);
  const formula = String(score?.formula ?? `S = 0.4·${proportion} + 0.4·${color} + 0.2·${pattern} - ${penalty}`);
  const stylistComment = stripHexAndLegacyPrefix(
    String(
      score?.stylistComment ??
        score?.advice ??
        initialAdvice ??
        ""
    )
  );
  const isAiStylist =
    Boolean(score?.stylistEnhanced) ||
    String(score?.aiModelSource || "").startsWith("AI_STYLIST_");

  const rawColorNote = String((score?.breakdown as any)?.color?.stylistNote || initialColorNote || "");
  const activeColorSwatches = normalizeSwatches(
    score?.colorSwatches ?? (score?.breakdown as any)?.color?.swatches ?? initialColorSwatches,
    rawColorNote
  );
  const recommendedColors = normalizeSwatches(
    score?.recommendedColors ?? initialRecommendedColors
  );
  const singleColorSwatches = normalizeSwatches(
    singleItemPreview?.colorSwatches,
    singleItemPreview?.colorNote
  );
  const singleRecommendedColors = normalizeSwatches(singleItemPreview?.recommendedColors);

  const breakdownNotes = {
    proportion: String((score?.breakdown as any)?.proportion?.stylistNote || initialProportionNote || (score?.proportionRule ?? initialProportionRule ?? "")),
    color: stripHexAndLegacyPrefix(rawColorNote),
    pattern: String((score?.breakdown as any)?.pattern?.stylistNote || ""),
  };

  function handleTrySuggestion(r: Row) {
    const prodId = String(r.productId || "");
    const varId = String(r.variantId || "");
    if (!prodId || !varId || !onTry) return;
    const targetCategory = String(
      r.vtonCategory || (category === "upper_body" ? "lower_body" : "upper_body")
    );
    onTry({
      productId: prodId,
      variantId: varId,
      category: targetCategory,
      name: String(r.name || varId),
      imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
      projectedScore: r.projectedScore != null ? Number(r.projectedScore) : undefined,
    });
  }

  const highestScore = suggestions.length > 0 ? Number(suggestions[0].projectedScore || 0) : 0;
  const comboTargetVariantId = second || (suggestions[0]?.variantId ? String(suggestions[0].variantId) : undefined);
  const ringStroke = visual.color;

  const reducedMotion = useReducedMotion();
  const ringProgress = useSharedValue(reducedMotion ? Math.min(100, Math.max(0, total)) / 100 : 0);

  useEffect(() => {
    const target = Math.min(100, Math.max(0, total)) / 100;
    if (reducedMotion) {
      ringProgress.value = target;
    } else {
      ringProgress.value = withTiming(target, {
        duration: 680,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [total, reducedMotion, ringProgress]);

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: SCORE_RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  return (
    <View style={st.container}>
      {hasFullScore ? (
        <>
          {/* Score Header Card */}
          <View style={st.scoreHeader}>
            <View style={st.ringWrap}>
              <Svg width={74} height={74} viewBox="0 0 100 100">
                <Circle cx="50" cy="50" r={38} stroke={Colors.borderHairline} strokeWidth="7" fill="none" />
                <AnimatedCircle
                  cx="50"
                  cy="50"
                  r={38}
                  stroke={ringStroke}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={SCORE_RING_CIRCUMFERENCE}
                  animatedProps={animatedRingProps}
                  fill="none"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              <View style={st.ringCenter}>
                <Text style={st.ringScore}>{total}</Text>
                <Text style={st.ringMax}>/100</Text>
              </View>
            </View>

            <View style={st.scoreDetails}>
              <Text style={st.sessionCode}>PHIẾU ĐIỂM THẨM MỸ · {sessionId}</Text>
              <View style={[st.tierBadge, { backgroundColor: visual.bg, borderColor: visual.color }]}>
                <Text style={[st.tierText, { color: visual.color }]}>{tierLabel}</Text>
              </View>
              <Text style={st.formulaText}>{formula}</Text>
            </View>
          </View>

          {/* Breakdown Progress Bars */}
          <View style={st.breakdownSection}>
            <BreakdownRow
              label="Tỉ lệ vóc dáng"
              weight="40%"
              value={proportion}
              note={breakdownNotes.proportion}
              delayMs={0}
            />
            <BreakdownRow
              label="Phối màu bánh xe màu"
              weight="40%"
              value={color}
              note={activeColorSwatches.length > 0 ? "" : breakdownNotes.color}
              swatches={activeColorSwatches}
              delayMs={80}
            />
            <BreakdownRow
              label="Cân bằng họa tiết"
              weight="20%"
              value={pattern}
              note={breakdownNotes.pattern}
              delayMs={160}
            />

            <View style={st.penaltyRow}>
              <Text style={st.barLabel}>Điểm trừ phạt</Text>
              <Text style={[st.penaltyScore, penalty > 0 && { color: Colors.statusDanger }]}>
                {penalty > 0 ? `−${penalty} điểm` : "0 điểm"}
              </Text>
            </View>
          </View>

          {/* AI Stylist Quote + Gợi ý bảng màu Swatch */}
          {!!stylistComment && (
            <View style={st.stylistCard}>
              <View style={st.sparkleIconWrap}>
                <Ionicons name="sparkles" size={15} color={Colors.champagneDeep} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={st.stylistQuote}>“{stylistComment}”</Text>
                {recommendedColors.length > 0 && (
                  <View style={st.paletteBlock}>
                    <Text style={st.paletteHeading}>Tông màu gợi ý phối hài hòa</Text>
                    <ColorSwatchRow swatches={recommendedColors} />
                  </View>
                )}
                <Text style={st.stylistAuthor}>
                  {isAiStylist ? "— AI Stylist YoFaSo Atelier" : "— Tư vấn Stylist YoFaSo"}
                </Text>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={st.singlePreviewCard}>
          <Text style={st.sessionCode}>ĐANG THỬ ĐƠN LẺ · {sessionId}</Text>
          <Text style={st.singlePreviewTitle}>Chưa chấm điểm cả set</Text>
          <Text style={st.barNote}>
            Điểm thẩm mỹ 40/40/20 cần đủ cặp Áo + Quần/Chân váy (hoặc Đầm). Chọn một gợi ý phối đồ bên dưới để chấm điểm ngay.
          </Text>
          {singleItemPreview && (
            <View style={st.singleMetaList}>
              {singleColorSwatches.length > 0 ? (
                <View style={st.singleSwatchBlock}>
                  <Text style={st.singleMetaItem}>• Màu món chính:</Text>
                  <ColorSwatchRow swatches={singleColorSwatches} />
                </View>
              ) : (
                !!singleItemPreview.colorNote && (
                  <Text style={st.singleMetaItem}>
                    • Màu món chính: {stripHexAndLegacyPrefix(singleItemPreview.colorNote)}
                  </Text>
                )
              )}
              {singleRecommendedColors.length > 0 && (
                <View style={st.singleSwatchBlock}>
                  <Text style={st.singleMetaItem}>• Gợi ý tông màu phối đẹp:</Text>
                  <ColorSwatchRow swatches={singleRecommendedColors} />
                </View>
              )}
              {!!singleItemPreview.patternNote && (
                <Text style={st.singleMetaItem}>• Họa tiết: {singleItemPreview.patternNote}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Smart Cross-Selling Suggestions */}
      {category !== "dress" && (
        <View style={st.suggestionsSection}>
          <Text style={st.suggestionsTitle}>
            {suggestions.length > 0 ? (
              <>
                Gợi ý phối đồ đối ứng đạt đến{" "}
                <Text style={{ color: Colors.statusSuccess, fontFamily: "Mono" }}>{highestScore} điểm</Text>
              </>
            ) : (
              "Gợi ý phối đồ đối ứng"
            )}
          </Text>

          {savedSuggestions.loading && suggestions.length === 0 ? (
            <State loading={true} error="" retry={savedSuggestions.reload} />
          ) : suggestions.length === 0 ? (
            <Notice>
              Chưa có món đối ứng đạt ngưỡng gợi ý trong kho. Bạn có thể tự tìm trong mục “Tùy chỉnh món phối & sơ vin” bên dưới.
            </Notice>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.suggestionsScroll}>
              {suggestions.map((r) => {
                const rawUrl = r.imageUrl ? String(r.imageUrl) : "";
                const resolvedUri = rawUrl.startsWith("/api/v1/") || rawUrl.startsWith("http")
                  ? publicUrl(rawUrl)
                  : "";
                return (
                  <View key={String(r.recommendationId || r.variantId)} style={st.suggestionCard}>
                    <View style={st.cardImageWrap}>
                      <SmartImage
                        source={resolvedUri || null}
                        style={st.cardImage}
                        contentFit="cover"
                        borderRadius={Radii.md}
                        iconSize={26}
                      />
                      <View style={st.projectedBadge}>
                        <Text style={st.projectedBadgeText}>{String(r.projectedScore)}đ</Text>
                      </View>
                    </View>

                    <Text style={st.cardName} numberOfLines={1}>{String(r.name || r.variantId)}</Text>
                    {!!r.colorName && (
                      <View style={st.cardSwatchRow}>
                        {!!r.colorHex && /^#[0-9A-Fa-f]{6}$/.test(String(r.colorHex).split(",")[0].trim()) && (
                          <View
                            style={[
                              st.swatchDotSm,
                              { backgroundColor: String(r.colorHex).split(",")[0].trim() },
                              isLightHex(String(r.colorHex).split(",")[0].trim()) && st.swatchDotBorder,
                            ]}
                          />
                        )}
                        <Text style={st.cardColorText} numberOfLines={1}>{String(r.colorName)}</Text>
                      </View>
                    )}
                    <Text style={st.cardPrice}>{formatVND(r.price as number | string)}</Text>

                    <ScalePressable
                      style={st.trySetBtn}
                      activeScale={0.95}
                      onPress={() => handleTrySuggestion(r)}
                    >
                      <Text style={st.trySetBtnText}>Ướm thử set</Text>
                      <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                    </ScalePressable>

                    <View style={st.quickActionsRow}>
                      <Pressable
                        style={st.quickLinkBtn}
                        disabled={busy}
                        onPress={() => void evaluatePairing(String(r.variantId))}
                      >
                        <Text style={st.quickLinkText}>Chấm điểm</Text>
                      </Pressable>
                      <View style={st.quickDivider} />
                      <Pressable
                        style={st.quickLinkBtn}
                        disabled={busy}
                        onPress={() =>
                          void task(async () => {
                            await api("/cart/items", "PUT", {
                              variantId: r.variantId,
                              quantity: 1,
                            });
                            if (r.recommendationId) {
                              await api(`/scoring/recommendations/${r.recommendationId}/interaction`, "PATCH", {
                                status: "DA_THEM_GIO_HANG",
                              });
                            }
                            Alert.alert("Đã thêm", `${r.name} đã vào túi đồ của bạn.`);
                          })
                        }
                      >
                        <Text style={st.quickLinkText}>+ Túi đồ</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Dual CTA Buttons */}
      <View style={st.dualCtaRow}>
        <ScalePressable style={st.singleBtn} onPress={onSingleBuy}>
          <Text style={st.singleBtnTitle}>Mua riêng món này</Text>
        </ScalePressable>

        <ScalePressable style={st.comboBtn} onPress={() => onComboBuy?.(comboTargetVariantId)}>
          <Text style={st.comboBtnTitle}>Mua combo (-5%)</Text>
          <Text style={st.comboBtnSub}>Ưu đãi trọn bộ</Text>
        </ScalePressable>
      </View>

      {/* Trust Badges */}
      <View style={st.trustRow}>
        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.statusSuccess} />
        <Text style={st.trustText}>Đổi trả 14 ngày</Text>
        <Text style={st.trustDot}>·</Text>
        <Ionicons name="storefront-outline" size={14} color={Colors.champagneDeep} />
        <Text style={st.trustText}>Giữ tại shop 48h</Text>
      </View>

      {/* Manual Selection Accordion */}
      <Pressable
        style={st.accordionHeader}
        onPress={() => setShowManualPicker(!showManualPicker)}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={st.accordionTitle}>Tùy chỉnh món phối & sơ vin</Text>
          <Text style={st.accordionSub}>
            Tự chọn món phối trong catalog hoặc bật sơ vin để tính lại điểm & tìm gợi ý mới
          </Text>
        </View>
        <Ionicons name={showManualPicker ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
      </Pressable>

      {showManualPicker && (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(180)}
          style={st.manualSection}
        >
          <Notice>
            Chọn thêm quần/chân váy nếu món chính là áo, hoặc chọn áo nếu món chính là quần.
          </Notice>
          <Field
            label="Tìm món phối kèm"
            value={query}
            onChangeText={setQuery}
            maxLength={100}
          />
          <Button title="Tìm trong catalog" secondary onPress={() => setSearch(query)} />
          <State loading={products.loading} error={products.error} retry={products.reload} />
          <SelectField
            label="Trang phục phối kèm"
            value={productId}
            options={[
              { value: "", label: "Không chọn (mặc riêng)" },
              ...(products.data?.items || []).map((p) => ({
                value: p.productId,
                label: p.name,
              })),
            ]}
            onChange={(value) => {
              setProduct(value);
              setSecond("");
            }}
          />
          {productId ? (
            <>
              <State {...detail} retry={detail.reload} />
              <SelectField
                label="Màu và kích cỡ"
                value={second}
                options={(detail.data?.variants || [])
                  .filter(
                    (v) =>
                      v.stock > 0 &&
                      v.status === "DANG_BAN" &&
                      v.variantId !== variantId
                  )
                  .map((v) => ({
                    value: v.variantId,
                    label: `${v.colorName} / ${v.size}`,
                  }))}
                onChange={setSecond}
              />
            </>
          ) : null}

          <View style={st.switchRow}>
            <Switch
              accessibilityLabel="Sơ vin"
              value={tucked}
              onValueChange={setTucked}
              trackColor={{ false: Colors.borderHairline, true: Colors.champagne }}
            />
            <Text style={st.switchLabel}>Tôi mặc sơ vin</Text>
          </View>

          {error ? <Notice error>{error}</Notice> : null}

          <Button
            title="Đánh giá lại bản phối này"
            disabled={busy || (!second && category !== "dress")}
            onPress={() =>
              void task(async () => {
                const res = await api<Row>(`/scoring/sessions/${sessionId}`, "POST", {
                  firstVariantId: variantId,
                  ...(second ? { secondVariantId: second } : {}),
                  tucked,
                });
                setScore(res);
                onScoreUpdated?.({
                  total: Number(res.total ?? 0),
                  tier: res.tier ? String(res.tier) : undefined,
                  tierLabel: res.tierLabel ? String(res.tierLabel) : undefined,
                });
              })
            }
          />

          {category !== "dress" && (
            <Button
              title="Tìm thêm gợi ý phối mới"
              secondary
              loading={busy}
              onPress={() =>
                void task(async () =>
                  setSuggestions(
                    await api<Row[]>(
                      `/scoring/sessions/${sessionId}/recommendations?tucked=${tucked}`,
                      "POST"
                    )
                  )
                )
              }
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

function ColorSwatchRow({ swatches }: { swatches: ColorSwatch[] }) {
  if (!swatches.length) return null;
  return (
    <View style={st.swatchList}>
      {swatches.map((sw, idx) => (
        <View key={`${sw.hex}-${idx}`} style={st.swatchPill}>
          <View
            style={[
              st.swatchDot,
              { backgroundColor: sw.hex },
              isLightHex(sw.hex) && st.swatchDotBorder,
            ]}
          />
          <Text style={st.swatchLabel}>{sw.name}</Text>
        </View>
      ))}
    </View>
  );
}

function BreakdownRow({
  label,
  weight,
  value,
  note,
  swatches,
  delayMs = 0,
}: {
  label: string;
  weight: string;
  value: number;
  note: string;
  swatches?: ColorSwatch[];
  delayMs?: number;
}) {
  const barColor =
    value >= 85 ? Colors.statusSuccess : value >= 70 ? Colors.champagneDeep : Colors.statusWarning;
  return (
    <View style={st.barRow}>
      <View style={st.barHeader}>
        <Text style={st.barLabel}>
          {label} <Text style={st.barWeight}>({weight})</Text>
        </Text>
        <Text style={st.barScore}>{value}/100</Text>
      </View>
      <AnimatedProgressBar
        percent={value}
        fillColor={barColor}
        trackColor={Colors.surfaceMuted}
        height={6}
        borderRadius={3}
        delayMs={delayMs}
      />
      {swatches && swatches.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <ColorSwatchRow swatches={swatches} />
        </View>
      ) : (
        !!note && <Text style={st.barNote}>{note}</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    ...Shadows.sm,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderHairline,
  },
  ringWrap: {
    width: 74,
    height: 74,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringScore: {
    fontSize: 20,
    fontFamily: "Mono",
    color: Colors.primary,
  },
  ringMax: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: "Mono",
  },
  scoreDetails: {
    flex: 1,
    gap: 4,
  },
  sessionCode: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  tierBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 10,
    fontFamily: "Mono",
  },
  formulaText: {
    fontSize: 11,
    fontFamily: "Mono",
    color: Colors.textMuted,
    marginTop: 2,
  },
  breakdownSection: {
    marginTop: 16,
    gap: 12,
  },
  barRow: {
    gap: 4,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barLabel: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  barWeight: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  barScore: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.primary,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceMuted,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  barNote: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  penaltyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  penaltyScore: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.textSecondary,
  },
  stylistCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.champagneSubtle,
    borderRadius: Radii.lg,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
    gap: 10,
  },
  sparkleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3EAE0",
    alignItems: "center",
    justifyContent: "center",
  },
  stylistQuote: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.primary,
    lineHeight: 19,
  },
  stylistAuthor: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.champagneDeep,
  },
  paletteBlock: {
    gap: 5,
    paddingTop: 2,
  },
  paletteHeading: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
  },
  swatchList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  swatchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  swatchDotSm: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  swatchDotBorder: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  swatchLabel: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  cardSwatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardColorText: {
    fontSize: 10.5,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    flex: 1,
  },
  singleSwatchBlock: {
    gap: 4,
    marginTop: 2,
  },
  suggestionsSection: {
    marginTop: 20,
    gap: 12,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  suggestionsScroll: {
    gap: 12,
    paddingRight: 4,
  },
  suggestionCard: {
    width: 158,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    padding: 8,
    gap: 6,
  },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: Radii.md,
    overflow: "hidden",
    position: "relative",
    backgroundColor: Colors.surfaceMuted,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  projectedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: Colors.statusSuccess,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  projectedBadgeText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: "#FFFFFF",
  },
  cardName: {
    fontSize: 12,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  cardPrice: {
    fontSize: 12,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
  },
  trySetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: 8,
    marginTop: 2,
  },
  trySetBtnText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
  },
  quickLinkBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  quickLinkText: {
    fontSize: 11,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
  },
  quickDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.borderHairline,
  },
  dualCtaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  singleBtn: {
    flex: 2,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  singleBtnTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
  },
  comboBtn: {
    flex: 3,
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 12,
  },
  comboBtnTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
  },
  comboBtnSub: {
    fontSize: 10,
    fontFamily: "Jakarta",
    color: Colors.champagne,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  trustText: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  trustDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    paddingBottom: 4,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderHairline,
  },
  accordionTitle: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
  },
  accordionSub: {
    fontSize: 11,
    fontFamily: "Jakarta",
    color: Colors.textMuted,
    marginTop: 2,
  },
  singlePreviewCard: {
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderHairline,
    gap: 6,
  },
  singlePreviewTitle: {
    fontSize: 16,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  singleMetaList: {
    marginTop: 4,
    gap: 3,
  },
  singleMetaItem: {
    fontSize: 12,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
  },
  manualSection: {
    marginTop: 12,
    gap: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: "Jakarta",
    color: Colors.primary,
  },
});
