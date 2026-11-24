import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors, Fonts } from "@/constants/theme";

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
    router.replace({
      pathname: "/auth",
      params: {
        ...(params.oauthCode ? { oauthCode: String(params.oauthCode) } : {}),
        ...(params.oauthError ? { oauthError: String(params.oauthError) } : {}),
        ...(params.oauthMessage ? { oauthMessage: String(params.oauthMessage) } : {}),
      },
    });
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
