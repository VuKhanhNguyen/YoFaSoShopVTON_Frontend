import { useEffect, useRef, useState } from "react";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api, requestKey } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { money, type Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import {
  Button,
  Field,
  Heading,
  Notice,
  Panel,
  Screen,
  State,
} from "@/components/shop/ui";
export default function Checkout() {
  return (
    <RequireAccount>
      <CheckoutContent />
    </RequireAccount>
  );
}
function CheckoutContent() {
  const cart = useResource<Row[]>("/cart"),
    addresses = useResource<Row[]>("/me/addresses");
  const [addressId, setAddress] = useState(""),
    [voucher, setVoucher] = useState(""),
    [quote, setQuote] = useState<Row>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  useFocusEffect(
    useCallback(() => {
      addresses.reload();
    }, [addresses.reload]),
  );
  const items =
    cart.data?.map((r) => ({ variantId: r.variantId, quantity: r.quantity })) ||
    [];
  const subtotal =
    cart.data?.reduce(
      (sum, r) => sum + Number(r.unitPrice) * Number(r.quantity),
      0,
    ) || 0;
  useEffect(() => {
    setQuote(undefined);
  }, [voucher, cart.data]);
  async function submit() {
    if (!addressId) {
      setError("Vui lòng chọn địa chỉ giao hàng.");
      return;
    }
    const body = { items, addressId, ...(voucher ? { voucher } : {}) },
      payload = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { payload, key: requestKey() };
    setBusy(true);
    setError("");
    try {
      const order = await api<Row>(
        "/orders",
        "POST",
        body,
        attempt.current.key,
      );
      router.replace({
        pathname: "/order/[id]",
        params: { id: String(order.orderId) },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Đặt hàng" }} />
      <Heading>Gửi đến bạn</Heading>
      <State
        {...addresses}
        empty={addresses.data?.length === 0}
        retry={addresses.reload}
      />
      {addresses.data?.map((a) => (
        <Panel key={String(a.addressId)}>
          <Heading small>{String(a.recipientName)}</Heading>
          <Notice>
            {String(a.phone)}
            {"\n"}
            {String(a.street)}, {String(a.ward)}, {String(a.city)}
          </Notice>
          <Button
            title={
              addressId === a.addressId ? "Đã chọn địa chỉ này" : "Giao đến đây"
            }
            secondary={addressId !== a.addressId}
            onPress={() => setAddress(String(a.addressId))}
          />
        </Panel>
      ))}
      <Button
        title="Quản lý địa chỉ"
        secondary
        onPress={() => router.push("/addresses")}
      />
      <Field
        label="Mã ưu đãi"
        maxLength={50}
        value={voucher}
        onChangeText={setVoucher}
        autoCapitalize="characters"
      />
      <Button
        title="Kiểm tra ưu đãi"
        secondary
        disabled={!items.length || busy}
        onPress={() => {
          setBusy(true);
          void api<Row>("/promotions/quote", "POST", {
            items,
            ...(voucher ? { voucher } : {}),
          })
            .then(setQuote)
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
      <Panel>
        <Notice>Tiền hàng: {money(subtotal)}</Notice>
        <Notice>Giảm giá: {money(quote?.discount || 0)}</Notice>
        <Heading small>
          Tạm tính: {money(subtotal - Number(quote?.discount || 0))}
        </Heading>
        <Notice>
          Thanh toán COD khi nhận hàng. Phí vận chuyển và tổng cuối cùng được
          backend xác nhận trong đơn hàng.
        </Notice>
      </Panel>
      <State loading={cart.loading} error={cart.error} retry={cart.reload} />
      {!!error && <Notice error>{error}</Notice>}
      <Button
        title={busy ? "Đang xác nhận..." : "Đặt hàng COD"}
        disabled={busy || !items.length || !addressId || !!cart.error}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
