import QRCode from "react-native-qrcode-svg";
import { ResultActions } from "@/components/shop/ResultActions";
import { OutfitScoring } from "@/components/shop/OutfitScoring";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api, imageSource } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { PrivateImage } from "@/components/shop/PrivateImage";
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
export default function Session() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}
function Content() {
  const { id, variantId, before } = useLocalSearchParams<{
    id: string;
    variantId?: string;
    before?: string;
  }>();
  const state = useResource<Row>(`/try-on/sessions/${encodeURIComponent(id)}`),
    [error, setError] = useState(""),
    [showBefore, setShowBefore] = useState(false),
    [busy, setBusy] = useState(false);
  const o = state.data,
    result = o?.result as Row | undefined,
    asset = result?.resultAssetId as string | undefined;
  const running =
    o && !["COMPLETED", "FAILED", "CANCELLED"].includes(String(o.status));
  useEffect(() => {
    if (!running || state.error) return;
    const timer = setTimeout(state.reload, 4000);
    return () => clearTimeout(timer);
  }, [o, running, state.error, state.reload]);
  async function control(action: string) {
    setBusy(true);
    try {
      await api(`/try-on/sessions/${id}/${action}`, "POST");
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Kết quả thử đồ" }} />
      <Heading>Phòng thử của bạn</Heading>
      <State
        loading={state.loading && !o}
        error={state.error}
        retry={state.reload}
      />
      {o && (
        <>
          <Notice>Trạng thái: {String(o.status)}</Notice>
          {Boolean(o.simulated) && (
            <Notice>
              Ảnh mô phỏng để kiểm tra luồng, không phải kết quả GPU thật.
            </Notice>
          )}
          {running && (
            <Panel>
              <Heading small>Đang chuẩn bị trang phục</Heading>
              <Notice>
                Bạn có thể rời màn hình và xem lại trong Tủ đồ. Phiên vẫn tiếp
                tục trên máy chủ.
              </Notice>
              <View
                style={{
                  height: 5,
                  backgroundColor: "#C5A880",
                  borderRadius: 8,
                }}
              />
              <Button
                title="Hủy phiên đang chờ"
                secondary
                disabled={busy}
                onPress={() => void control("cancel")}
              />
            </Panel>
          )}
          {!!o.error && <Notice error>{String(o.error)}</Notice>}
          {asset && (
            <>
              <PrivateImage
                key={showBefore && before ? before : asset}
                assetId={showBefore && before ? before : asset}
                style={{ width: "100%", aspectRatio: 0.7, borderRadius: 16 }}
              />
              <ResultActions assetId={asset} />
              {before && (
                <Button
                  title={showBefore ? "Xem sau khi thử" : "Xem ảnh ban đầu"}
                  secondary
                  onPress={() => setShowBefore(!showBefore)}
                />
              )}
            </>
          )}
          {o.status === "FAILED" && (
            <Button
              title="Thử lại phiên"
              disabled={busy}
              onPress={() => void control("retry")}
            />
          )}
          {o.status === "COMPLETED" && !o.simulated && variantId && (
            <OutfitScoring sessionId={id} variantId={variantId} />
          )}
          <Panel>
            <Heading small>Vé thử đồ tại quầy</Heading>
            <View style={{ alignItems: "center", padding: 16 }}>
              <QRCode
                value={id}
                size={180}
                color="#0F172A"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text selectable style={s.money}>
              {id}
            </Text>
            <Notice>
              Đưa mã phiên cùng số điện thoại của bạn cho thu ngân để tra cứu.
            </Notice>
          </Panel>
        </>
      )}
      {!!error && <Notice error>{error}</Notice>}
    </Screen>
  );
}
