import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, imageSource } from "@/lib/api";
import { Button, Notice } from "./ui";

/** Tải / chia sẻ ảnh kết quả mà không rời màn hình phiên thử đồ hiện tại. */
export async function exportResultImage(assetId: string, save: boolean): Promise<string> {
  let local = "";
  try {
    await api("/me").catch(() => {});
    const source = imageSource(assetId);
    const safeName = assetId.replace(/[^A-Za-z0-9._-]/g, "_");
    if (Platform.OS === "web") {
      const response = await fetch(source.uri, { headers: source.headers });
      if (!response.ok) throw new Error("Không tải được ảnh.");
      const blob = await response.blob();
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
    if (!FileSystem.cacheDirectory) {
      throw new Error("Không có thư mục lưu tạm.");
    }
    local = `${FileSystem.cacheDirectory}yofaso-${safeName}.png`;
    const response = await FileSystem.downloadAsync(source.uri, local, {
      headers: source.headers,
    });
    if (response.status !== 200) throw new Error("Không tải được ảnh.");
    if (save) {
      const MediaLibrary = await import("expo-media-library");
      if (!(await MediaLibrary.requestPermissionsAsync(true)).granted) {
        throw new Error("Chưa có quyền lưu ảnh vào thư viện.");
      }
      await MediaLibrary.Asset.create(local);
      return "Đã lưu ảnh vào thư viện.";
    }
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
    }
    await Sharing.shareAsync(local, {
      mimeType: "image/png",
      dialogTitle: "Chia sẻ phong cách của bạn",
    });
    return "Đã mở chia sẻ phong cách.";
  } finally {
    if (local) {
      await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
    }
  }
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
