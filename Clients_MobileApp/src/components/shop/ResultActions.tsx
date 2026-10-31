import { useState } from "react";
import { Platform, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { api, imageSource } from "@/lib/api";
import { Button, Notice } from "./ui";
export function ResultActions({ assetId }: { assetId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function exportImage(save: boolean) {
    setBusy(true);
    setMessage("");
    let local = "";
    try {
      await api("/me");
      const source = imageSource(assetId);
      if (Platform.OS === "web") {
        const response = await fetch(source.uri, { headers: source.headers });
        if (!response.ok) throw new Error("Không tải được ảnh.");
        const blob = await response.blob(),
          file = new File([blob], `yofaso-${assetId}.png`, {
            type: "image/png",
          });
        if (!save && navigator.canShare?.({ files: [file] }))
          await navigator.share({
            files: [file],
            title: "Phong cách của tôi tại YoFaSo",
          });
        else {
          const url = URL.createObjectURL(blob),
            link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        if (!FileSystem.cacheDirectory)
          throw new Error("Không có thư mục lưu tạm.");
        local = `${FileSystem.cacheDirectory}yofaso-${assetId}.png`;
        const response = await FileSystem.downloadAsync(source.uri, local, {
          headers: source.headers,
        });
        if (response.status !== 200) throw new Error("Không tải được ảnh.");
        if (save) {
          if (!(await MediaLibrary.requestPermissionsAsync(true)).granted)
            throw new Error("Chưa có quyền lưu ảnh vào thư viện.");
          await MediaLibrary.Asset.create(local);
          setMessage("Đã lưu ảnh vào thư viện.");
        } else {
          if (!(await Sharing.isAvailableAsync()))
            throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
          await Sharing.shareAsync(local, {
            mimeType: "image/png",
            dialogTitle: "Chia sẻ phong cách của bạn",
          });
        }
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (local)
        await FileSystem.deleteAsync(local, { idempotent: true }).catch(
          () => {},
        );
      setBusy(false);
    }
  }
  return (
    <View>
      <Button
        title="Lưu ảnh kết quả"
        secondary
        disabled={busy}
        onPress={() => void exportImage(true)}
      />
      <Button
        title="Chia sẻ ảnh"
        secondary
        disabled={busy}
        onPress={() => void exportImage(false)}
      />
      {message && <Notice>{message}</Notice>}
    </View>
  );
}
