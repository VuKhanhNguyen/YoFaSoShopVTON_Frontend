import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Stack } from "expo-router";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { SelectField } from "@/components/shop/SelectField";
import { ContractForm } from "@/components/shop/ContractForm";
import {
  Button,
  Field,
  Heading,
  Notice,
  Panel,
  Screen,
  State,
  s,
} from "@/components/shop/ui";
export default function Addresses() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}
function Content() {
  const state = useResource<Row[]>("/me/addresses"),
    provinces = useResource<Row[]>("/new-provinces");
  const [province, setProvince] = useState<Row>(),
    [ward, setWard] = useState<Row>(),
    [editing, setEditing] = useState<Row>(),
    [form, setForm] = useState(false),
    [error, setError] = useState("");
  const wards = useResource<Row[]>(
    province ? `/new-provinces/${province.code}/wards` : null,
  );
  async function remove(a: Row) {
    try {
      await api(`/me/addresses/${a.addressId}`, "DELETE");
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Sổ địa chỉ" }} />
      <Heading>Địa chỉ của tôi</Heading>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data?.map((a) => (
        <Panel key={String(a.addressId)}>
          <Heading small>{String(a.recipientName)}</Heading>
          <Notice>
            {String(a.street)}, {String(a.ward)}, {String(a.city)}
            {"\n"}
            {String(a.phone)}
          </Notice>
          <Button
            title="Chỉnh sửa"
            secondary
            onPress={() => {
              setEditing(a);
              setProvince(undefined);
              setWard(undefined);
              setForm(true);
            }}
          />
          <Button
            title="Xóa địa chỉ"
            secondary
            onPress={() =>
              Alert.alert(
                "Xóa địa chỉ?",
                "Địa chỉ đã dùng trong đơn hàng có thể không xóa được.",
                [
                  { text: "Giữ lại", style: "cancel" },
                  {
                    text: "Xóa",
                    style: "destructive",
                    onPress: () => void remove(a),
                  },
                ],
              )
            }
          />
        </Panel>
      ))}
      <Button
        title="Thêm địa chỉ"
        onPress={() => {
          setEditing(undefined);
          setProvince(undefined);
          setWard(undefined);
          setForm(true);
        }}
      />
      {!!error && <Notice error>{error}</Notice>}
      {form && (
        <Panel>
          <Heading small>{editing ? "Sửa địa chỉ" : "Địa chỉ mới"}</Heading>
          <State
            loading={provinces.loading}
            error={provinces.error}
            retry={provinces.reload}
          />
          <SelectField
            label="Tỉnh / thành phố"
            value={String(province?.code || "")}
            options={(provinces.data || []).map((p) => ({
              value: String(p.code),
              label: String(p.name),
            }))}
            onChange={(code) => {
              setProvince(provinces.data?.find((p) => p.code === code));
              setWard(undefined);
            }}
          />
          {province && (
            <>
              <State {...wards} retry={wards.reload} />
              <SelectField
                label="Phường / xã"
                value={String(ward?.code || "")}
                options={(wards.data || []).map((w) => ({
                  value: String(w.code),
                  label: String(w.name),
                }))}
                onChange={(code) =>
                  setWard(wards.data?.find((w) => w.code === code))
                }
              />
            </>
          )}
          <ContractForm
            key={String(editing?.addressId || "new")}
            schemaName="Address"
            initial={
              editing
                ? {
                    recipientName: editing.recipientName,
                    phone: editing.phone,
                    street: editing.street,
                    defaultAddress: Boolean(editing.defaultAddress),
                  }
                : { defaultAddress: false }
            }
            exclude={["city", "ward", "provinceCode", "wardCode"]}
            onSubmit={async (value) => {
              if (!province || !ward)
                throw new Error("Vui lòng chọn tỉnh và phường / xã.");
              await api(
                editing
                  ? `/me/addresses/${editing.addressId}`
                  : "/me/addresses",
                editing ? "PUT" : "POST",
                {
                  ...value,
                  city: province.name,
                  ward: ward.name,
                  provinceCode: province.code,
                  wardCode: ward.code,
                },
              );
              setForm(false);
              state.reload();
            }}
          />
          <Button title="Đóng" secondary onPress={() => setForm(false)} />
        </Panel>
      )}
    </Screen>
  );
}
