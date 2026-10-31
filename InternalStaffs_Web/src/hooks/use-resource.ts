"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
type Result<T> = { path: string; version: number; data?: T; error?: string };
export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<Result<T>>(),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) return;
    api<T>(path)
      .then((data) => {
        if (active) setResult({ path, version, data });
      })
      .catch((e) => {
        if (active) setResult({ path, version, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  const fresh = result?.path === path && result?.version === version;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: fresh ? result?.data : undefined,
    loading: Boolean(path) && !fresh,
    error: fresh ? result?.error || "" : "",
    reload,
  };
}
