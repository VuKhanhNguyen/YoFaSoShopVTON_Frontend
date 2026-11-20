import { useEffect, useState } from "react";
import { Image, type ImageProps } from "react-native";
import { imageSource } from "@/lib/api";

export function PrivateImage({ assetId, thumbnail, onError, ...props }: Omit<ImageProps, "source" | "onError"> & {
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
  return current?.url ? <Image {...props} onError={() => onError?.()} source={{ uri: current.url }} /> : null;
}
