import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Tokens, User } from "./models";
export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1"
).replace(/\/$/, "");
let current: Tokens | null = null;
let refreshing: Promise<void> | null = null;
let onExpired = () => {};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export function setExpiryHandler(fn: () => void) {
  onExpired = fn;
}
export async function saveTokens(tokens: Tokens | null) {
  current = tokens;
  if (Platform.OS !== "web") {
    if (tokens)
      await SecureStore.setItemAsync("yofaso.session", JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync("yofaso.session");
  }
  // Expo Web chỉ giữ token trong bộ nhớ; không ghi localStorage/AsyncStorage.
}
export const imageSource = (assetId: string) => ({
  uri: `${BASE_URL}/assets/${encodeURIComponent(assetId)}/content`,
  headers: current
    ? { Authorization: `Bearer ${current.accessToken}` }
    : undefined,
});
export const publicUrl = (url: string) =>
  url.startsWith("/api/v1/") ? BASE_URL.replace(/\/api\/v1$/, "") + url : url;
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  retry = true,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    body instanceof FormData ? 60000 : 20000,
  );
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (
    response.status === 401 &&
    current &&
    retry &&
    !path.startsWith("/auth/")
  ) {
    if (!refreshing)
      refreshing = api<Tokens>(
        "/auth/refresh",
        "POST",
        { refreshToken: current.refreshToken },
        undefined,
        false,
      )
        .then(saveTokens)
        .finally(() => {
          refreshing = null;
        });
    try {
      await refreshing;
    } catch {
      await saveTokens(null);
      onExpired();
      throw new ApiError("Phiên đăng nhập đã hết hạn.", 401);
    }
    return api<T>(path, method, body, key, false);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = result.details?.fields || result.details || {};
    throw new ApiError(
      result.message || "Không thực hiện được thao tác.",
      response.status,
      Array.isArray(details)
        ? Object.fromEntries(
            details.map((f: { field: string; message: string }) => [
              f.field,
              f.message,
            ]),
          )
        : (Object.fromEntries(
            Object.entries(details).filter(([, v]) => typeof v === "string"),
          ) as Record<string, string>),
    );
  }
  return result as T;
}
export async function login(body: unknown, register = false): Promise<User> {
  const tokens = await api<Tokens>(
    register ? "/auth/register" : "/auth/login",
    "POST",
    body,
  );
  if (!tokens.user.roles.includes("ROLE_CUSTOMER"))
    throw new ApiError("Tài khoản nhân sự vui lòng dùng cổng nội bộ.", 403);
  await saveTokens(tokens);
  return tokens.user;
}
export async function logout() {
  try {
    if (current)
      await api("/auth/logout", "POST", { refreshToken: current.refreshToken });
  } finally {
    await saveTokens(null);
  }
}
export const requestKey = () =>
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
