import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, imageSource } from "@/lib/api";
import { Colors } from "@/constants/theme";
import { SkeletonBox } from "./Skeleton";

export function PrivateImage({ assetId, customSource, thumbnail, onError, style, ...props }: Omit<ImageProps, "source" | "onError"> & {
  assetId?: string;
  customSource?: { uri: string; headers?: Record<string, string> };
  thumbnail?: boolean;
  onError?: (message?: string) => void;
}) {
  const resolved = customSource ?? (assetId ? imageSource(assetId, thumbnail) : { uri: "", headers: undefined });
  const uri = resolved.uri;
  const token = resolved.headers?.Authorization;
  const [image, setImage] = useState<{ uri: string; token?: string; url?: string }>();
  useEffect(() => {
    if (!uri) return;
    const controller = new AbortController();
    let url: string | undefined;
    const run = async () => {
      let response = await fetch(uri, { headers: token ? { Authorization: token } : undefined, signal: controller.signal });
      if (response.status === 401 && !controller.signal.aborted) {
        try {
          await api("/me");
          const refreshed = customSource ?? (assetId ? imageSource(assetId, thumbnail) : { uri, headers: undefined });
          const nextToken = refreshed.headers?.Authorization;
          response = await fetch(uri, { headers: nextToken ? { Authorization: nextToken } : undefined, signal: controller.signal });
        } catch {}
      }
      if (!response.ok) throw new Error("Không tải được ảnh.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setImage({ uri, token, url });
    };
    void run().catch(() => {
      if (!controller.signal.aborted) setImage({ uri, token });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [uri, token, assetId, thumbnail]);
  const current = image?.uri === uri && image.token === token ? image : undefined;
  useEffect(() => {
    if (current && !current.url) onError?.();
  }, [current, onError]);

  if (current?.url) {
    return <Image {...props} style={style} onError={() => onError?.()} source={{ uri: current.url }} />;
  }
  if (current && !current.url) {
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
