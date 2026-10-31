import { useRef, useState } from "react";
import { Image, Platform, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { api, requestKey } from "@/lib/api";
import type { Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import {
  Button,
  Heading,
  Notice,
  Panel,
  Screen,
  s,
} from "@/components/shop/ui";
export default function TryOn() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}
function Content() {
  const { variantId, category } = useLocalSearchParams<{
    variantId: string;
    category: string;
  }>();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>(),
    [consent, setConsent] = useState(false),
    [gate, setGate] = useState<Row>(),
    [assetId, setAssetId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function pick(camera: boolean) {
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      ) {
        setError("Cần quyền máy ảnh. Bạn có thể chọn ảnh từ thư viện.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const p = result.assets[0];
        if (p.fileSize && p.fileSize > 10 * 1024 * 1024)
          throw new Error("Ảnh tối đa 10 MB.");
        if (p.width < 128 || p.height < 128 || p.width * p.height > 20000000)
          throw new Error(
            "Ảnh cần cạnh tối thiểu 128px và tối đa 20 triệu pixel.",
          );
        setPhoto(p);
        setGate(undefined);
        setAssetId("");
        setError("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function validate() {
    if (!photo || !consent) return;
    setBusy(true);
    setError("");
    try {
      let id = assetId;
      if (!id) {
        const form = new FormData();
        form.append("role", "person");
        form.append("consent", "true");
        if (Platform.OS === "web")
          form.append(
            "file",
            await (await fetch(photo.uri)).blob(),
            photo.fileName || "person.jpg",
          );
        else
          form.append("file", {
            uri: photo.uri,
            type: photo.mimeType || "image/jpeg",
            name: photo.fileName || "person.jpg",
          } as unknown as Blob);
        const uploaded = await api<{ assetId: string }>(
          "/assets",
          "POST",
          form,
        );
        id = uploaded.assetId;
        setAssetId(id);
      }
      setGate(
        await api<Row>("/ai/persons/validate", "POST", {
          assetId: id,
          vtonCategory: category,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    const body = {
        variantId,
        personAssetId: assetId,
        seed: 42,
        steps: 20,
        samples: 1,
        consent,
      },
      payload = JSON.stringify(body);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: requestKey() };
    setBusy(true);
    setError("");
    try {
      const op = await api<Row>(
        "/try-on/sessions",
        "POST",
        body,
        attempt.current!.key,
      );
      router.replace({
        pathname: "/session/[id]",
        params: {
          id: String(op.resourceId || op.operationId),
          variantId,
          before: assetId,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Phòng thử đồ" }} />
      <Heading>Thử phong cách mới</Heading>
      <Notice>
        {category === "upper_body"
          ? "Chọn ảnh rõ vai và hông."
          : "Chọn ảnh toàn thân, thấy đủ đầu gối và mắt cá chân."}{" "}
        Đứng thẳng, một người, ánh sáng đều, không che cơ thể.
      </Notice>
      {photo && (
        <Image
          source={{ uri: photo.uri }}
          style={{ width: "100%", aspectRatio: 0.7, borderRadius: 16 }}
        />
      )}
      <View style={s.row}>
        <Button
          title="Chọn ảnh"
          secondary
          disabled={busy}
          onPress={() => void pick(false)}
        />
        <Button
          title="Chụp ảnh"
          secondary
          disabled={busy}
          onPress={() => void pick(true)}
        />
      </View>
      <Panel>
        <View style={s.row}>
          <Switch
            accessibilityLabel="Đồng ý xử lý ảnh để thử đồ"
            value={consent}
            onValueChange={setConsent}
          />
          <Text style={{ flex: 1 }}>
            Tôi đồng ý tải và xử lý ảnh này để thử đồ ảo.
          </Text>
        </View>
        <Notice>
          Ảnh cá nhân được bảo vệ theo tài khoản. Bạn có thể yêu cầu xóa ảnh
          chưa liên kết phiên thử.
        </Notice>
      </Panel>
      {!!error && <Notice error>{error}</Notice>}
      <Button
        title={busy ? "Đang xử lý ảnh..." : "Kiểm tra ảnh"}
        disabled={!photo || !consent || busy || !variantId}
        onPress={() => void validate()}
      />
      {gate && (
        <Panel>
          <Heading small>
            {gate.accepted ? "Ảnh có thể tiếp tục" : "Cần chọn lại ảnh"}
          </Heading>
          <Notice>Khung hình: {String(gate.personFrame)}</Notice>
          {Boolean(gate.simulated) && (
            <Notice>
              Đang dùng kiểm định mô phỏng. Chưa xác nhận tư thế bằng mô hình
              thật.
            </Notice>
          )}
          {Array.isArray(gate.warnings) &&
            gate.warnings.map((w, i) => <Notice key={i}>{String(w)}</Notice>)}
          {!!gate.route && (
            <Notice>
              {String(
                (gate.route as Row).reason || (gate.route as Row).message || "",
              )}
            </Notice>
          )}
          <Button
            title="Bắt đầu thử đồ"
            disabled={!gate.accepted || !consent || busy}
            onPress={() => void create()}
          />
        </Panel>
      )}
      {assetId && !gate?.accepted && (
        <Button
          title="Xóa ảnh đã tải"
          secondary
          disabled={busy}
          onPress={() => {
            void api(`/assets/${assetId}`, "DELETE")
              .then(() => {
                setAssetId("");
                setGate(undefined);
              })
              .catch((e) => setError(e.message));
          }}
        />
      )}
    </Screen>
  );
}
