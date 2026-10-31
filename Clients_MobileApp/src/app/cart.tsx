import { useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import { money, type Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import {
  Button,
  Heading,
  Notice,
  Panel,
  Screen,
  State,
  s,
} from "@/components/shop/ui";
export default function Cart() {
  return (
    <RequireAccount>
      <CartContent />
    </RequireAccount>
  );
}
function CartContent() {
  const { user } = useSession(),
    state = useResource<Row[]>(user ? "/cart" : null);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      state.reload();
    }, [state.reload]),
  );
  async function update(row: Row, quantity: number) {
    setBusy(true);
    try {
      if (quantity < 1) await api(`/cart/items/${row.variantId}`, "DELETE");
      else
        await api("/cart/items", "PUT", { variantId: row.variantId, quantity });
      state.reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Túi đồ" }} />
      <Heading>Túi đồ của bạn</Heading>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data?.map((row) => (
        <Panel key={String(row.variantId)}>
          <Heading small>{String(row.productId)}</Heading>
          <Notice>
            {String(row.colorName)} / {String(row.size)}
          </Notice>
          <Text style={s.money}>
            {money(Number(row.unitPrice) * Number(row.quantity))}
          </Text>
          <View style={s.row}>
            <Button
              title="Bớt một"
              secondary
              disabled={busy}
              onPress={() => void update(row, Number(row.quantity) - 1)}
            />
            <Text>{String(row.quantity)}</Text>
            <Button
              title="Thêm một"
              secondary
              disabled={
                busy || Number(row.quantity) >= Math.min(99, Number(row.stock))
              }
              onPress={() => void update(row, Number(row.quantity) + 1)}
            />
            <Button
              title="Xóa"
              secondary
              disabled={busy}
              onPress={() => void update(row, 0)}
            />
          </View>
        </Panel>
      ))}
      {!!message && <Notice error>{message}</Notice>}
      <Notice>Giá và tồn kho sẽ được xác nhận lại khi đặt hàng.</Notice>
      <Button
        title="Tiếp tục đặt hàng"
        disabled={!state.data?.length || busy}
        onPress={() => router.push("/checkout")}
      />
    </Screen>
  );
}
