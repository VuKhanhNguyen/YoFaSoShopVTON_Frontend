import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, imageSource } from "@/lib/api";
import { Button, Notice } from "./ui";

export function ResultActions({ assetId }: { assetId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportImage(save: boolean) {
    setBusy(true);
    setMessage("");
    try {
      await api("/me").catch(() => {});
      const source = imageSource(assetId);
      const response = await fetch(source.uri, { headers: source.headers });
      if (!response.ok) throw new Error("Không tải được ảnh.");
      const blob = await response.blob();
      const file = new File([blob], `yofaso-${assetId}.png`, {
        type: "image/png",
      });
      if (!save && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Phong cách của tôi tại YoFaSo",
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
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
        onPress={() => void exportImage(true)}
      />
      <Button
        title="Chia sẻ phong cách"
        secondary
        disabled={busy}
        onPress={() => void exportImage(false)}
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
