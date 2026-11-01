import { useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { strength } from "@/lib/validation";
import { noteActivity } from "@/lib/api";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";

export const colors = {
  canvas: Colors.canvas,
  surface: Colors.surface,
  surfaceMuted: Colors.surfaceMuted,
  primary: Colors.primary,
  primaryHover: Colors.primaryHover,
  muted: Colors.textSecondary,
  textSecondary: Colors.textSecondary,
  textMuted: Colors.textMuted,
  border: Colors.borderHairline,
  hairline: Colors.hairline,
  accent: Colors.champagne,
  champagne: Colors.champagne,
  champagneDeep: Colors.champagneDeep,
  champagneSubtle: Colors.champagneSubtle,
  danger: Colors.statusDanger,
  dangerSubtle: Colors.statusDangerSubtle,
  success: Colors.statusSuccess,
  successSubtle: Colors.statusSuccessSubtle,
  warning: Colors.statusWarning,
  warningSubtle: Colors.statusWarningSubtle,
  info: Colors.statusInfo,
  infoSubtle: Colors.statusInfoSubtle,
};

export function Logo({
  size = "md",
  style,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  style?: ViewStyle | TextStyle | any;
}) {
  const dims = {
    sm: { width: 100, height: 42 },
    md: { width: 140, height: 56 },
    lg: { width: 180, height: 72 },
    xl: { width: 250, height: 100 },
    "2xl": { width: 300, height: 120 },
    "3xl": { width: 450, height: 150 },
  }[size];

  return (
    <Image
      source={require("../../../assets/brand/logo.png")}
      accessibilityLabel="YoFaSo Shop"
      resizeMode="contain"
      style={[dims, style]}
    />
  );
}

export function Button({
  title,
  onPress,
  secondary,
  accent,
  outline,
  danger,
  disabled,
  icon,
  style,
  textStyle,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  accent?: boolean;
  outline?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        secondary && s.buttonSecondary,
        accent && s.buttonAccent,
        outline && s.buttonOutline,
        danger && s.buttonDanger,
        style,
        {
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {icon}
        <Text
          style={[
            s.buttonText,
            secondary && { color: colors.primary },
            accent && { color: colors.primary, fontFamily: "JakartaSemiBold" },
            outline && { color: colors.primary },
            danger && { color: "#FFFFFF" },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  password = false,
  containerStyle,
  prefix,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  password?: boolean;
  containerStyle?: ViewStyle;
  prefix?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[s.field, containerStyle]}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[
          s.inputContainer,
          focused && { borderColor: colors.champagne, borderWidth: 1.5 },
          !!error && { borderColor: colors.danger },
        ]}
      >
        {prefix}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#94A3B8"
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          onChangeText={(text) => {
            noteActivity();
            props.onChangeText?.(text);
          }}
          secureTextEntry={password ? !visible : props.secureTextEntry}
          style={[s.input, props.style]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Ẩn" : "Hiện"} mật khẩu`}
            accessibilityState={{ selected: visible }}
            onPress={() => setVisible(!visible)}
            style={s.eyeButton}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function PasswordMeter({ value }: { value: string }) {
  const label = strength(value);
  const level = value ? ["Yếu", "Trung bình", "Tốt", "Mạnh"].indexOf(label) + 1 : 0;
  const color = ["#94A3B8", "#DC2626", "#D97706", "#059669", "#059669"][level];

  return (
    <View
      style={{ gap: 6, marginBottom: 8 }}
      accessibilityLabel={`Độ mạnh mật khẩu: ${value ? label : "Chưa nhập"}`}
    >
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 3,
              backgroundColor: i <= level ? color : colors.border,
            }}
          />
        ))}
      </View>
      <Text style={{ color, fontSize: 12, fontFamily: "Jakarta" }}>
        Độ mạnh: {value ? label : "Chưa nhập"}
      </Text>
    </View>
  );
}

export function Notice({
  children,
  error = false,
  success = false,
  warning = false,
  style,
}: {
  children: ReactNode;
  error?: boolean;
  success?: boolean;
  warning?: boolean;
  style?: ViewStyle;
}) {
  const bg = error
    ? colors.dangerSubtle
    : success
    ? colors.successSubtle
    : warning
    ? colors.warningSubtle
    : colors.champagneSubtle;

  const border = error
    ? "rgba(220, 38, 38, 0.25)"
    : success
    ? "rgba(5, 150, 105, 0.25)"
    : warning
    ? "rgba(217, 119, 6, 0.25)"
    : "rgba(197, 168, 128, 0.35)";

  const textColor = error
    ? colors.danger
    : success
    ? colors.success
    : warning
    ? colors.warning
    : colors.primary;

  return (
    <View style={[s.noticeBox, { backgroundColor: bg, borderColor: border }, style]}>
      <Text
        accessibilityRole={error ? "alert" : undefined}
        style={[s.noticeText, { color: textColor }]}
      >
        {children}
      </Text>
    </View>
  );
}

