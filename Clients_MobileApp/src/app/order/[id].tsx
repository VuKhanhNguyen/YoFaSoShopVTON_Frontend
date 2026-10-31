import { useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { money, type Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { ContractForm } from "@/components/shop/ContractForm";
import {
  Button,
  Heading,
  Notice,
  Panel,
  Screen,
  State,
  s,
} from "@/components/shop/ui";
export default function Order() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}
function Content() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    state = useResource<Row>(`/orders/${encodeURIComponent(id)}`),
    [error, setError] = useState(""),
    [review, setReview] = useState("");
  const o = state.data;
  async function cancel() {
    try {
      await api(`/orders/${id}/cancel`, "POST");
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Chi tiết đơn hàng" }} />
      <Heading>Đơn hàng {id}</Heading>
      <State {...state} retry={state.reload} />
      {o && (
        <>
          <Panel>
            <Heading small>{String(o.status)}</Heading>
            <Notice>
              {String(o.recipientName)} / {String(o.phone)}
              {"\n"}
              {String(o.address)}
            </Notice>
            <Notice>Thanh toán: {String(o.paymentStatus)}</Notice>
          </Panel>
          {(o.items as Row[])?.map((line) => (
            <Panel key={String(line.orderLineId)}>
              <Heading small>{String(line.productName)}</Heading>
              <Notice>
                {String(line.colorName)} / {String(line.size)} /{" "}
                {String(line.quantity)} sản phẩm
              </Notice>
              <Text style={s.money}>
                {money(Number(line.quantity) * Number(line.unitPrice))}
              </Text>
              {o.status === "HOAN_TAT" && (
                <Button
                  secondary
                  title="Viết đánh giá"
                  onPress={() => setReview(String(line.orderLineId))}
                />
              )}
            </Panel>
          ))}
          <Panel>
            <Notice>
              Giảm: {money(o.discount)} / Phí giao: {money(o.shippingFee)}
            </Notice>
            <Heading small>Tổng: {money(o.total)}</Heading>
          </Panel>
          {["CHO_XAC_NHAN", "DA_THANH_TOAN"].includes(String(o.status)) && (
            <Button
              secondary
              title="Hủy đơn hàng"
              onPress={() =>
                Alert.alert(
                  "Hủy đơn hàng?",
                  "Hàng sẽ được trả về tồn kho khi hủy thành công.",
                  [
                    { text: "Giữ đơn", style: "cancel" },
                    {
                      text: "Hủy đơn",
                      style: "destructive",
                      onPress: () => void cancel(),
                    },
                  ],
                )
              }
            />
          )}
          {!!review && (
            <Panel>
              <ContractForm
                key={review}
                schemaName="Review"
                initial={{ stars: 5 }}
                exclude={["orderLineId"]}
                title="Gửi đánh giá"
                onSubmit={async (v) => {
                  await api("/reviews", "POST", { ...v, orderLineId: review });
                  setReview("");
                }}
              />
            </Panel>
          )}
        </>
      )}
      {!!error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
