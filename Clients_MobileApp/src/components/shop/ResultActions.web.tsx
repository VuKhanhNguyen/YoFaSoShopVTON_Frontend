import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, imageSource } from "@/lib/api";
import { Button, Notice } from "./ui";

/** Tải / chia sẻ ảnh kết quả trên web mà không rời phiên thử đồ hiện tại. */
export async function exportResultImage(assetId: string, save: boolean): Promise<string> {
  await api("/me").catch(() => {});
  const source = imageSource(assetId);
  const response = await fetch(source.uri, { headers: source.headers });
  if (!response.ok) throw new Error("Không tải được ảnh.");
  const blob = await response.blob();
  const safeName = assetId.replace(/[^A-Za-z0-9._-]/g, "_");
  const file = new File([blob], `yofaso-${safeName}.png`, {
    type: "image/png",
  });
  if (!save && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Phong cách của tôi tại YoFaSo",
    });
    return "Đã mở chia sẻ ảnh.";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "Đã tải ảnh kết quả về thiết bị.";
}

export function ResultActions({ assetId }: { assetId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleExport(save: boolean) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await exportResultImage(assetId, save));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={st.container}>
      <Button
        title={busy ? "Đang xử lý..." : "Lưu ảnh kết quả"}
        secondary
        disabled={busy}
        onPress={() => void handleExport(true)}
      />
      <Button
        title="Chia sẻ phong cách"
        secondary
        disabled={busy}
        onPress={() => void handleExport(false)}
      />
      {!!message && <Notice>{message}</Notice>}
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 8,
  },
});