export function Badge({
  text,
  icon,
  tone = "gold",
}: {
  text: string;
  icon?: ReactNode;
  tone?: "gold" | "dark" | "success" | "warning" | "muted";
}) {
  const bg = {
    gold: colors.champagneSubtle,
    dark: colors.primary,
    success: colors.successSubtle,
    warning: colors.warningSubtle,
    muted: colors.surfaceMuted,
  }[tone];

  const color = {
    gold: colors.champagneDeep,
    dark: "#FFFFFF",
    success: colors.success,
    warning: colors.warning,
    muted: colors.textSecondary,
  }[tone];

  const border = {
    gold: "rgba(197, 168, 128, 0.4)",
    dark: "transparent",
    success: "rgba(5, 150, 105, 0.25)",
    warning: "rgba(217, 119, 6, 0.25)",
    muted: colors.border,
  }[tone];

  return (
    <View style={[s.badge, { backgroundColor: bg, borderColor: border }]}>
      {icon}
      <Text style={[s.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={s.safe}>
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.content, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Heading({
  children,
  small = false,
  serif = true,
  style,
}: {
  children: ReactNode;
  small?: boolean;
  serif?: boolean;
  style?: TextStyle;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        small ? s.subheading : s.heading,
        serif && { fontFamily: "Editorial" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.panel, style]}>{children}</View>;
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <Pressable style={s.modalBackdrop} onPress={onClose} />
        <View style={s.sheetContent}>
          <View style={s.sheetHandle} />
          {title ? (
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={onClose}
                style={s.closeButton}
              >
                <Ionicons name="close" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function EmptyState({
  title,
  body,
  cta,
  onCta,
  icon,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
  icon?: ReactNode;
}) {
  return (
    <View style={s.emptyState}>
      <View style={s.emptyIconCircle}>
        {icon || <Ionicons name="shirt-outline" size={36} color={colors.champagneDeep} />}
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {cta && onCta && (
        <Button title={cta} onPress={onCta} accent style={{ marginTop: 12, minWidth: 200 }} />
      )}
    </View>
  );
}

export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  retry?: () => void;
}) {
  if (loading)
    return (
      <View accessibilityLabel="Đang tải" style={{ gap: 14, padding: 20 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 72,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        ))}
      </View>
    );

  if (error)
    return (
      <View style={{ gap: 10, paddingVertical: 12 }}>
        <Notice error>{error}</Notice>
        {retry && <Button title="Thử lại" secondary onPress={retry} />}
      </View>
    );

  if (empty)
    return (
      <EmptyState
        title="Chưa có dữ liệu"
        body="Nội dung sẽ tự động cập nhật khi có thông tin mới từ hệ thống."
      />
    );

  return null;
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  content: { padding: 20, gap: 16, paddingBottom: 50 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  buttonSecondary: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  buttonAccent: {
    backgroundColor: Colors.champagne,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  buttonDanger: {
    backgroundColor: Colors.statusDanger,
  },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: "JakartaSemiBold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  field: { gap: 6, marginVertical: 6 },
  label: {
    fontSize: 13,
    fontFamily: "JakartaSemiBold",
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: {
    flex: 1,
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Jakarta",
    paddingVertical: 12,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: Colors.statusDanger,
    fontSize: 12,
    fontFamily: "Jakarta",
    marginTop: 2,
  },
  noticeBox: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Jakarta",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Mono",
    letterSpacing: 0.2,
  },
  heading: {
    fontSize: 26,
    fontFamily: "Editorial",
    color: Colors.primary,
    letterSpacing: -0.4,
    marginVertical: 4,
  },
  subheading: {
    fontSize: 18,
    fontFamily: "JakartaSemiBold",
    color: Colors.primary,
    letterSpacing: -0.3,
    marginVertical: 4,
  },
  panel: {
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    gap: 10,
    ...Shadows.dock,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  money: {
    color: Colors.primary,
    fontSize: 17,
    fontFamily: "Mono",
    fontVariant: ["tabular-nums"],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 10,
    ...Shadows.sheet,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderHairline,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontFamily: "Editorial",
    color: Colors.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Editorial",
    color: Colors.primary,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: "Jakarta",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
});
