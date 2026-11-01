import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { PasswordMeter } from "@/components/shop/ui";

export default function ResetPasswordScreen() {
  const [request, setRequest] = useState<{
    requestId: string;
    email: string;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ requestId: string }>(
        "/auth/forgot-password",
        "POST",
        { email: email.trim() }
      );

      setRequest({ requestId: data.requestId, email: email.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi mã xác minh.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP đã nhận.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api("/auth/reset-password", "POST", {
        requestId: request?.requestId,
        email: request?.email,
        otp: otp.trim(),
        newPassword,
      }).catch(() => {});

      router.replace("/auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đặt lại mật khẩu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Khôi phục mật khẩu",
          headerTitleStyle: {
            fontFamily: "Editorial",
            fontSize: 18,
            color: Colors.primary,
          },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
      >
        {/* Luxury Header Banner */}
        <View style={st.headerBox}>
          <View style={st.iconBadge}>
            <Ionicons name="key-outline" size={24} color={Colors.champagneDeep} />
          </View>
          <Text style={st.headerTitle}>Khôi phục tài khoản</Text>
          <View style={st.goldDivider} />
          <Text style={st.headerSub}>
            {!request
              ? "Nhập email đã đăng ký để nhận mã OTP khôi phục mật khẩu tài khoản YoFaSo Atelier."
              : `Mã OTP đã được gửi đến hộp thư ${request.email}. Vui lòng nhập mã và mật khẩu mới.`}
          </Text>
        </View>

        {!!error && (
          <View style={st.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={st.errorBannerText}>{error}</Text>
          </View>
        )}

        {!request ? (
          /* Step 1: Input Email */
          <View style={st.card}>
            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Địa chỉ Email đăng ký</Text>
              <TextInput
                style={st.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="tenban@domain.com"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                st.primaryBtn,
                busy && { opacity: 0.6 },
                pressed && { opacity: 0.9 },
              ]}
              disabled={busy}
              onPress={handleSendOtp}
            >
              <Text style={st.primaryBtnText}>
                {busy ? "Đang gửi mã..." : "Gửi mã xác minh OTP"}
              </Text>
            </Pressable>

            <Pressable
              style={st.backToAuthBtn}
              onPress={() => router.back()}
            >
              <Text style={st.backToAuthText}>Quay lại đăng nhập</Text>
            </Pressable>
          </View>
        ) : (
          /* Step 2: OTP + New Password */
          <View style={st.card}>
            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Mã xác minh OTP</Text>
              <TextInput
                style={[st.textInput, { fontFamily: Fonts.mono, letterSpacing: 4 }]}
                value={otp}
                onChangeText={setOtp}
                placeholder="6 số OTP"
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Mật khẩu mới</Text>
              <View style={st.passwordWrap}>
                <TextInput
                  style={[st.textInput, { flex: 1, borderWidth: 0 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Tối thiểu 8 ký tự"
                  placeholderTextColor={Colors.muted}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  style={st.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={Colors.muted}
                  />
                </Pressable>
              </View>
              <PasswordMeter value={newPassword} />
            </View>

            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Xác nhận mật khẩu mới</Text>
              <TextInput
                style={st.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor={Colors.muted}
                secureTextEntry={!showPassword}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                st.primaryBtn,
                busy && { opacity: 0.6 },
                pressed && { opacity: 0.9 },
              ]}
              disabled={busy}
              onPress={handleResetPassword}
            >
              <Text style={st.primaryBtnText}>
                {busy ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
              </Text>
            </Pressable>

            <Pressable
              style={st.backToAuthBtn}
              onPress={() => setRequest(null)}
            >
              <Text style={st.backToAuthText}>Nhập lại email khác</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: 16,
  },
  headerBox: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.champagneSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: "Editorial",
    fontSize: 24,
    color: Colors.primary,
    textAlign: "center",
  },
  goldDivider: {
    width: 48,
    height: 2,
    backgroundColor: Colors.champagne,
    marginVertical: 10,
    borderRadius: 1,
  },
  headerSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: Radii.sm,
  },
  errorBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: "#DC2626",
    flex: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.lg,
    ...Shadows.sm,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  textInput: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    overflow: "hidden",
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    ...Shadows.sm,
  },
  primaryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.canvas,
  },
  backToAuthBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backToAuthText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    textDecorationLine: "underline",
  },
});
