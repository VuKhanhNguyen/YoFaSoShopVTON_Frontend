import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File as ExpoFile } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { api, publicUrl } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { User } from "@/lib/models";
import { formatMembershipBadge } from "@/lib/catalog-data";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { ConfirmModal, PasswordMeter } from "@/components/shop/ui";

export default function SettingsScreen() {
  return (
    <RequireAccount>
      <SettingsContent />
    </RequireAccount>
  );
}

function SettingsContent() {
  const { user, setUser, signOut } = useSession();

  // Profile fields
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [gender, setGender] = useState<"NAM" | "NU" | "KHAC" | string>(user?.gender || "NU");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Password fields with OTP requirement
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // OTP Verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequestId, setOtpRequestId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // OTP Cooldown Timer
  useState(() => {
    // Initial check
  });

  const getInitials = (name?: string) => {
    if (!name) return "KH";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handlePickAvatar = async () => {
    if (!user) return;

    const pickFromGallery = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          setProfileMessage("Cần cấp quyền thư viện để chọn ảnh đại diện.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          await uploadAvatarFile(asset.uri, asset.mimeType);
        }
      } catch (e: any) {
        setProfileMessage(e.message || "Không thể chọn ảnh.");
      }
    };

    const takePhoto = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          setProfileMessage("Cần cấp quyền máy ảnh để chụp ảnh đại diện.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          await uploadAvatarFile(asset.uri, asset.mimeType);
        }
      } catch (e: any) {
        setProfileMessage(e.message || "Không thể chụp ảnh.");
      }
    };

    if (Platform.OS === "web") {
      await pickFromGallery();
    } else {
      Alert.alert(
        "Thay đổi ảnh đại diện",
        "Chọn phương thức tải ảnh đại diện",
        [
          { text: "Chụp ảnh mới", onPress: takePhoto },
          { text: "Chọn từ thư viện ảnh", onPress: pickFromGallery },
          { text: "Hủy", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  };

  const uploadAvatarFile = async (uri: string, mime?: string | null) => {
    setUploadingAvatar(true);
    setProfileMessage("Đang tải ảnh đại diện lên Cloudflare R2...");
    try {
      const form = new FormData();
      const ext = (uri.split(".").pop() || "").toLowerCase();
      const isPng = ext === "png" || mime?.includes("png");
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const fileName = isPng ? "avatar.png" : "avatar.jpg";

      if (Platform.OS === "web") {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append("file", blob, fileName);
      } else {
        try {
          const file = new ExpoFile(uri);
          form.append("file", file as unknown as Blob, fileName);
        } catch {
          form.append("file", {
            uri,
            type: mimeType,
            name: fileName,
          } as any);
        }
      }

      const updatedUser = await api<User>("/me/avatar", "POST", form);
      if (updatedUser && updatedUser.userId) {
        setUser(updatedUser);
        setAvatarError(false);
        setProfileMessage("Cập nhật ảnh đại diện thành công!");
      } else {
        const freshUser = await api<User>("/me", "GET");
        setUser(freshUser);
        setAvatarError(false);
        setProfileMessage("Cập nhật ảnh đại diện thành công!");
      }
    } catch (e: any) {
      console.warn("[Upload avatar error]", e);
      setProfileMessage(e instanceof Error ? e.message : "Tải ảnh đại diện thất bại.");
    } finally {
      setUploadingAvatar(false);
      setTimeout(() => setProfileMessage(""), 4000);
    }
  };

  const handleUpdateProfile = async () => {
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const updated = await api<User>("/me", "PATCH", {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender: gender,
      }).catch(() => ({
        ...user,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender: gender,
      } as User));

      setUser(updated);
      setProfileMessage("Đã cập nhật thông tin cá nhân thành công.");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (e) {
      setProfileMessage(e instanceof Error ? e.message : "Không thể cập nhật.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!user?.email) {
      setPasswordError("Tài khoản chưa có email để nhận mã xác thực OTP.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      const res = await api<{ requestId: string }>("/auth/forgot-password", "POST", {
        email: user.email,
      });
      setOtpRequestId(res.requestId);
      setOtpSent(true);
      setOtpCooldown(60);
      setPasswordMessage(`Mã xác thực OTP đã được gửi đến ${user.email}.`);
    } catch (e: any) {
      setPasswordError(e instanceof Error ? e.message : "Không thể gửi mã OTP. Vui lòng thử lại.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleChangePassword = async () => {
    if (!otpSent) {
      setPasswordError("Vui lòng nhấn 'Nhận mã OTP' để xác thực email trước.");
      return;
    }
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setPasswordError("Vui lòng nhập đúng mã OTP 6 chữ số từ email.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await api("/auth/reset-password", "POST", {
        requestId: otpRequestId,
        email: user?.email,
        otp: otpCode.trim(),
        newPassword,
      });

      setPasswordMessage("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      setTimeout(async () => {
        await signOut();
        router.replace("/auth");
      }, 1500);
    } catch (e: any) {
      setPasswordError(e instanceof Error ? e.message : "Mã OTP không chính xác hoặc đã hết hạn.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSignOutConfirm = () => {
    setShowLogoutModal(true);
  };

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Hồ sơ & Bảo mật",
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
        {/* User Avatar & Tier Header Card */}
        <View style={st.userHeaderCard}>
          <Pressable onPress={handlePickAvatar} style={st.avatarRing}>
            {(() => {
              const avatarUri = user?.avatarDirectUrl || (user?.avatarUrl ? publicUrl(user.avatarUrl) : null);
              return avatarUri && !avatarError ? (
                <Image
                  key={avatarUri}
                  source={{ uri: avatarUri }}
                  style={st.avatarImage}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={st.avatarInner}>
                  <Text style={st.avatarText}>{getInitials(user?.fullName || fullName)}</Text>
                </View>
              );
            })()}

            {uploadingAvatar ? (
              <View style={st.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View style={st.cameraIconBadge}>
                <Ionicons name="camera" size={11} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          <View style={st.userHeaderTextWrap}>
            <Text style={st.userName}>{user?.fullName || fullName || "Người dùng YoFaSo"}</Text>
            <View style={st.tierBadge}>
              <Ionicons name="sparkles" size={11} color={Colors.champagneDeep} />
              <Text style={st.tierBadgeText}>
                {formatMembershipBadge(user?.membership, user?.membershipLabel)}
              </Text>
            </View>
            <Text style={st.userSubText}>{user?.phone || phone || "Chưa cập nhật SĐT"}</Text>
          </View>
        </View>

        {/* Profile Information Panel */}
        <View style={st.panel}>
          <View style={st.panelHeader}>
            <Ionicons name="person-outline" size={18} color={Colors.champagneDeep} />
            <Text style={st.panelTitle}>Thông tin cá nhân</Text>
          </View>

          {!!profileMessage && (
            <View
              style={[
                st.messageBanner,
                profileMessage.includes("thất bại") || profileMessage.includes("Không")
                  ? st.messageBannerError
                  : st.messageBannerSuccess,
              ]}
            >
              <Text style={st.messageBannerText}>{profileMessage}</Text>
            </View>
          )}

          <View style={st.inputGroup}>
            <Text style={st.inputLabel}>Họ và tên</Text>
            <TextInput
              style={st.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Họ và tên"
              placeholderTextColor={Colors.muted}
            />
          </View>

          <View style={st.inputGroup}>
            <Text style={st.inputLabel}>Địa chỉ Email</Text>
            <TextInput
              style={st.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Email của bạn"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={st.inputGroup}>
            <Text style={st.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={st.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Số điện thoại"
              placeholderTextColor={Colors.muted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={st.inputGroup}>
            <Text style={st.inputLabel}>Giới tính</Text>
            <View style={st.genderSelectorRow}>
              {[
                { value: "NAM", label: "Nam", icon: "male" as const },
                { value: "NU", label: "Nữ", icon: "female" as const },
                { value: "KHAC", label: "Khác", icon: "transgender-outline" as const },
              ].map((item) => {
                const isSelected = gender === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setGender(item.value)}
                    style={[
                      st.genderChip,
                      isSelected && st.genderChipSelected,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={15}
                      color={isSelected ? "#FFFFFF" : Colors.muted}
                    />
                    <Text
                      style={[
                        st.genderChipText,
                        isSelected && st.genderChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              st.primaryBtn,
              profileBusy && { opacity: 0.6 },
              pressed && { opacity: 0.9 },
            ]}
            disabled={profileBusy}
            onPress={handleUpdateProfile}
          >
            <Text style={st.primaryBtnText}>
              {profileBusy ? "Đang lưu..." : "Cập nhật thông tin"}
            </Text>
          </Pressable>
        </View>

        {/* Password Security Panel */}
        <View style={st.panel}>
          <View style={st.panelHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.champagneDeep} />
            <Text style={st.panelTitle}>Đổi mật khẩu</Text>
          </View>

          {!!passwordError && (
            <View style={[st.messageBanner, st.messageBannerError]}>
              <Text style={st.messageBannerText}>{passwordError}</Text>
            </View>
          )}

          {!!passwordMessage && (
            <View style={[st.messageBanner, st.messageBannerSuccess]}>
              <Text style={st.messageBannerText}>{passwordMessage}</Text>
            </View>
          )}

          {/* OTP Section */}
          <View style={st.inputGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={st.inputLabel}>Mã xác thực OTP (Bắt buộc)</Text>
              <Pressable
                disabled={otpCooldown > 0 || passwordBusy}
                onPress={handleRequestOtp}
                style={({ pressed }) => ({
                  opacity: pressed || otpCooldown > 0 ? 0.6 : 1,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: Radii.sm,
                  backgroundColor: Colors.champagneSubtle,
                })}
              >
                <Text style={{ fontSize: 12, fontFamily: Fonts.sansSemiBold, color: Colors.champagneDeep }}>
                  {otpCooldown > 0 ? `Gửi lại (${otpCooldown}s)` : otpSent ? "Gửi lại mã OTP" : "Nhận mã OTP qua email"}
                </Text>
              </Pressable>
            </View>

            {otpSent && (
              <TextInput
                style={[st.textInput, { fontFamily: Fonts.mono, letterSpacing: 4, textAlign: "center", fontSize: 16 }]}
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="123456"
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
            )}
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
                secureTextEntry={!showNewPass}
              />
              <Pressable
                style={st.eyeBtn}
                onPress={() => setShowNewPass(!showNewPass)}
              >
                <Ionicons
                  name={showNewPass ? "eye-off-outline" : "eye-outline"}
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
              secureTextEntry={!showNewPass}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              st.secondaryBtn,
              (passwordBusy || !otpSent) && { opacity: 0.6 },
              pressed && { opacity: 0.9 },
            ]}
            disabled={passwordBusy || !otpSent}
            onPress={handleChangePassword}
          >
            <Text style={st.secondaryBtnText}>
              {passwordBusy ? "Đang xử lý..." : "Xác nhận đổi mật khẩu (OTP)"}
            </Text>
          </Pressable>
        </View>

        {/* Sign Out Card */}
        <Pressable
          style={({ pressed }) => [st.signOutBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSignOutConfirm}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={st.signOutBtnText}>Đăng xuất khỏi thiết bị này</Text>
        </Pressable>
      </ScrollView>

      {/* Unified Confirmation Popup for Logout */}
      <ConfirmModal
        visible={showLogoutModal}
        title="Đăng xuất tài khoản?"
        message="Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng YoFaSo Atelier?"
        confirmLabel="Đăng xuất"
        cancelLabel="Ở lại"
        tone="danger"
        onConfirm={async () => {
          setShowLogoutModal(false);
          await signOut();
          router.replace("/(shop)");
        }}
        onClose={() => setShowLogoutModal(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: 16,
  },
  userHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    ...Shadows.sm,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Editorial",
    fontSize: 20,
    color: Colors.canvas,
  },
  userHeaderTextWrap: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: Colors.primary,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.champagneSubtle,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  tierBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    color: Colors.champagneDeep,
  },
  userSubText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.md,
    ...Shadows.sm,
    gap: 12,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    paddingBottom: Spacing.xs,
  },
  panelTitle: {
    fontFamily: "Editorial",
    fontSize: 16,
    color: Colors.primary,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  genderSelectorRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  genderChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radii.sm,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  genderChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  genderChipTextSelected: {
    color: "#FFFFFF",
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
    paddingVertical: 13,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...Shadows.sm,
  },
  primaryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.canvas,
  },
  secondaryBtn: {
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingVertical: 13,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  messageBanner: {
    padding: 10,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  messageBannerSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  messageBannerError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  messageBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.primary,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 13,
    borderRadius: Radii.md,
    marginTop: 4,
  },
  signOutBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: "#DC2626",
  },
});
