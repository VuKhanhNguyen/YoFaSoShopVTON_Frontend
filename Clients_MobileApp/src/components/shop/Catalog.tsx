import { memo, useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useResource } from "@/hooks/use-resource";
import { api, publicUrl } from "@/lib/api";
import { money, type Page, type Product, type Row } from "@/lib/models";
import { SelectField } from "./SelectField";
import {
  Button,
  Field,
  Heading,
  Logo,
  Notice,
  Screen,
  State,
  colors,
  s,
} from "./ui";
const ProductTile = memo(function ProductTile({
  item,
  index,
}: {
  item: Product;
  index: number;
}) {
  const image = item.coverUrl,
    min = item.minPrice;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem ${item.name}`}
      onPress={() =>
        router.push({
          pathname: "/product/[id]",
          params: { id: item.productId },
        })
      }
      style={{
        flex: 1,
        margin: 8,
        marginTop: index % 2 ? 32 : 8,
        maxWidth: "48%",
      }}
    >
      {image ? (
        <Image
          source={{ uri: publicUrl(image) }}
          style={{ width: "100%", aspectRatio: 0.8, borderRadius: 16 }}
        />
      ) : (
        <View
          style={{
            width: "100%",
            aspectRatio: 0.8,
            backgroundColor: "#F4F4F5",
            borderRadius: 16,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Text style={{ color: colors.muted }}>YoFaSo</Text>
        </View>
      )}
      <Text
        style={{
          color: colors.primary,
          fontWeight: "600",
          fontSize: 16,
          marginTop: 12,
        }}
      >
        {item.name}
      </Text>
      <Text style={{ color: colors.muted, marginTop: 4 }}>
        {item.material || "Thiết kế YoFaSo"}
      </Text>
      {min !== undefined && (
        <Text style={[s.money, { marginTop: 8 }]}>{money(min)}</Text>
      )}
    </Pressable>
  );
});
export function Catalog({ discover = false }: { discover?: boolean }) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [size, setSize] = useState(""),
    [page, setPage] = useState(0),
    [items, setItems] = useState<Product[]>([]),
    [filtersOpen, setFiltersOpen] = useState(false),
    [extra, setExtra] = useState({
      material: "",
      color: "",
      fit: "",
      pattern: "",
      minPrice: "",
      maxPrice: "",
    }),
    [applied, setApplied] = useState(""),
    [filterError, setFilterError] = useState("");
  const categories = useResource<Row[]>("/catalog/categories");
  const filters =
    useResource<Record<string, { value: string; label: string }[]>>(
      "/catalog/filters",
    );
  const query = `/catalog/products?q=${encodeURIComponent(search)}&categoryId=${encodeURIComponent(category)}&size=${size}&page=${page}&limit=20${applied}`;
  const state = useResource<Page<Product>>(query);
  useEffect(() => {
    const next = state.data;
    if (next)
      setItems((previous) =>
        page
          ? [
              ...previous.filter(
                (p) => !next.items.some((i) => i.productId === p.productId),
              ),
              ...next.items,
            ]
          : next.items,
      );
  }, [state.data, page]);
  const render = useCallback(
    ({ item, index }: { item: Product; index: number }) => (
      <ProductTile item={item} index={index} />
    ),
    [],
  );
  function filter(cat: string) {
    setItems([]);
    setPage(0);
    setCategory(cat);
  }
  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        numColumns={2}
        renderItem={render}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 40,
          paddingBottom: 32,
        }}
        refreshing={state.loading && page === 0}
        onRefresh={() => {
          setPage(0);
          state.reload();
        }}
        windowSize={5}
        maxToRenderPerBatch={8}
        ListHeaderComponent={
          <View>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Logo />
              <Button
                secondary
                title="Túi đồ"
                onPress={() => router.push("/cart")}
              />
              <Button
                secondary
                title="Thông báo"
                onPress={() => router.push("/inbox")}
              />
            </View>
            {discover && (
              <ImageBackground
                source={require("../../../assets/editorial/home-hero.jpg")}
                style={{
                  height: 300,
                  justifyContent: "flex-end",
                  marginVertical: 16,
                  borderRadius: 24,
                  overflow: "hidden",
                }}
              >
                <View style={{ backgroundColor: "#0F172ABF", padding: 24 }}>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 30,
                      fontWeight: "600",
                    }}
                  >
                    Một ngày, một phong cách
                  </Text>
                  <Text style={{ color: "#FFFFFF", marginTop: 8 }}>
                    Chọn trang phục. Thử trên ảnh của bạn.
                  </Text>
                </View>
              </ImageBackground>
            )}
            <Heading>{discover ? "Dành cho bạn" : "Khám phá danh mục"}</Heading>
            <Field
              label="Tìm sản phẩm"
              value={q}
              maxLength={100}
              onChangeText={setQ}
              onSubmitEditing={() => {
                setPage(0);
                setSearch(q);
              }}
            />
            <Button
              title="Tìm kiếm"
              secondary
              onPress={() => {
                setPage(0);
                setSearch(q);
              }}
            />
            <View style={s.row}>
              <Button
                title="Tất cả"
                secondary={!!category}
                onPress={() => filter("")}
              />
              {categories.data?.map((c) => (
                <Button
                  key={String(c.categoryId)}
                  title={String(c.name)}
                  secondary={category !== c.categoryId}
                  onPress={() => filter(String(c.categoryId))}
                />
              ))}
            </View>
            <View style={s.row}>
              {["", "S", "M", "L", "XL"].map((v) => (
                <Button
                  key={v}
                  title={v || "Mọi size"}
                  secondary={size !== v}
                  onPress={() => {
                    setPage(0);
                    setSize(v);
                  }}
                />
              ))}
            </View>
            <Button
              title="Bộ lọc nâng cao"
              secondary
              onPress={() => setFiltersOpen(!filtersOpen)}
            />
            {filtersOpen && (
              <View>
                <State
                  loading={filters.loading}
                  error={filters.error}
                  retry={filters.reload}
                />
                {(["material", "color", "fit", "pattern"] as const).map(
                  (key) => (
                    <SelectField
                      key={key}
                      label={
                        {
                          material: "Chất liệu",
                          color: "Màu sắc",
                          fit: "Phom dáng",
                          pattern: "Họa tiết",
                        }[key]
                      }
                      value={extra[key]}
                      options={[
                        { value: "", label: "Tất cả" },
                        ...(filters.data?.[
                          {
                            material: "materials",
                            color: "colors",
                            fit: "fit",
                            pattern: "pattern",
                          }[key]
                        ] || []),
                      ]}
                      onChange={(v) => setExtra({ ...extra, [key]: v })}
                    />
                  ),
                )}
                <Field
                  label="Giá từ (đ)"
                  keyboardType="numeric"
                  value={extra.minPrice}
                  maxLength={10}
                  onChangeText={(v) => setExtra({ ...extra, minPrice: v })}
                />
                <Field
                  label="Giá đến (đ)"
                  keyboardType="numeric"
                  value={extra.maxPrice}
                  maxLength={10}
                  onChangeText={(v) => setExtra({ ...extra, maxPrice: v })}
                  error={filterError}
                />
                <Button
                  title="Áp dụng bộ lọc"
                  onPress={() => {
                    if (
                      [extra.minPrice, extra.maxPrice].some(
                        (v) => v !== "" && (!/^\d+$/.test(v) || Number(v) < 0),
                      ) ||
                      (extra.maxPrice &&
                        Number(extra.maxPrice) < Number(extra.minPrice || 0))
                    ) {
                      setFilterError("Khoảng giá không hợp lệ.");
                      return;
                    }
                    setFilterError("");
                    setPage(0);
                    setItems([]);
                    setApplied(
                      Object.entries(extra)
                        .filter(([, v]) => v !== "")
                        .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
                        .join(""),
                    );
                    setFiltersOpen(false);
                  }}
                />
                <Button
                  title="Xóa bộ lọc"
                  secondary
                  onPress={() => {
                    setExtra({
                      material: "",
                      color: "",
                      fit: "",
                      pattern: "",
                      minPrice: "",
                      maxPrice: "",
                    });
                    setApplied("");
                    setPage(0);
                  }}
                />
              </View>
            )}
            <State
              loading={state.loading && !items.length}
              error={state.error}
              retry={state.reload}
              empty={!state.loading && !state.error && !items.length}
            />
          </View>
        }
        ListFooterComponent={
          state.data && items.length < state.data.total ? (
            <Button
              title="Xem thêm"
              disabled={state.loading}
              onPress={() => setPage((p) => p + 1)}
            />
          ) : (
            <Notice>Khám phá những lựa chọn mới từ YoFaSo.</Notice>
          )
        }
      />
    </Screen>
  );
}
