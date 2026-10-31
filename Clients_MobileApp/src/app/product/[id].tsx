import { useState } from "react";
import { Image, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { api, publicUrl } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import { money, type Product, type Row } from "@/lib/models";
import {
  Button,
  Heading,
  Notice,
  Panel,
  Screen,
  State,
  s,
} from "@/components/shop/ui";
export default function ProductPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useResource<Product>(
    `/catalog/products/${encodeURIComponent(id)}`,
  );
  const reviews = useResource<Row[]>(
    `/catalog/products/${encodeURIComponent(id)}/reviews`,
  );
  const [variantId, setVariantId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { user } = useSession();
  const p = state.data,
    v = p?.variants?.find((v) => v.variantId === variantId);
  async function add() {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!v) return;
    setBusy(true);
    try {
      await api("/cart/items", "PUT", { variantId: v.variantId, quantity: 1 });
      setMessage("Đã thêm vào túi đồ.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: p?.name || "Sản phẩm" }} />
      <State {...state} retry={state.reload} />
      {p && (
        <>
          {p.images?.map((image) => (
            <Image
              key={image.imageId}
              source={{ uri: publicUrl(image.originalUrl) }}
              style={{ width: "100%", aspectRatio: 0.8, borderRadius: 16 }}
            />
          ))}
          <Heading>{p.name}</Heading>
          <Notice>{p.description}</Notice>
          <Notice>
            {p.material} / {p.fit}
          </Notice>
          <Heading small>Chọn màu và kích cỡ</Heading>
          <View style={s.row}>
            {p.variants?.map((variant) => (
              <Button
                key={variant.variantId}
                title={`${variant.colorName} / ${variant.size}`}
                secondary={variantId !== variant.variantId}
                disabled={variant.stock < 1 || variant.status !== "DANG_BAN"}
                onPress={() => setVariantId(variant.variantId)}
              />
            ))}
          </View>
          {v && (
            <>
              <Text style={s.money}>{money(v.salePrice ?? v.price)}</Text>
              <Notice>Còn {v.stock} sản phẩm</Notice>
            </>
          )}
          <Panel>
            <Heading small>Phòng thử đồ ảo</Heading>
            <Notice>
              {p.vtonCategory === "upper_body"
                ? "Ảnh nửa người hoặc toàn thân, nhìn rõ vai và hông."
                : "Ảnh toàn thân, thấy rõ đầu gối và mắt cá chân."}{" "}
              Kết quả AI dùng để tham khảo hình ảnh, không đo kích cỡ thật.
            </Notice>
            <Button
              title="Thử trên ảnh của tôi"
              secondary
              disabled={!v}
              onPress={() =>
                router.push({
                  pathname: "/try-on",
                  params: { variantId, category: p.vtonCategory },
                })
              }
            />
          </Panel>
          {!!message && <Notice>{message}</Notice>}
          <Button
            title={busy ? "Đang thêm..." : "Thêm vào túi đồ"}
            disabled={!v || busy}
            onPress={() => void add()}
          />
          <Button
            title="Xem túi đồ"
            secondary
            onPress={() => router.push("/cart")}
          />
          <Heading small>Đánh giá từ người mua</Heading>
          <State
            loading={reviews.loading}
            error={reviews.error}
            empty={reviews.data?.length === 0}
            retry={reviews.reload}
          />
          {reviews.data?.map((r) => (
            <Panel key={String(r.reviewId)}>
              <Text>{String(r.stars)} / 5</Text>
              <Notice>{String(r.comment)}</Notice>
              {!!r.shopReply && <Notice>YoFaSo: {String(r.shopReply)}</Notice>}
            </Panel>
          ))}
        </>
      )}
    </Screen>
  );
}
