import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageSource } from "@/lib/api";
import { Colors } from "@/constants/theme";
import { SkeletonBox } from "./Skeleton";

export function PrivateImage({ assetId, thumbnail, onError, style, ...props }: Omit<ImageProps, "source" | "onError"> & {
  assetId: string;
  thumbnail?: boolean;
  onError?: (message?: string) => void;
}) {
  const { uri, headers } = imageSource(assetId, thumbnail);
  const token = headers?.Authorization;
  const [image, setImage] = useState<{ uri: string; token?: string; url?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    fetch(uri, { headers: token ? { Authorization: token } : undefined, signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Không tải được ảnh.");
        return response.blob();
      })
      .then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setImage({ uri, token, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setImage({ uri, token });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [uri, token]);
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
