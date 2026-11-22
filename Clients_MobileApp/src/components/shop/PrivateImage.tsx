import { useEffect, useState } from "react";
import { StyleSheet, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { api, imageSource, requestKey } from "@/lib/api";
import { Colors } from "@/constants/theme";
import { SkeletonBox } from "./Skeleton";

export function PrivateImage({ assetId, thumbnail, onError, style, ...props }: Omit<ImageProps, "source" | "onError"> & {
  assetId: string;
  thumbnail?: boolean;
  onError?: (message?: string) => void;
}) {
  const reducedMotion = useReducedMotion();
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

  if (current?.uri) {
    return (
      <Animated.Image
        {...props}
        style={style}
        entering={reducedMotion ? undefined : FadeIn.duration(220)}
        onError={() => onError?.("Thiết bị không giải mã được ảnh.")}
        source={{ uri: current.uri }}
      />
    );
  }

  if (current?.error) {
    return (
      <View style={[style as StyleProp<ViewStyle>, st.errorPlaceholder]}>
        <SkeletonBox style={StyleSheet.absoluteFill} borderRadius={0} staticOnly />
        <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
      </View>
    );
  }

  return <SkeletonBox style={style as StyleProp<ViewStyle>} borderRadius={0} />;
}

const st = StyleSheet.create({
  errorPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
