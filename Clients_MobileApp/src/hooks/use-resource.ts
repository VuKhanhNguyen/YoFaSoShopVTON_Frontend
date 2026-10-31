import { cache, cached } from "@/lib/public-cache";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) {
      setData(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setData(undefined);
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
        if (path.startsWith("/catalog/"))
          void cache(path, value).catch(() => {});
      })
      .catch(async (e) => {
        const saved = path.startsWith("/catalog/")
          ? await cached<T>(path).catch(() => undefined)
          : undefined;
        if (active) {
          if (saved) setData(saved);
          setError(
            saved
              ? "Mất kết nối. Đang hiển thị catalog đã lưu; giá và tồn cần kiểm tra lại khi có mạng."
              : e.message,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, reload, setData };
}
