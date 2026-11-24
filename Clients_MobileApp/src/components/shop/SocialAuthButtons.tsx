import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { Colors, Fonts, Radii } from "@/constants/theme";
import type { OAuthProvider } from "@/lib/models";

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
      />
    </Svg>
  );
}

export function SocialAuthButtons({
  loadingProvider,
  disabled,
  onPress,
}: {
  loadingProvider: OAuthProvider | null;
  disabled?: boolean;
  onPress: (provider: OAuthProvider) => void;
}) {
  const isDisabled = disabled || loadingProvider !== null;

  return (
    <View style={st.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tiếp tục với Google"
        disabled={isDisabled}
        onPress={() => onPress("google")}
        style={({ pressed }) => [
          st.btn,
          pressed && !isDisabled && st.btnPressed,
          isDisabled && st.btnDisabled,
        ]}
      >
        {loadingProvider === "google" ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <GoogleLogo size={18} />
        )}
        <Text style={st.btnText}>Google</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tiếp tục với Facebook"
        disabled={isDisabled}
        onPress={() => onPress("facebook")}
        style={({ pressed }) => [
          st.btn,
          st.fbBtn,
          pressed && !isDisabled && st.btnPressed,
          isDisabled && st.btnDisabled,
        ]}
      >
        {loadingProvider === "facebook" ? (
          <ActivityIndicator size="small" color="#1877F2" />
        ) : (
          <Ionicons name="logo-facebook" size={20} color="#1877F2" />
        )}
        <Text style={st.btnText}>Facebook</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fbBtn: {
    borderColor: "rgba(24, 119, 242, 0.25)",
    backgroundColor: "rgba(24, 119, 242, 0.04)",
  },
  btnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.primary,
  },
});
