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

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <View style={st.fieldGroup}>
      <View style={st.labelRow}>
        <Text style={st.labelText}>{label}</Text>
        {required && <Text style={st.requiredStar}> *</Text>}
      </View>
      {children}
      {!!error && (
        <View style={st.fieldErrorRow}>
          <Ionicons name="alert-circle" size={13} color={Colors.statusDanger} />
          <Text style={st.fieldErrorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

export default function AuthScreen() {
  const { setUser } = useSession();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");

  // Login inputs (Không cần +84, cho phép email / SĐT / username)
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  // Register inputs
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regDateOfBirth, setRegDateOfBirth] = useState("");
  const [regGender, setRegGender] = useState<"NAM" | "NU" | "KHAC">("NU");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Forgot password inputs
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotRequestId, setForgotRequestId] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState("");
  const [forgotErrors, setForgotErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

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
    setGeneralError("");
    setLoginErrors({});
    setRegErrors({});
    setIsForgotMode(false);
    if (selectedTab === "register") {
      animateDrawer(DRAWER_MAX_HEIGHT);
      setIsExpanded(true);
      currentHeight.current = DRAWER_MAX_HEIGHT;
    }
  };

  // Xử lý Đăng nhập
  const handleLoginSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!loginIdentifier.trim()) {
      errors.identifier = "Vui lòng nhập số điện thoại, email hoặc tên đăng nhập.";
    }
    if (!loginPassword) {
      errors.password = "Vui lòng nhập mật khẩu tài khoản.";
    } else if (loginPassword.length < 6) {
      errors.password = "Mật khẩu tài khoản tối thiểu 6 ký tự.";
    }

    setLoginErrors(errors);
    setGeneralError("");
    if (Object.keys(errors).length > 0) return;

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
      const msg = e.message || "Tên đăng nhập hoặc mật khẩu không chính xác.";
      setLoginErrors({
        password: msg,
      });
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Đăng ký
  const handleRegisterSubmit = async () => {
    const errors: Record<string, string> = {};

    // 1. Tên đăng nhập *
    const cleanUsername = regUsername.trim();
    if (!cleanUsername) {
      errors.username = "Vui lòng nhập tên đăng nhập.";
    } else if (cleanUsername.length < 4 || cleanUsername.length > 15) {
      errors.username = "Tên đăng nhập từ 4 đến 15 ký tự (chữ cái đầu, không dấu).";
    } else if (!/^[A-Za-z][A-Za-z0-9]{3,14}$/.test(cleanUsername)) {
      errors.username = "Tên đăng nhập phải bắt đầu bằng chữ cái và chỉ gồm chữ hoặc số.";
    }

    // 2. Họ và tên *
    const cleanName = regFullName.trim();
    if (!cleanName) {
      errors.fullName = "Vui lòng nhập họ và tên của bạn.";
    } else if (cleanName.length < 2) {
      errors.fullName = "Họ và tên tối thiểu 2 ký tự.";
    } else if (!VIETNAMESE_NAME_REGEX.test(cleanName)) {
      errors.fullName = "Họ và tên chỉ được chứa chữ cái và khoảng trắng, không chứa số hoặc ký tự đặc biệt.";
    }

    // 3. Ngày tháng năm sinh (Không bắt buộc theo yêu cầu 3)
    // Nếu có chọn thì không cần check bắt buộc, chỉ validate format nếu có
    if (regDateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(regDateOfBirth)) {
      errors.dateOfBirth = "Định dạng ngày sinh không hợp lệ.";
    }

    // 4. Giới tính *
    if (!regGender) {
      errors.gender = "Vui lòng chọn giới tính.";
    }

    // 5. Email *
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/.+@.+\..+/.test(cleanEmail)) {
      errors.email = "Vui lòng nhập địa chỉ email hợp lệ (ví dụ: name@domain.com).";
    }

    // 6. Số điện thoại *
    const phoneDigits = regPhone.replace(/\D/g, "");
    if (!phoneDigits) {
      errors.phone = "Vui lòng nhập số điện thoại.";
    } else if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      errors.phone = "Số điện thoại di động gồm 9 đến 11 chữ số.";
    }
    const finalPhone = phoneDigits.startsWith("0") ? phoneDigits : `0${phoneDigits}`;

    // 7. Mật khẩu *
    if (!regPassword) {
      errors.password = "Vui lòng nhập mật khẩu.";
    } else if (regPassword.length < 10) {
      errors.password = "Mật khẩu bảo mật cần có ít nhất 10 ký tự, gồm cả chữ và số.";
    } else if (!/[A-Za-z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
      errors.password = "Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.";
    }

    // 8. Xác nhận mật khẩu *
    if (!regConfirmPassword) {
      errors.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
    } else if (regPassword !== regConfirmPassword) {
      errors.confirmPassword = "Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại.";
    }

    setRegErrors(errors);
    setGeneralError("");
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const u = await login(
        {
          username: cleanUsername,
          fullName: cleanName,
          dateOfBirth: regDateOfBirth || undefined,
          gender: regGender,
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
      const msg = e.message || "Không thể đăng ký tài khoản. Vui lòng kiểm tra lại thông tin.";
      const lower = msg.toLowerCase();
      if (lower.includes("tên đăng nhập") || lower.includes("username")) {
        setRegErrors({ username: msg });
      } else if (lower.includes("email")) {
        setRegErrors({ email: msg });
      } else if (lower.includes("số điện thoại") || lower.includes("phone")) {
        setRegErrors({ phone: msg });
      } else {
        setGeneralError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Quên mật khẩu: Gửi OTP
  const handleForgotSendOtp = async () => {
    const errors: Record<string, string> = {};
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      errors.email = "Vui lòng nhập email đăng ký tài khoản.";
    } else if (!/.+@.+\..+/.test(cleanEmail)) {
      errors.email = "Địa chỉ email không hợp lệ.";
    }
    setForgotErrors(errors);
    setGeneralError("");
    if (Object.keys(errors).length > 0) return;

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
      setForgotErrors({ email: e.message || "Không thể gửi mã xác minh OTP. Vui lòng thử lại sau." });
    } finally {
      setLoading(false);
    }
  };

  // Quên mật khẩu: Xác nhận OTP và đặt mật khẩu mới
  const handleForgotResetPassword = async () => {
    const errors: Record<string, string> = {};
    if (!forgotOtp.trim()) {
      errors.otp = "Vui lòng nhập mã OTP 6 số đã nhận qua email.";
    }
    if (!forgotNewPassword) {
      errors.newPassword = "Vui lòng nhập mật khẩu mới.";
    } else if (forgotNewPassword.length < 10) {
      errors.newPassword = "Mật khẩu mới tối thiểu 10 ký tự, có cả chữ và số.";
    }
    if (!forgotConfirmPassword) {
      errors.confirmPassword = "Vui lòng xác nhận mật khẩu mới.";
    } else if (forgotNewPassword !== forgotConfirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    setForgotErrors(errors);
    setGeneralError("");
    if (Object.keys(errors).length > 0) return;

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
      setGeneralError(e.message || "Xác nhận mã OTP thất bại hoặc mã đã hết hạn.");
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

              {/* Thông báo lỗi tổng quát nếu có */}
              {!!generalError && (
                <View style={{ marginBottom: 12 }}>
                  <Notice error>{generalError}</Notice>
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
                        setGeneralError("");
                        setForgotErrors({});
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
                    <View style={{ marginTop: 10 }}>
                      <FormField
                        label="Địa chỉ email tài khoản"
                        required
                        error={forgotErrors.email}
                      >
                        <View style={[st.inputWrapper, !!forgotErrors.email && st.inputWrapperError]}>
                          <Ionicons
                            name="mail-outline"
                            size={18}
                            color={forgotErrors.email ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Nhập email đã đăng ký của bạn"
                            placeholderTextColor={Colors.textMuted}
                            value={forgotEmail}
                            onChangeText={(val) => {
                              setForgotEmail(val);
                              if (forgotErrors.email) setForgotErrors((p) => ({ ...p, email: "" }));
                            }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={st.inputControl}
                          />
                          {!!forgotEmail && (
                            <Pressable
                              onPress={() => {
                                setForgotEmail("");
                                if (forgotErrors.email) setForgotErrors((p) => ({ ...p, email: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      <Button
                        title={loading ? "Đang gửi mã..." : "GỬI MÃ XÁC MINH OTP"}
                        disabled={loading}
                        onPress={handleForgotSendOtp}
                        style={{ height: 50, marginTop: 8 }}
                      />

                      <Pressable
                        onPress={() => {
                          setIsForgotMode(false);
                          setGeneralError("");
                          setForgotErrors({});
                        }}
                        style={st.backToLoginBtn}
                      >
                        <Text style={st.backToLoginText}>Quay lại Đăng nhập</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ marginTop: 10 }}>
                      <FormField
                        label="Mã xác thực OTP (6 số)"
                        required
                        error={forgotErrors.otp}
                      >
                        <View style={[st.inputWrapper, !!forgotErrors.otp && st.inputWrapperError]}>
                          <Ionicons
                            name="key-outline"
                            size={18}
                            color={forgotErrors.otp ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Mã OTP 6 số"
                            placeholderTextColor={Colors.textMuted}
                            value={forgotOtp}
                            onChangeText={(val) => {
                              setForgotOtp(val);
                              if (forgotErrors.otp) setForgotErrors((p) => ({ ...p, otp: "" }));
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                            style={[st.inputControl, { fontFamily: Fonts.mono, letterSpacing: 4 }]}
                          />
                          {!!forgotOtp && (
                            <Pressable
                              onPress={() => {
                                setForgotOtp("");
                                if (forgotErrors.otp) setForgotErrors((p) => ({ ...p, otp: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      <FormField
                        label="Mật khẩu mới"
                        required
                        error={forgotErrors.newPassword}
                      >
                        <View style={[st.inputWrapper, !!forgotErrors.newPassword && st.inputWrapperError]}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={forgotErrors.newPassword ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Mật khẩu mới (tối thiểu 10 ký tự)"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showForgotNewPassword}
                            value={forgotNewPassword}
                            onChangeText={(val) => {
                              setForgotNewPassword(val);
                              if (forgotErrors.newPassword) setForgotErrors((p) => ({ ...p, newPassword: "" }));
                            }}
                            style={st.inputControl}
                          />
                          <Pressable
                            onPress={() => setShowForgotNewPassword(!showForgotNewPassword)}
                            hitSlop={8}
                            style={st.eyeBtn}
                          >
                            <Ionicons
                              name={showForgotNewPassword ? "eye-off-outline" : "eye-outline"}
                              size={18}
                              color={Colors.textMuted}
                            />
                          </Pressable>
                        </View>
                        <View style={{ marginTop: 6 }}>
                          <PasswordMeter value={forgotNewPassword} />
                        </View>
                      </FormField>

                      <FormField
                        label="Xác nhận mật khẩu mới"
                        required
                        error={forgotErrors.confirmPassword}
                      >
                        <View style={[st.inputWrapper, !!forgotErrors.confirmPassword && st.inputWrapperError]}>
                          <Ionicons
                            name="shield-checkmark-outline"
                            size={18}
                            color={forgotErrors.confirmPassword ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Xác nhận lại mật khẩu mới"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showForgotNewPassword}
                            value={forgotConfirmPassword}
                            onChangeText={(val) => {
                              setForgotConfirmPassword(val);
                              if (forgotErrors.confirmPassword) setForgotErrors((p) => ({ ...p, confirmPassword: "" }));
                            }}
                            style={st.inputControl}
                          />
                        </View>
                      </FormField>

                      <Button
                        title={loading ? "Đang cập nhật..." : "XÁC NHẬN ĐỔI MẬT KHẨU"}
                        disabled={loading}
                        onPress={handleForgotResetPassword}
                        style={{ height: 50, marginTop: 8 }}
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
                    <View style={{ marginTop: 12 }}>
                      {/* Input tài khoản: SĐT, email hoặc tên đăng nhập */}
                      <FormField
                        label="Số điện thoại, email hoặc tên đăng nhập"
                        required
                        error={loginErrors.identifier}
                      >
                        <View style={[st.inputWrapper, !!loginErrors.identifier && st.inputWrapperError]}>
                          <Ionicons
                            name="person-outline"
                            size={18}
                            color={loginErrors.identifier ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Nhập SĐT, email hoặc username"
                            placeholderTextColor={Colors.textMuted}
                            value={loginIdentifier}
                            onChangeText={(val) => {
                              setLoginIdentifier(val);
                              if (loginErrors.identifier) setLoginErrors((p) => ({ ...p, identifier: "" }));
                            }}
                            autoCapitalize="none"
                            style={st.inputControl}
                          />
                          {!!loginIdentifier && (
                            <Pressable
                              onPress={() => {
                                setLoginIdentifier("");
                                if (loginErrors.identifier) setLoginErrors((p) => ({ ...p, identifier: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      {/* Input mật khẩu */}
                      <FormField
                        label="Mật khẩu tài khoản"
                        required
                        error={loginErrors.password}
                      >
                        <View style={[st.inputWrapper, !!loginErrors.password && st.inputWrapperError]}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={loginErrors.password ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Mật khẩu tài khoản của bạn"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showLoginPassword}
                            value={loginPassword}
                            onChangeText={(val) => {
                              setLoginPassword(val);
                              if (loginErrors.password) setLoginErrors((p) => ({ ...p, password: "" }));
                            }}
                            style={st.inputControl}
                          />
                          <Pressable
                            onPress={() => setShowLoginPassword(!showLoginPassword)}
                            hitSlop={8}
                            style={st.eyeBtn}
                          >
                            <Ionicons
                              name={showLoginPassword ? "eye-off-outline" : "eye-outline"}
                              size={18}
                              color={Colors.textMuted}
                            />
                          </Pressable>
                        </View>
                      </FormField>

                      {/* Nút "Quên mật khẩu?" */}
                      <Pressable
                        onPress={() => {
                          setIsForgotMode(true);
                          setForgotStep("request");
                          setForgotEmail(loginIdentifier.includes("@") ? loginIdentifier : "");
                          setGeneralError("");
                          setForgotErrors({});
                        }}
                        style={st.forgotPasswordLink}
                      >
                        <Text style={st.forgotPasswordText}>Quên mật khẩu?</Text>
                      </Pressable>

                      <Button
                        title={loading ? "Đang xác thực..." : "ĐĂNG NHẬP VÀO YOFASO"}
                        disabled={loading}
                        onPress={handleLoginSubmit}
                        style={{ height: 52, marginTop: 10 }}
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
                    <View style={{ marginTop: 12 }}>
                      {/* 1. Tên đăng nhập * */}
                      <FormField
                        label="Tên đăng nhập"
                        required
                        error={regErrors.username}
                      >
                        <View style={[st.inputWrapper, !!regErrors.username && st.inputWrapperError]}>
                          <Ionicons
                            name="at-outline"
                            size={18}
                            color={regErrors.username ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Ví dụ: quynhhuong26"
                            placeholderTextColor={Colors.textMuted}
                            value={regUsername}
                            onChangeText={(val) => {
                              setRegUsername(val);
                              if (regErrors.username) setRegErrors((p) => ({ ...p, username: "" }));
                            }}
                            autoCapitalize="none"
                            style={st.inputControl}
                          />
                          {!!regUsername && (
                            <Pressable
                              onPress={() => {
                                setRegUsername("");
                                if (regErrors.username) setRegErrors((p) => ({ ...p, username: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      {/* 2. Họ và tên * */}
                      <FormField
                        label="Họ và tên"
                        required
                        error={regErrors.fullName}
                      >
                        <View style={[st.inputWrapper, !!regErrors.fullName && st.inputWrapperError]}>
                          <Ionicons
                            name="person-outline"
                            size={18}
                            color={regErrors.fullName ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Ví dụ: Nguyễn Quỳnh Hương"
                            placeholderTextColor={Colors.textMuted}
                            value={regFullName}
                            onChangeText={(val) => {
                              setRegFullName(val);
                              if (regErrors.fullName) setRegErrors((p) => ({ ...p, fullName: "" }));
                            }}
                            style={st.inputControl}
                          />
                          {!!regFullName && (
                            <Pressable
                              onPress={() => {
                                setRegFullName("");
                                if (regErrors.fullName) setRegErrors((p) => ({ ...p, fullName: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      {/* 3. Ngày tháng năm sinh (Không bắt buộc theo yêu cầu 3) */}
                      <FormField
                        label="Ngày tháng năm sinh (Tùy chọn)"
                        required={false}
                        error={regErrors.dateOfBirth}
                      >
                        <DatePickerField
                          value={regDateOfBirth}
                          onChange={(val) => {
                            setRegDateOfBirth(val);
                            if (regErrors.dateOfBirth) setRegErrors((p) => ({ ...p, dateOfBirth: "" }));
                          }}
                          placeholder="Chọn ngày tháng năm sinh (DD/MM/YYYY)"
                          error={regErrors.dateOfBirth}
                        />
                      </FormField>

                      {/* 4. Giới tính * (Bổ sung ngay dưới ngày sinh theo yêu cầu 2) */}
                      <FormField
                        label="Giới tính"
                        required
                        error={regErrors.gender}
                      >
                        <View style={st.genderSelectorRow}>
                          {[
                            { value: "NAM" as const, label: "Nam", icon: "male" as const },
                            { value: "NU" as const, label: "Nữ", icon: "female" as const },
                            { value: "KHAC" as const, label: "Khác", icon: "transgender-outline" as const },
                          ].map((item) => {
                            const isSelected = regGender === item.value;
                            return (
                              <Pressable
                                key={item.value}
                                onPress={() => {
                                  setRegGender(item.value);
                                  if (regErrors.gender) setRegErrors((p) => ({ ...p, gender: "" }));
                                }}
                                style={[
                                  st.genderChip,
                                  isSelected && st.genderChipActive,
                                  !!regErrors.gender && st.genderChipError,
                                ]}
                              >
                                <Ionicons
                                  name={item.icon}
                                  size={16}
                                  color={isSelected ? "#FFFFFF" : Colors.primary}
                                />
                                <Text
                                  style={[
                                    st.genderChipText,
                                    isSelected && st.genderChipTextActive,
                                  ]}
                                >
                                  {item.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </FormField>

                      {/* 5. Địa chỉ Email * */}
                      <FormField
                        label="Địa chỉ email"
                        required
                        error={regErrors.email}
                      >
                        <View style={[st.inputWrapper, !!regErrors.email && st.inputWrapperError]}>
                          <Ionicons
                            name="mail-outline"
                            size={18}
                            color={regErrors.email ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Ví dụ: example@mail.com"
                            placeholderTextColor={Colors.textMuted}
                            value={regEmail}
                            onChangeText={(val) => {
                              setRegEmail(val);
                              if (regErrors.email) setRegErrors((p) => ({ ...p, email: "" }));
                            }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={st.inputControl}
                          />
                          {!!regEmail && (
                            <Pressable
                              onPress={() => {
                                setRegEmail("");
                                if (regErrors.email) setRegErrors((p) => ({ ...p, email: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      {/* 6. Số điện thoại di động * */}
                      <FormField
                        label="Số điện thoại di động"
                        required
                        error={regErrors.phone}
                      >
                        <View style={[st.phoneRow, !!regErrors.phone && st.inputWrapperError]}>
                          <View style={st.flagPrefix}>
                            <Text style={{ fontSize: 14 }}>🇻🇳</Text>
                            <Text style={st.prefixText}>+84</Text>
                          </View>
                          <TextInput
                            placeholder="9 đến 11 chữ số"
                            placeholderTextColor={Colors.textMuted}
                            value={regPhone}
                            keyboardType="phone-pad"
                            onChangeText={(val) => {
                              setRegPhone(val);
                              if (regErrors.phone) setRegErrors((p) => ({ ...p, phone: "" }));
                            }}
                            style={[st.inputControl, { flex: 1 }]}
                          />
                          {!!regPhone && (
                            <Pressable
                              onPress={() => {
                                setRegPhone("");
                                if (regErrors.phone) setRegErrors((p) => ({ ...p, phone: "" }));
                              }}
                              hitSlop={8}
                              style={st.clearBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      </FormField>

                      {/* 7. Mật khẩu bảo mật * */}
                      <FormField
                        label="Mật khẩu bảo mật"
                        required
                        error={regErrors.password}
                      >
                        <View style={[st.inputWrapper, !!regErrors.password && st.inputWrapperError]}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={regErrors.password ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Ít nhất 10 ký tự, gồm cả chữ & số"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showRegPassword}
                            value={regPassword}
                            onChangeText={(val) => {
                              setRegPassword(val);
                              if (regErrors.password) setRegErrors((p) => ({ ...p, password: "" }));
                            }}
                            style={st.inputControl}
                          />
                          <Pressable
                            onPress={() => setShowRegPassword(!showRegPassword)}
                            hitSlop={8}
                            style={st.eyeBtn}
                          >
                            <Ionicons
                              name={showRegPassword ? "eye-off-outline" : "eye-outline"}
                              size={18}
                              color={Colors.textMuted}
                            />
                          </Pressable>
                        </View>
                        <View style={{ marginTop: 6 }}>
                          <PasswordMeter value={regPassword} />
                        </View>
                      </FormField>

                      {/* 8. Xác nhận mật khẩu * */}
                      <FormField
                        label="Xác nhận mật khẩu"
                        required
                        error={regErrors.confirmPassword}
                      >
                        <View style={[st.inputWrapper, !!regErrors.confirmPassword && st.inputWrapperError]}>
                          <Ionicons
                            name="shield-checkmark-outline"
                            size={18}
                            color={regErrors.confirmPassword ? Colors.statusDanger : Colors.textMuted}
                            style={st.inputIcon}
                          />
                          <TextInput
                            placeholder="Nhập lại mật khẩu vừa tạo"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showRegConfirmPassword}
                            value={regConfirmPassword}
                            onChangeText={(val) => {
                              setRegConfirmPassword(val);
                              if (regErrors.confirmPassword) setRegErrors((p) => ({ ...p, confirmPassword: "" }));
                            }}
                            style={st.inputControl}
                          />
                          <Pressable
                            onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            hitSlop={8}
                            style={st.eyeBtn}
                          >
                            <Ionicons
                              name={showRegConfirmPassword ? "eye-off-outline" : "eye-outline"}
                              size={18}
                              color={Colors.textMuted}
                            />
                          </Pressable>
                        </View>
                      </FormField>

                      <Button
                        title={loading ? "Đang tạo tài khoản..." : "TẠO TÀI KHOẢN YOFASO"}
                        disabled={loading}
                        onPress={handleRegisterSubmit}
                        style={{ height: 52, marginTop: 10 }}
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
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  labelText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  requiredStar: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.statusDanger,
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
    gap: 8,
  },
  inputWrapperError: {
    borderColor: Colors.statusDanger,
  },
  inputIcon: {
    marginRight: 2,
  },
  inputControl: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
    height: "100%",
  },
  clearBtn: {
    padding: 4,
  },
  eyeBtn: {
    padding: 6,
  },
  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  fieldErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.statusDanger,
    flex: 1,
  },
  genderSelectorRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  genderChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderChipError: {
    borderColor: Colors.statusDanger,
  },
  genderChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  genderChipTextActive: {
    color: "#FFFFFF",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    height: 52,
    gap: 8,
  },
  flagPrefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.borderHairline,
  },
  prefixText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.primary,
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: -4,
    marginBottom: 4,
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
