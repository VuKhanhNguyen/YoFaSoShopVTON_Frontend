import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { ApiError } from "@/lib/api";
import { labels, schemas, validate, type Schema } from "@/lib/validation";
import { Button, Field, Notice, PasswordMeter, s } from "./ui";
export function ContractForm({
  schemaName,
  initial = {},
  onSubmit,
  title = "Lưu thay đổi",
  exclude = [],
  footer,
}: {
  schemaName: string;
  initial?: Record<string, unknown>;
  onSubmit: (value: Record<string, unknown>) => Promise<void>;
  title?: string;
  exclude?: string[];
  footer?: React.ReactNode;
}) {
  const schema = schemas[schemaName];
  const [value, setValue] = useState(initial),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit() {
    const allowed = Object.fromEntries(
      Object.entries(value).filter(
        ([key, val]) =>
          !exclude.includes(key) && key !== "confirmPassword" && val !== "",
      ),
    );
    const fields = Object.fromEntries(
      Object.entries(schema.properties || {}).filter(
        ([key]) => !exclude.includes(key),
      ),
    );
    const errs = validate(
      {
        ...schema,
        properties: fields,
        required: schema.required?.filter((key) => !exclude.includes(key)),
      },
      allowed,
    );
    if (
      ["Reset", "Password", "Register"].includes(schemaName) &&
      value.confirmPassword !== (allowed.newPassword || allowed.password)
    )
      errs.confirmPassword = "Mật khẩu xác nhận không khớp.";
    setErrors(errs);
    setMessage("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await onSubmit(allowed);
      setMessage("Đã lưu thành công.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được.");
      if (e instanceof ApiError) setErrors(e.fields);
    } finally {
      setBusy(false);
    }
  }
  function field(key: string, spec: Schema) {
    const label =
      key === "confirmPassword" ? "Xác nhận mật khẩu" : labels[key] || key;
    if (spec.type === "boolean")
      return (
        <View key={key} style={s.row}>
          <Switch
            accessibilityLabel={label}
            value={Boolean(value[key])}
            onValueChange={(v) => setValue({ ...value, [key]: v })}
          />
          <Text>{label}</Text>
        </View>
      );
    const password = key.toLowerCase().includes("password");
    return (
      <View key={key}>
        <Field
          label={label}
          value={String(value[key] ?? "")}
          onChangeText={(v) =>
            setValue({
              ...value,
              [key]: spec.type === "integer" ? (v === "" ? "" : Number(v)) : v,
            })
          }
          maxLength={spec.maxLength}
          error={errors[key]}
          autoCapitalize={
            password || ["email", "username", "otp"].includes(key)
              ? "none"
              : "sentences"
          }
          password={password}
          keyboardType={
            key === "phone" || spec.type === "integer"
              ? "phone-pad"
              : key === "email"
                ? "email-address"
                : "default"
          }
          multiline={key === "comment" || key === "street"}
        />
        {password &&
          ["Register", "Reset", "Password"].includes(schemaName) &&
          ["password", "newPassword"].includes(key) && (
            <PasswordMeter value={String(value[key] ?? "")} />
          )}
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {Object.entries(schema.properties || {})
        .filter(([key]) => !exclude.includes(key))
        .map(([key, spec]) => field(key, spec))}
      {["Register", "Reset", "Password"].includes(schemaName) &&
        field("confirmPassword", { type: "string", maxLength: 72 })}
      {footer}
      {!!message && (
        <Notice error={message !== "Đã lưu thành công."}>{message}</Notice>
      )}
      <Button
        title={busy ? "Đang xử lý..." : title}
        disabled={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
