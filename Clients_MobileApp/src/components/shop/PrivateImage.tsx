import { useEffect, useState } from "react";
import { Image, Platform, type ImageStyle, type StyleProp } from "react-native";
import { api, imageSource } from "@/lib/api";
import { Notice } from "./ui";
export function PrivateImage({
  assetId,
  style,
}: {
  assetId: string;
  style: StyleProp<ImageStyle>;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    if (Platform.OS !== "web") return;
    // HTML img không gửi headers của RN Image: tải qua fetch có Bearer rồi tạo URL cục bộ.
    api("/me")
      .then(async () => {
        const source = imageSource(assetId);
        const response = await fetch(source.uri, { headers: source.headers });
        if (!response.ok) throw new Error("Không tải được ảnh riêng.");
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);
  if (error) return <Notice error>{error}</Notice>;
  return Platform.OS === "web" ? (
    url ? (
      <Image
        accessibilityLabel="Ảnh thử đồ riêng của bạn"
        source={{ uri: url }}
        style={style}
      />
    ) : (
      <Notice>Đang tải ảnh...</Notice>
    )
  ) : (
    <Image
      accessibilityLabel="Ảnh thử đồ riêng của bạn"
      source={imageSource(assetId)}
      style={style}
    />
  );
}
