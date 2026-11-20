import { useEffect, useState } from "react";
import { Image, type ImageProps } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { api, imageSource, requestKey } from "@/lib/api";

export function PrivateImage({ assetId, thumbnail, onError, ...props }: Omit<ImageProps, "source" | "onError"> & {
  assetId: string;
  thumbnail?: boolean;
  onError?: (message?: string) => void;
}) {
  const [loaded, setLoaded] = useState<{ assetId: string; uri?: string; error?: string }>();
  useEffect(() => {
    let active = true;
    const path = FileSystem.cacheDirectory && FileSystem.cacheDirectory + "private-" + requestKey() + ".png";
    const remove = () => path ? FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}) : Promise.resolve();
    async function load() {
      if (!path) throw new Error("Không có thư mục lưu ảnh tạm.");
      const download = () => {
        const source = imageSource(assetId, thumbnail);
        return FileSystem.downloadAsync(source.uri, path, { headers: source.headers });
      };
      let response = await download();
      if (response.status === 401 && active) {
        await api("/me");
        if (active) response = await download();
      }
      if (response.status !== 200) throw new Error("Máy chủ trả HTTP " + response.status + " khi tải ảnh.");
      if (active) setLoaded({ assetId, uri: response.uri });
    }
    void load().catch((error: Error) => {
      if (active) setLoaded({ assetId, error: error.message });
    }).finally(() => {
      if (!active) void remove();
    });
    return () => { active = false; void remove(); };
  }, [assetId, thumbnail]);
  const current = loaded?.assetId === assetId ? loaded : undefined;
  useEffect(() => {
    if (current?.error) onError?.(current.error);
  }, [current, onError]);
  return current?.uri ? <Image {...props} onError={() => onError?.("Thiết bị không giải mã được ảnh.")}
    source={{ uri: current.uri }} /> : null;
}
