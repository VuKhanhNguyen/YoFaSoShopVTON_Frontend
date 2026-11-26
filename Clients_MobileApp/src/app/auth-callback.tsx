import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";
import { getOAuthFallbackTarget, isNativeOAuthInProgress } from "@/lib/oauth";

/**
 * Fallback route cho deep link `yofasomobile://auth-callback` nếu hệ điều hành
 * định tuyến trực tiếp vào Expo Router thay vì đóng WebBrowser session tự động.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    oauthCode?: string;
    oauthError?: string;
    oauthMessage?: string;
  }>();

  useEffect(() => {
    const target = getOAuthFallbackTarget();
    const redirect = () => {
      router.replace({
        pathname: target,
        params: {
          ...(params.oauthCode ? { oauthCode: String(params.oauthCode) } : {}),
          ...(params.oauthError ? { oauthError: String(params.oauthError) } : {}),
          ...(params.oauthMessage ? { oauthMessage: String(params.oauthMessage) } : {}),
        },
      });
    };
    // Nếu WebBrowser.openAuthSessionAsync đang quản lý chính phiên này, giữ loading
    // chờ phiên đóng/điều hướng để không bắn đổi oauthCode lần 2.
    if (isNativeOAuthInProgress()) {
      const fallbackTimer = setTimeout(() => {
        if (!isNativeOAuthInProgress()) {
          router.replace(target);
        }
      }, 2500);
      return () => clearTimeout(fallbackTimer);
    }
    redirect();
  }, [params.oauthCode, params.oauthError, params.oauthMessage]);

  return (
    <View style={st.container}>
      <ActivityIndicator size="large" color={Colors.champagneDeep} />
      <Text style={st.label}>Đang hoàn tất xác thực YoFaSo...</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.canvas,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
