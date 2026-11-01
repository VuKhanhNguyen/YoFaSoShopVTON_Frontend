import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "@/lib/session";
import { api, login } from "@/lib/api";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { EditorialImages } from "@/lib/catalog-data";
import { Button, Notice, PasswordMeter } from "@/components/shop/ui";
import { DatePickerField } from "@/components/shop/DatePickerField";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DRAWER_MIN_HEIGHT = Math.round(SCREEN_HEIGHT * 0.64);
const DRAWER_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.93);

// Regex kiểm tra họ và tên chỉ chứa chữ cái và khoảng trắng (hỗ trợ Unicode tiếng Việt)
const VIETNAMESE_NAME_REGEX = /^[\p{L}\s]+$/u;

export default function AuthScreen() {
  const { setUser } = useSession();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");

  // Login inputs (Không cần +84, cho phép email / SĐT / username)
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register inputs
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regDateOfBirth, setRegDateOfBirth] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Forgot password inputs
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotRequestId, setForgotRequestId] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Drawer Height Animated Value (Clamped between DRAWER_MIN_HEIGHT and DRAWER_MAX_HEIGHT)
  const drawerHeight = useRef(new Animated.Value(DRAWER_MIN_HEIGHT)).current;
  const currentHeight = useRef(DRAWER_MIN_HEIGHT);
  const [isExpanded, setIsExpanded] = useState(false);

  // Spring drawer helper
  const animateDrawer = (toHeight: number) => {
    Animated.spring(drawerHeight, {
      toValue: toHeight,
      friction: 8,
      tension: 65,
      useNativeDriver: false,
    }).start();
  };

  // PanResponder cho thanh kéo ngăn kéo
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderMove: (_, gesture) => {
          const target = currentHeight.current - gesture.dy;
          // Nghiêm cấm kéo xuống dưới DRAWER_MIN_HEIGHT làm mất form
          if (target < DRAWER_MIN_HEIGHT) {
            drawerHeight.setValue(DRAWER_MIN_HEIGHT);
          } else if (target > DRAWER_MAX_HEIGHT) {
            drawerHeight.setValue(DRAWER_MAX_HEIGHT);
          } else {
            drawerHeight.setValue(target);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -35 || gesture.vy < -0.4) {
            animateDrawer(DRAWER_MAX_HEIGHT);
            setIsExpanded(true);
            currentHeight.current = DRAWER_MAX_HEIGHT;
          } else if (gesture.dy > 35 || gesture.vy > 0.4) {
            animateDrawer(DRAWER_MIN_HEIGHT);
            setIsExpanded(false);
            currentHeight.current = DRAWER_MIN_HEIGHT;
          } else {
            const mid = (DRAWER_MIN_HEIGHT + DRAWER_MAX_HEIGHT) / 2;
            const target = currentHeight.current > mid ? DRAWER_MAX_HEIGHT : DRAWER_MIN_HEIGHT;
            animateDrawer(target);
            setIsExpanded(target === DRAWER_MAX_HEIGHT);
            currentHeight.current = target;
          }
        },
      }),
    []
  );

  // Chuyển tab Đăng nhập / Đăng ký
  const handleSelectTab = (selectedTab: "login" | "register") => {
    setTab(selectedTab);
    setError("");
    setIsForgotMode(false);
    if (selectedTab === "register") {
      animateDrawer(DRAWER_MAX_HEIGHT);
      setIsExpanded(true);
      currentHeight.current = DRAWER_MAX_HEIGHT;
    }
  };

  // Xử lý Đăng nhập
  const handleLoginSubmit = async () => {
    setError("");
    if (!loginIdentifier.trim()) {
      setError("Vui lòng nhập số điện thoại, email hoặc tên đăng nhập.");
      return;
    }
    if (!loginPassword) {
      setError("Vui lòng nhập mật khẩu tài khoản.");
      return;
    }
    if (loginPassword.length < 6) {
      setError("Mật khẩu tài khoản tối thiểu 6 ký tự.");
      return;
    }

    setLoading(true);
    try {
      const u = await login(
        {
          username: loginIdentifier.trim(),
          password: loginPassword,
        },
        false,
        true
      );
      await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
      setUser(u);
      router.replace("/(shop)");
    } catch (e: any) {
      setError(e.message || "Tên đăng nhập hoặc mật khẩu không chính xác.");
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Đăng ký
  const handleRegisterSubmit = async () => {
    setError("");

    // 1. Tên đăng nhập
    const cleanUsername = regUsername.trim();
    if (!cleanUsername || cleanUsername.length < 4 || cleanUsername.length > 15) {
      setError("Tên đăng nhập từ 4 đến 15 ký tự (chữ cái đầu, không dấu và khoảng trắng).");
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9]{3,14}$/.test(cleanUsername)) {
      setError("Tên đăng nhập phải bắt đầu bằng chữ cái và chỉ gồm chữ hoặc số.");
      return;
    }

    // 2. Họ và tên: ràng buộc KHÔNG CHỨA SỐ VÀ KÝ TỰ ĐẶC BIỆT
    const cleanName = regFullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Vui lòng nhập đầy đủ họ và tên của bạn.");
      return;
    }
    if (!VIETNAMESE_NAME_REGEX.test(cleanName)) {
      setError("Họ và tên chỉ được chứa chữ cái và khoảng trắng, không chứa số hoặc ký tự đặc biệt.");
      return;
    }

    // 3. Ngày tháng năm sinh
    if (!regDateOfBirth) {
      setError("Vui lòng chọn ngày tháng năm sinh của bạn.");
      return;
    }

    // 4. Email
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail || !/.+@.+\..+/.test(cleanEmail)) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    // 5. Số điện thoại (CÓ +84 BÊN ĐĂNG KÝ)
    const phoneDigits = regPhone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 9 || phoneDigits.length > 11) {
      setError("Vui lòng nhập số điện thoại hợp lệ (9 đến 11 chữ số).");
      return;
    }
    const finalPhone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;

    // 6. Mật khẩu
    if (!regPassword || regPassword.length < 10) {
      setError("Mật khẩu bảo mật cần có ít nhất 10 ký tự, gồm cả chữ và số.");
      return;
    }
    if (!/[A-Za-z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      setError("Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.");
      return;
    }

    // 7. Xác nhận mật khẩu
    if (regPassword !== regConfirmPassword) {
      setError("Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    setLoading(true);
    try {
      const u = await login(
        {
          username: cleanUsername,
          fullName: cleanName,
          dateOfBirth: regDateOfBirth,
          email: cleanEmail,
          phone: finalPhone,
          password: regPassword,
        },
        true,
        true
      );
      await AsyncStorage.setItem("yofaso.onboarding.v1", "seen").catch(() => {});
      setUser(u);
      router.replace("/(shop)");
    } catch (e: any) {
      setError(e.message || "Không thể đăng ký tài khoản. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
    }
  };

  // Quên mật khẩu: Gửi OTP
  const handleForgotSendOtp = async () => {
    setError("");
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !/.+@.+\..+/.test(cleanEmail)) {
      setError("Vui lòng nhập email hợp lệ đã dùng để đăng ký tài khoản.");
      return;
    }

    setLoading(true);
    try {
      const res = await api<{ requestId: string; message: string }>(
        "/auth/forgot-password",
        "POST",
        { email: cleanEmail }
      );

      setForgotRequestId(res.requestId || `req-${Date.now()}`);
      setForgotStep("reset");
      setForgotSuccessNotice(`Mã xác minh OTP đã được gửi đến hộp thư ${cleanEmail}.`);
    } catch (e: any) {
      setError(e.message || "Không thể gửi mã xác minh OTP. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // Quên mật khẩu: Xác nhận OTP và đặt mật khẩu mới
  const handleForgotResetPassword = async () => {
    setError("");
    if (!forgotOtp.trim()) {
      setError("Vui lòng nhập mã OTP 6 số đã nhận qua email.");
      return;
    }
    if (forgotNewPassword.length < 10) {
      setError("Mật khẩu mới tối thiểu 10 ký tự, có cả chữ và số.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", "POST", {
        requestId: forgotRequestId,
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword,
      }).catch(() => {});

      setIsForgotMode(false);
      setForgotStep("request");
      setLoginIdentifier(forgotEmail.trim().toLowerCase());
      setLoginPassword("");
      setForgotSuccessNotice("Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.");
      setTab("login");
    } catch (e: any) {
      setError(e.message || "Xác nhận mã OTP thất bại hoặc mã đã hết hạn.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={st.container}>
      {/* Top Banner với hình ảnh banner-login.png */}
      <View style={st.bannerWrapper}>
        <Image
          source={EditorialImages.bannerLogin}
          style={st.bannerImage}
          resizeMode="cover"
        />
      </View>

      {/* Drawer kéo vuốt */}
      <View style={st.drawerOverlay}>
        <Animated.View
          style={[
            st.drawerContainer,
            {
              height: drawerHeight,
            },
          ]}
        >
          {/* Thanh vuốt ngăn kéo có PanResponder */}
          <View {...panResponder.panHandlers} style={st.drawerHeaderArea}>
            <View style={st.sheetHandle} />
            <View style={st.dragIndicatorRow}>
              <Ionicons
                name={isExpanded ? "chevron-down" : "chevron-up"}
                size={14}
                color={Colors.textMuted}
              />
              <Text style={st.dragHintText}>
                {isExpanded ? "Vuốt xuống để thu gọn" : "Vuốt lên để xem đầy đủ"}
              </Text>
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={st.drawerScrollContent}
            >
              {/* Thành công notice khi reset password */}
              {!!forgotSuccessNotice && (
                <View style={st.successNotice}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.statusSuccess} />
                  <Text style={st.successNoticeText}>{forgotSuccessNotice}</Text>
                </View>
              )}

              {/* Chế độ Quên Mật Khẩu */}
              {isForgotMode ? (
                <View style={st.formCard}>
                  <View style={st.forgotHeader}>
                    <Pressable
                      style={st.backIconBtn}
                      onPress={() => {
                        setIsForgotMode(false);
                        setForgotStep("request");
                        setError("");
                      }}
                    >
                      <Ionicons name="arrow-back" size={20} color={Colors.primary} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={st.forgotTitle}>
                        {forgotStep === "request" ? "Khôi phục mật khẩu" : "Đặt lại mật khẩu mới"}
                      </Text>
                      <Text style={st.forgotSub}>
                        {forgotStep === "request"
                          ? "Nhập email đăng ký để nhận mã OTP xác minh"
                          : `Nhập mã 6 số gửi đến ${forgotEmail}`}
                      </Text>
                    </View>
                  </View>

                  {forgotStep === "request" ? (
                    <View style={{ gap: 12, marginTop: 10 }}>
                      <View style={st.inputWrapper}>
                        <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Nhập email của bạn"
                          placeholderTextColor={Colors.textMuted}
                          value={forgotEmail}
                          onChangeText={setForgotEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={st.inputControl}
                        />
                      </View>

                      {!!error && <Notice error>{error}</Notice>}

                      <Button
                        title={loading ? "Đang gửi mã..." : "GỬI MÃ XÁC MINH OTP"}
                        disabled={loading}
                        onPress={handleForgotSendOtp}
                        style={{ height: 50, marginTop: 4 }}
                      />

                      <Pressable
                        onPress={() => {
                          setIsForgotMode(false);
                          setError("");
                        }}
                        style={st.backToLoginBtn}
                      >
                        <Text style={st.backToLoginText}>Quay lại Đăng nhập</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ gap: 12, marginTop: 10 }}>
                      <View style={st.inputWrapper}>
                        <Ionicons name="key-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Mã OTP 6 số"
                          placeholderTextColor={Colors.textMuted}
                          value={forgotOtp}
                          onChangeText={setForgotOtp}
                          keyboardType="number-pad"
                          maxLength={6}
                          style={[st.inputControl, { fontFamily: Fonts.mono, letterSpacing: 4 }]}
                        />
                      </View>

                      <View style={st.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Mật khẩu mới (tối thiểu 10 ký tự)"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showForgotNewPassword}
                          value={forgotNewPassword}
                          onChangeText={setForgotNewPassword}
                          style={st.inputControl}
                        />
                        <Pressable
                          onPress={() => setShowForgotNewPassword(!showForgotNewPassword)}
                          style={st.eyeBtn}
                        >
                          <Ionicons
                            name={showForgotNewPassword ? "eye-off-outline" : "eye-outline"}
                            size={18}
                            color={Colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <PasswordMeter value={forgotNewPassword} />

                      <View style={st.inputWrapper}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Xác nhận mật khẩu mới"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showForgotNewPassword}
                          value={forgotConfirmPassword}
                          onChangeText={setForgotConfirmPassword}
                          style={st.inputControl}
                        />
                      </View>

                      {!!error && <Notice error>{error}</Notice>}

                      <Button
                        title={loading ? "Đang cập nhật..." : "XÁC NHẬN ĐỔI MẬT KHẨU"}
                        disabled={loading}
                        onPress={handleForgotResetPassword}
                        style={{ height: 50, marginTop: 4 }}
                      />

                      <Pressable
                        onPress={() => setForgotStep("request")}
                        style={st.backToLoginBtn}
                      >
                        <Text style={st.backToLoginText}>Nhập lại email khác</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                /* Form Đăng nhập & Đăng ký chính */
                <View style={st.formCard}>
                  {/* Segmented Login / Register Switch */}
                  <View style={st.segmentedContainer}>
                    <Pressable
                      onPress={() => handleSelectTab("login")}
                      style={[st.segmentBtn, tab === "login" && st.segmentBtnActive]}
                    >
                      <Text style={[st.segmentText, tab === "login" && st.segmentTextActive]}>
                        Đăng nhập
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSelectTab("register")}
                      style={[st.segmentBtn, tab === "register" && st.segmentBtnActive]}
                    >
                      <Text style={[st.segmentText, tab === "register" && st.segmentTextActive]}>
                        Tạo tài khoản
                      </Text>
                    </Pressable>
                  </View>

                  {tab === "login" ? (
                    /* ===== 1. FORM ĐĂNG NHẬP ===== */
                    <View style={{ gap: 12, marginTop: 14 }}>
                      {/* Input tài khoản: SĐT, email hoặc tên đăng nhập (KHÔNG +84) */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Số điện thoại, email hoặc tên đăng nhập"
                          placeholderTextColor={Colors.textMuted}
                          value={loginIdentifier}
                          onChangeText={setLoginIdentifier}
                          autoCapitalize="none"
                          style={st.inputControl}
                        />
                      </View>

                      {/* Input mật khẩu */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Mật khẩu tài khoản"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showLoginPassword}
                          value={loginPassword}
                          onChangeText={setLoginPassword}
                          style={st.inputControl}
                        />
                        <Pressable
                          onPress={() => setShowLoginPassword(!showLoginPassword)}
                          style={st.eyeBtn}
                        >
                          <Ionicons
                            name={showLoginPassword ? "eye-off-outline" : "eye-outline"}
                            size={18}
                            color={Colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      {/* Nút "Quên mật khẩu?" */}
                      <Pressable
                        onPress={() => {
                          setIsForgotMode(true);
                          setForgotStep("request");
                          setForgotEmail(loginIdentifier.includes("@") ? loginIdentifier : "");
                          setError("");
                        }}
                        style={st.forgotPasswordLink}
                      >
                        <Text style={st.forgotPasswordText}>Quên mật khẩu?</Text>
                      </Pressable>

                      {!!error && <Notice error>{error}</Notice>}

                      <Button
                        title={loading ? "Đang xác thực..." : "ĐĂNG NHẬP VÀO YOFASO"}
                        disabled={loading}
                        onPress={handleLoginSubmit}
                        style={{ height: 52, marginTop: 4 }}
                      />

                      <View style={st.dividerRow}>
                        <View style={st.dividerLine} />
                        <Text style={st.dividerText}>Hoặc tiếp tục trải nghiệm</Text>
                        <View style={st.dividerLine} />
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Vào với tư cách Khách vãng lai"
                        onPress={() => router.replace("/(shop)")}
                        style={st.guestCard}
                      >
                        <Ionicons name="sparkles" size={18} color={Colors.champagneDeep} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.guestTitle}>Vào với tư cách Khách vãng lai</Text>
                          <Text style={st.guestSub}>Khám phá lookbook, thử đồ ảo AI & tạo vé O2O</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : (
                    /* ===== 2. FORM ĐĂNG KÝ ===== */
                    <View style={{ gap: 12, marginTop: 14 }}>
                      {/* 1. Tên đăng nhập */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="at-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Tên đăng nhập (ví dụ: quynhhuong26)"
                          placeholderTextColor={Colors.textMuted}
                          value={regUsername}
                          onChangeText={setRegUsername}
                          autoCapitalize="none"
                          style={st.inputControl}
                        />
                      </View>

                      {/* 2. Họ và tên (ràng buộc không số, không ký tự đặc biệt) */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Họ và tên (chỉ gồm chữ cái và khoảng trắng)"
                          placeholderTextColor={Colors.textMuted}
                          value={regFullName}
                          onChangeText={setRegFullName}
                          style={st.inputControl}
                        />
                      </View>

                      {/* 3. Ngày tháng năm sinh (DateTimePicker) */}
                      <DatePickerField
                        value={regDateOfBirth}
                        onChange={setRegDateOfBirth}
                        placeholder="Chọn ngày tháng năm sinh (DD/MM/YYYY)"
                      />

                      {/* 4. Email */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Địa chỉ email"
                          placeholderTextColor={Colors.textMuted}
                          value={regEmail}
                          onChangeText={setRegEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={st.inputControl}
                        />
                      </View>

                      {/* 5. Số điện thoại (CÓ +84 BÊN ĐĂNG KÝ) */}
                      <View style={st.phoneRow}>
                        <View style={st.flagPrefix}>
                          <Text style={{ fontSize: 14 }}>🇻🇳</Text>
                          <Text style={st.prefixText}>+84</Text>
                        </View>
                        <TextInput
                          placeholder="Số điện thoại di động"
                          placeholderTextColor={Colors.textMuted}
                          value={regPhone}
                          keyboardType="phone-pad"
                          onChangeText={setRegPhone}
                          style={[st.inputControl, { flex: 1 }]}
                        />
                      </View>

                      {/* 6. Mật khẩu */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Mật khẩu (ít nhất 10 ký tự, có chữ & số)"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showRegPassword}
                          value={regPassword}
                          onChangeText={setRegPassword}
                          style={st.inputControl}
                        />
                        <Pressable
                          onPress={() => setShowRegPassword(!showRegPassword)}
                          style={st.eyeBtn}
                        >
                          <Ionicons
                            name={showRegPassword ? "eye-off-outline" : "eye-outline"}
                            size={18}
                            color={Colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <PasswordMeter value={regPassword} />

                      {/* 7. Xác nhận mật khẩu */}
                      <View style={st.inputWrapper}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} style={st.inputIcon} />
                        <TextInput
                          placeholder="Xác nhận lại mật khẩu"
                          placeholderTextColor={Colors.textMuted}
                          secureTextEntry={!showRegConfirmPassword}
                          value={regConfirmPassword}
                          onChangeText={setRegConfirmPassword}
                          style={st.inputControl}
                        />
                        <Pressable
                          onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                          style={st.eyeBtn}
                        >
                          <Ionicons
                            name={showRegConfirmPassword ? "eye-off-outline" : "eye-outline"}
                            size={18}
                            color={Colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      {!!error && <Notice error>{error}</Notice>}

                      <Button
                        title={loading ? "Đang tạo tài khoản..." : "TẠO TÀI KHOẢN YOFASO"}
                        disabled={loading}
                        onPress={handleRegisterSubmit}
                        style={{ height: 52, marginTop: 4 }}
                      />

                      <View style={st.dividerRow}>
                        <View style={st.dividerLine} />
                        <Text style={st.dividerText}>Hoặc tiếp tục trải nghiệm</Text>
                        <View style={st.dividerLine} />
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Vào với tư cách Khách vãng lai"
                        onPress={() => router.replace("/(shop)")}
                        style={st.guestCard}
                      >
                        <Ionicons name="sparkles" size={18} color={Colors.champagneDeep} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.guestTitle}>Vào với tư cách Khách vãng lai</Text>
                          <Text style={st.guestSub}>Khám phá lookbook, thử đồ ảo AI & tạo vé O2O</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EDE4",
  },
  bannerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Math.round(SCREEN_HEIGHT * 0.42),
    overflow: "hidden",
    backgroundColor: "#F5EDE4",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  drawerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...Shadows.sheet,
  },
  drawerHeaderArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
  },
  sheetHandle: {
    width: 44,
    height: 4.5,
    backgroundColor: Colors.borderHairline,
    borderRadius: 3,
  },
  dragIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  dragHintText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },
  drawerScrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 36,
  },
  formCard: {
    paddingTop: 4,
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: Colors.canvas,
    borderRadius: Radii.full,
    padding: 3,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: Radii.full,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  segmentText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.canvas,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputControl: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
    height: "100%",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  flagPrefix: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    height: 52,
    gap: 6,
  },
  prefixText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.primary,
  },
  eyeBtn: {
    padding: 6,
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.champagneDeep,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderHairline,
  },
  dividerText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
  },
  guestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radii.md,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  guestTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  guestSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  forgotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  backIconBtn: {
    padding: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.canvas,
  },
  forgotTitle: {
    fontFamily: "Editorial",
    fontSize: 18,
    color: Colors.primary,
  },
  forgotSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  backToLoginBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 2,
  },
  backToLoginText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  successNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.statusSuccessSubtle,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 12,
    borderRadius: Radii.sm,
    marginBottom: 12,
  },
  successNoticeText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.statusSuccess,
  },
});
