import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Page, Product, Row } from "@/lib/models";
import { SelectField } from "./SelectField";
import { Button, Field, Heading, Notice, Panel, State, s } from "./ui";
export function OutfitScoring({
  sessionId,
  variantId,
}: {
  sessionId: string;
  variantId: string;
}) {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [productId, setProduct] = useState(""),
    [second, setSecond] = useState(""),
    [tucked, setTucked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [score, setScore] = useState<Row>(),
    [suggestions, setSuggestions] = useState<Row[]>([]);
  const products = useResource<Page<Product>>(
      `/catalog/products?q=${encodeURIComponent(search)}&limit=20`,
    ),
    detail = useResource<Product>(
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
  return (
    <Panel>
      <Heading small>Đánh giá bản phối</Heading>
      <Notice>
        Chọn thêm quần/chân váy nếu món chính là áo, hoặc chọn áo nếu món chính
        là quần. Đầm liền không cần món phối kèm.
      </Notice>
      <Field
        label="Tìm món phối kèm"
        value={query}
        onChangeText={setQuery}
        maxLength={100}
      />
      <Button
        title="Tìm trang phục"
        secondary
        onPress={() => setSearch(query)}
      />
      <State
        loading={products.loading}
        error={products.error}
        retry={products.reload}
      />
      <SelectField
        label="Trang phục phối kèm"
        value={productId}
        options={[
          { value: "", label: "Không chọn (đầm liền)" },
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
      {productId && (
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
                  v.variantId !== variantId,
              )
              .map((v) => ({
                value: v.variantId,
                label: `${v.colorName} / ${v.size}`,
              }))}
            onChange={setSecond}
          />
        </>
      )}
      {second && !productId && <Notice>Đã chọn món phối từ gợi ý.</Notice>}
      <View style={s.row}>
        <Switch
          accessibilityLabel="Sơ vin"
          value={tucked}
          onValueChange={setTucked}
        />
        <Text>Tôi mặc sơ vin</Text>
      </View>
      {error && <Notice error>{error}</Notice>}
      <Button
        title="Đánh giá bản phối này"
        disabled={busy || (!!productId && !second)}
        onPress={() =>
          void task(async () =>
            setScore(
              await api<Row>(`/scoring/sessions/${sessionId}`, "POST", {
                firstVariantId: variantId,
                ...(second ? { secondVariantId: second } : {}),
                tucked,
              }),
            ),
          )
        }
      />
      <Button
        title="Gợi ý món phối hài hòa"
        secondary
        disabled={busy}
        onPress={() =>
          void task(async () =>
            setSuggestions(
              await api<Row[]>(
                `/scoring/sessions/${sessionId}/recommendations?tucked=${tucked}`,
                "POST",
              ),
            ),
          )
        }
      />
      {score && (
        <Panel>
          <Heading small>{String(score.total)} / 100</Heading>
          <Notice>
            Tỉ lệ: {String(score.proportion)} / Màu: {String(score.color)} / Họa
            tiết: {String(score.pattern)}
          </Notice>
          <Notice>{String(score.advice)}</Notice>
          <Notice>
            Ước lượng bằng quy tắc catalog. Không đo độ vừa vặn trên cơ thể.
          </Notice>
        </Panel>
      )}
      {suggestions.map((r) => (
        <Panel key={String(r.recommendationId)}>
          <Heading small>Điểm dự kiến: {String(r.projectedScore)}</Heading>
          <Notice>{String(r.reason)}</Notice>
          <Button
            secondary
            title="Dùng món phối này"
            onPress={() => {
              setSecond(String(r.variantId));
              setProduct("");
            }}
          />
          <Button
            title="Thêm vào túi đồ"
            disabled={busy}
            onPress={() =>
              void task(async () => {
                await api("/cart/items", "PUT", {
                  variantId: r.variantId,
                  quantity: 1,
                });
                await api(
                  `/scoring/recommendations/${r.recommendationId}/interaction`,
                  "PATCH",
                  { status: "DA_THEM_GIO_HANG" },
                );
                setError("Đã thêm vào túi đồ.");
              })
            }
          />
        </Panel>
      ))}
    </Panel>
  );
}
