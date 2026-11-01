import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Tokens, User } from "./models";
export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1"
).replace(/\/$/, "");
let current: Tokens | null = null;
let refreshing: Promise<void> | null = null;
let onExpired = () => {};
let remembered = false;
let foreground = true;
let lastActivity = 0;
let renewedAt = 0;
let lastAttempt = 0;
let restoring: Promise<User | null> | null = null;
let epoch = 0;
let storageWrite: Promise<unknown> = Promise.resolve();
export function setForeground(active: boolean) {
  foreground = active;
}
// Chỉ sự kiện chạm/gõ/cuộn gọi hàm này. Polling API không được gia hạn phiên.
export function noteActivity() {
  if (!foreground) return;
  lastActivity = Date.now();
  if (current && lastActivity - Math.max(renewedAt, lastAttempt) >= 60000) {
    lastAttempt = lastActivity;
    void renew().catch(() => {});
  }
}
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
  renewedAt = Date.now();
  lastAttempt = renewedAt;
  if (Platform.OS !== "web") {
    const refresh = tokens && remembered ? tokens.refreshToken : null;
    // Tuần tự hóa ghi/xóa để refresh đang chạy không khôi phục phiên vừa đăng xuất.
    storageWrite = storageWrite
      .catch(() => {})
      .then(() =>
        refresh
          ? SecureStore.setItemAsync(
              "yofaso.session",
              JSON.stringify({ refreshToken: refresh, remember: true }),
            )
          : SecureStore.deleteItemAsync("yofaso.session"),
      );
    await storageWrite;
  }
  // Expo Web chỉ giữ token trong bộ nhớ; không ghi localStorage/AsyncStorage.
}
async function renew() {
  if (!current) return;
  if (refreshing) return refreshing;
  const token = current.refreshToken,
    generation = epoch;
  refreshing = api<Tokens>(
    "/auth/refresh",
    "POST",
    { refreshToken: token },
    undefined,
    false,
  )
    .then(async (pair) => {
      if (epoch === generation && current?.refreshToken === token)
        await saveTokens(pair);
    })
    .catch(async (e) => {
      // Mất mạng không xóa thông tin đã ghi nhớ; token bị thu hồi thì phải đăng nhập lại.
      if (e instanceof ApiError && e.status === 401 && epoch === generation) {
        epoch++;
        remembered = false;
        await saveTokens(null);
        onExpired();
      }
      throw e;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export function restoreSession(): Promise<User | null> {
  if (!restoring)
    restoring = restoreSavedSession().finally(() => {
      restoring = null;
    });
  return restoring;
}
async function restoreSavedSession(): Promise<User | null> {
  if (Platform.OS === "web") return null;
  try {
    const stored = await SecureStore.getItemAsync("yofaso.session");
    if (!stored) return null;
    const { refreshToken, remember } = JSON.parse(stored);
    if (typeof refreshToken !== "string" || remember !== true) {
      await saveTokens(null);
      return null;
    }
    const pair = await api<Tokens>(
      "/auth/refresh",
      "POST",
      { refreshToken },
      undefined,
      false,
    );
    if (!pair.user.roles.includes("ROLE_CUSTOMER")) {
      await saveTokens(null);
      return null;
    }
    remembered = true;
    epoch++;
    await saveTokens(pair);
    lastActivity = Date.now();
    return pair.user;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 401)
      await saveTokens(null).catch(() => {});
    return null;
  }
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
    foreground &&
    Date.now() - lastActivity < 60000 &&
    retry &&
    !path.startsWith("/auth/")
  ) {
    await renew();
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
export async function login(
  body: unknown,
  register = false,
  remember = false,
): Promise<User> {
  const tokens = await api<Tokens>(
    register ? "/auth/register" : "/auth/login",
    "POST",
    body,
  );
  if (!tokens.user.roles.includes("ROLE_CUSTOMER"))
    throw new ApiError("Tài khoản nhân sự vui lòng dùng cổng nội bộ.", 403);
  epoch++;
  remembered = remember;
  lastActivity = Date.now();
  await saveTokens(tokens);
  return tokens.user;
}
export async function logout() {
  // Đợi lần xoay đang chạy trước khi thu hồi refresh mới nhất.
  await refreshing?.catch(() => {});
  const token = current;
  epoch++;
  remembered = false;
  await saveTokens(null);
  try {
    if (token)
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: token.refreshToken }),
        signal: AbortSignal.timeout(15000),
      });
  } finally {
    await saveTokens(null);
  }
}
export const requestKey = () =>
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
