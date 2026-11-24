import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, ApiError, BASE_URL, completeSession } from "./api";
import type {
  LinkedAccountItem,
  OAuthExchangeResponse,
  OAuthLinkRequired,
  OAuthProvider,
  Tokens,
  User,
} from "./models";

WebBrowser.maybeCompleteAuthSession();

export type OAuthStartResult =
  | { status: "REDIRECTED" }
  | { status: "CANCELLED" }
  | { status: "AUTHENTICATED"; user: User; provider: string; isNewUser?: boolean }
  | OAuthLinkRequired
  | { status: "LINKED"; provider: string; linkedAccounts: LinkedAccountItem[] };

export function getOAuthReturnUrl(webPath: "/auth" | "/settings" = "/auth"): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${webPath}`;
  }
  return Linking.createURL("auth-callback");
}

function parseCallbackParams(url: string): {
  oauthCode?: string;
  oauthError?: string;
  oauthMessage?: string;
} {
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams || {};
    const first = (v: unknown) =>
      Array.isArray(v) ? String(v[0] ?? "") : v != null ? String(v) : undefined;
    return {
      oauthCode: first(q.oauthCode),
      oauthError: first(q.oauthError),
      oauthMessage: first(q.oauthMessage),
    };
  } catch {
    const queryPart = url.split("?")[1] || "";
    const params = new URLSearchParams(queryPart);
    return {
      oauthCode: params.get("oauthCode") || undefined,
      oauthError: params.get("oauthError") || undefined,
      oauthMessage: params.get("oauthMessage") || undefined,
    };
  }
}

export function formatProviderName(provider?: string): string {
  return provider?.toUpperCase() === "FACEBOOK" ? "Facebook" : "Google";
}

export async function getOAuthProvidersStatus(): Promise<{
  google: boolean;
  facebook: boolean;
}> {
  return api<{ google: boolean; facebook: boolean }>("/auth/oauth/providers", "GET");
}

/** Đổi one-time code từ callback Backend lấy JWT phiên hoặc yêu cầu xác nhận liên kết trùng email. */
export async function exchangeOAuthCode(code: string): Promise<OAuthStartResult> {
  const res = await api<OAuthExchangeResponse>("/auth/oauth/exchange", "POST", { code });
  if (res.status === "AUTHENTICATED") {
    const user = await completeSession(res, true);
    await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
    return {
      status: "AUTHENTICATED",
      user,
      provider: res.provider,
      isNewUser: res.isNewUser,
    };
  }
  if (res.status === "LINK_REQUIRED") {
    return res;
  }
  return {
    status: "LINKED",
    provider: res.provider,
    linkedAccounts: res.linkedAccounts || [],
  };
}

/** Xác nhận hoặc hủy gộp tài khoản khi email trùng với tài khoản YoFaSo hiện có. */
export async function confirmOAuthAccountLink(
  linkToken: string,
  action: "CONFIRM" | "CANCEL",
): Promise<User | null> {
  const res = await api<
    (Tokens & { status: "AUTHENTICATED"; linked?: boolean; provider?: string }) | { status: "CANCELLED"; cancelled: boolean }
  >("/auth/oauth/confirm-link", "POST", { linkToken, action });

  if (action === "CANCEL" || res.status !== "AUTHENTICATED") {
    return null;
  }
  const user = await completeSession(res, true);
  await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
  return user;
}

/** Khởi chạy luồng đăng nhập / đăng ký Google hoặc Facebook (dùng chung cho cả 2 tab). */
export async function startSocialAuth(provider: OAuthProvider): Promise<OAuthStartResult> {
  const returnUrl = getOAuthReturnUrl("/auth");
  const startUrl = `${BASE_URL}/auth/oauth/${provider}/start?redirectUri=${encodeURIComponent(returnUrl)}`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(startUrl);
    return { status: "REDIRECTED" };
  }

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== "success" || !result.url) {
    return { status: "CANCELLED" };
  }

  const { oauthCode, oauthError, oauthMessage } = parseCallbackParams(result.url);
  if (oauthError) {
    if (oauthError === "OAUTH_CANCELLED") {
      return { status: "CANCELLED" };
    }
    throw new ApiError(
      oauthMessage || `Không thể đăng nhập bằng ${formatProviderName(provider)}.`,
      400,
    );
  }
  if (!oauthCode) {
    throw new ApiError("Không nhận được mã xác thực từ máy chủ. Vui lòng thử lại.", 400);
  }
  return exchangeOAuthCode(oauthCode);
}

/** Liên kết thêm Google hoặc Facebook từ màn hình Cài đặt (gọi POST có JWT để lấy authorizeUrl). */
export async function startLinkSocialFromSettings(
  provider: OAuthProvider,
): Promise<OAuthStartResult> {
  const returnUrl = getOAuthReturnUrl("/settings");
  const { authorizeUrl } = await api<{ authorizeUrl: string }>(
    `/me/linked-accounts/${provider}/start`,
    "POST",
    { redirectUri: returnUrl },
  );

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(authorizeUrl);
    return { status: "REDIRECTED" };
  }

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type !== "success" || !result.url) {
    return { status: "CANCELLED" };
  }

  const { oauthCode, oauthError, oauthMessage } = parseCallbackParams(result.url);
  if (oauthError) {
    if (oauthError === "OAUTH_CANCELLED") {
      return { status: "CANCELLED" };
    }
    throw new ApiError(
      oauthMessage || `Không thể liên kết tài khoản ${formatProviderName(provider)}.`,
      400,
    );
  }
  if (!oauthCode) {
    throw new ApiError("Không nhận được mã xác thực liên kết. Vui lòng thử lại.", 400);
  }
  return exchangeOAuthCode(oauthCode);
}

export async function fetchLinkedAccounts(): Promise<{
  linkedAccounts: LinkedAccountItem[];
  hasEmail: boolean;
  hasPhone: boolean;
  providersConfigured: { google: boolean; facebook: boolean };
}> {
  return api("/me/linked-accounts", "GET");
}

export async function unlinkSocialProvider(provider: OAuthProvider): Promise<{
  unlinked: boolean;
  provider: string;
  linkedAccounts: LinkedAccountItem[];
}> {
  return api(`/me/linked-accounts/${provider}`, "DELETE");
}
