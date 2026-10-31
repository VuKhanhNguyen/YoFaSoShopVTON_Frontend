import { type ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  canvas: "#FAFAF9",
  surface: "#FFFFFF",
  primary: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  accent: "#C5A880",
  danger: "#B91C1C",
};
export function Logo() {
  return (
    <Image
      source={require("../../../assets/brand/logo.png")}
      accessibilityLabel="YoFaSo Shop"
      resizeMode="contain"
      style={{ width: 136, height: 64 }}
    />
  );
}
export function Button({
  title,
  onPress,
  secondary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.primary }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#64748B"
        {...props}
        style={[
          s.input,
          props.style,
          !!error && { borderColor: colors.danger },
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      style={[s.notice, error && s.error]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
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
            contentContainerStyle={s.content}
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
}: {
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <Text accessibilityRole="header" style={small ? s.subheading : s.heading}>
      {children}
    </Text>
  );
}
export function Panel({ children }: { children: ReactNode }) {
  return <View style={s.panel}>{children}</View>;
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
      <View accessibilityLabel="Đang tải" style={{ gap: 12, padding: 24 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ height: 64, backgroundColor: "#E2E8F0", borderRadius: 10 }}
          />
        ))}
      </View>
    );
  if (error)
    return (
      <View>
        <Notice error>{error}</Notice>
        {retry && <Button title="Thử lại" secondary onPress={retry} />}
      </View>
    );
  if (empty)
    return (
      <Panel>
        <Heading small>Chưa có dữ liệu</Heading>
        <Notice>Nội dung sẽ xuất hiện tại đây khi có cập nhật.</Notice>
      </Panel>
    );
  return null;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 24, gap: 16, paddingBottom: 40 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  secondary: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  field: { gap: 8, marginVertical: 6 },
  label: {
    fontSize: 14,
    fontFamily: "JakartaSemiBold",
    fontWeight: "600",
    color: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    minHeight: 52,
    backgroundColor: colors.surface,
    color: colors.primary,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  notice: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 8,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Editorial",
    fontWeight: "700",
    color: colors.primary,
    marginVertical: 8,
  },
  subheading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
    marginVertical: 8,
  },
  panel: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  money: {
    color: colors.primary,
    fontSize: 17,
    fontFamily: "Mono",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
