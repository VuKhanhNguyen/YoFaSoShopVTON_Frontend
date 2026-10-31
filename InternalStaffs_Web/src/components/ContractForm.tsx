"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  choices,
  labels,
  resolve,
  schemas,
  strength,
  validate,
  type Schema,
} from "@/lib/validation";
export type Option = { value: string; label: string };
export type Options = Record<string, Option[]>;
function localDateTime(value: unknown): string {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function defaults(schema: Schema): unknown {
  const s = resolve(schema);
  if (s.type === "object")
    return Object.fromEntries(
      Object.entries(s.properties || {})
        .filter(([key]) => s.required?.includes(key))
        .map(([key, child]) => [key, defaults(child)]),
    );
  return s.type === "array" ? [] : s.type === "boolean" ? false : "";
}
function clean(schema: Schema, value: unknown): unknown {
  const s = resolve(schema);
  if (s.type === "object")
    return Object.fromEntries(
      Object.entries((value || {}) as Record<string, unknown>)
        .filter(
          ([k, v]) =>
            s.properties?.[k] && v !== "" && v !== undefined && v !== null,
        )
        .map(([k, v]) => [k, clean(s.properties![k], v)]),
    );
  if (s.type === "array")
    return (value as unknown[]).map((v) => clean(s.items!, v));
  return value;
}
export function ContractForm({
  schemaName,
  initial,
  onSubmit,
  title = "Lưu thay đổi",
  options = {},
}: {
  schemaName: string;
  initial?: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>, key: string) => Promise<void>;
  title?: string;
  options?: Options;
}) {
  const schema = schemas[schemaName],
    [value, setValue] = useState<Record<string, unknown>>(
      initial || (defaults(schema) as Record<string, unknown>),
    ),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [confirm, setConfirm] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = clean(schema, value) as Record<string, unknown>;
    const errs = validate(schema, body);
    if (["Register", "Staff", "Password", "Reset"].includes(schemaName)) {
      const p =
        schemaName === "Staff"
          ? (body.account as Record<string, unknown>)?.password
          : body.newPassword || body.password;
      if (confirm !== p) errs.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }
    if (
      schemaName === "Promotion" &&
      body.startsAt &&
      body.endsAt &&
      Date.parse(String(body.endsAt)) <= Date.parse(String(body.startsAt))
    )
      errs.endsAt = "Kết thúc phải sau thời điểm bắt đầu.";
    if (schemaName === "Variant" && Number(body.salePrice) > Number(body.price))
      errs.salePrice = "Giá khuyến mãi không vượt giá niêm yết.";
    setErrors(errs);
    setMessage("");
    if (Object.keys(errs).length) return;
    const payload = JSON.stringify(body);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await onSubmit(body, attempt.current!.key);
      setMessage("Đã lưu thành công.");
      attempt.current = null;
    } catch (e) {
      setMessage((e as Error).message);
      if (e instanceof ApiError) setErrors(e.fields);
    } finally {
      setBusy(false);
    }
  }
  function field(
    spec: Schema,
    v: unknown,
    set: (v: unknown) => void,
    path: string,
    required = false,
  ): React.ReactNode {
    const s = resolve(spec),
      key = path.split(".").pop()!,
      label = labels[key] || key,
      id = `field-${path}`,
      list = options[path] || options[key];
    if (s.type === "object")
      return (
        <fieldset key={path}>
          <legend>{label}</legend>
          {Object.entries(s.properties || {}).map(([k, child]) =>
            field(
              child,
              (v as Record<string, unknown>)?.[k],
              (next) => set({ ...((v as object) || {}), [k]: next }),
              path ? `${path}.${k}` : k,
              s.required?.includes(k),
            ),
          )}
        </fieldset>
      );
    if (s.type === "array") {
      const values = (v || []) as unknown[];
      if (list)
        return (
          <fieldset key={path}>
            <legend>{label}</legend>
            {list.map((option) => (
              <label key={option.value} className="check">
                <input
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={(e) =>
                    set(
                      e.target.checked
                        ? [...values, option.value]
                        : values.filter((v) => v !== option.value),
                    )
                  }
                />
                {option.label}
              </label>
            ))}
            {errors[path] && <p className="field-error">{errors[path]}</p>}
          </fieldset>
        );
      return (
        <fieldset key={path}>
          <legend>{label}</legend>
          {values.map((entry, index) => (
            <div key={index} className="array-entry">
              {field(
                s.items!,
                entry,
                (next) => set(values.map((v, i) => (i === index ? next : v))),
                `${path}.${index}`,
                true,
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => set(values.filter((_, i) => i !== index))}
              >
                Bỏ mục
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={values.length >= (s.maxItems || 50)}
            onClick={() => set([...values, defaults(s.items!)])}
          >
            Thêm mục
          </button>
          {errors[path] && <p className="field-error">{errors[path]}</p>}
        </fieldset>
      );
    }
    if (s.type === "boolean")
      return (
        <label className="check" key={path}>
          <input
            type="checkbox"
            checked={Boolean(v)}
            onChange={(e) => set(e.target.checked)}
          />
          {label}
        </label>
      );
    const enums = choices(s),
      password = key.toLowerCase().includes("password");
    return (
      <div className="field" key={path}>
        <label htmlFor={id}>
          {label}
          {required ? " *" : ""}
        </label>
        {list || enums ? (
          <select
            id={id}
            value={String(v || "")}
            onChange={(e) => set(e.target.value)}
            aria-invalid={!!errors[path]}
          >
            <option value="">Chọn {label.toLowerCase()}</option>
            {(
              list ||
              enums!.map((v) => ({ value: v, label: v.replaceAll("_", " ") }))
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : ["comment", "description", "reply", "note", "reason"].includes(
            key,
          ) ? (
          <textarea
            id={id}
            rows={3}
            value={String(v || "")}
            maxLength={s.maxLength}
            onChange={(e) => set(e.target.value)}
            aria-invalid={!!errors[path]}
          />
        ) : (
          <input
            id={id}
            type={
              password
                ? visible
                  ? "text"
                  : "password"
                : s.format === "email"
                  ? "email"
                  : s.type === "integer" || s.type === "number"
                    ? "number"
                    : s.format === "date-time"
                      ? "datetime-local"
                      : "text"
            }
            value={
              s.format === "date-time" && v
                ? localDateTime(v)
                : String(v ?? "")
            }
            maxLength={s.maxLength}
            autoComplete={
              password
                ? "new-password"
                : key === "username"
                  ? "username"
                  : "off"
            }
            min={s.minimum}
            max={s.maximum}
            step={s.type === "integer" ? 1 : "any"}
            onChange={(e) =>
              set(
                s.type === "number" || s.type === "integer"
                  ? e.target.value === ""
                    ? ""
                    : Number(e.target.value)
                  : s.format === "date-time" && e.target.value
                    ? new Date(e.target.value).toISOString()
                    : e.target.value,
              )
            }
            aria-invalid={!!errors[path]}
            aria-describedby={errors[path] ? `${id}-error` : undefined}
          />
        )}
        {errors[path] && (
          <p id={`${id}-error`} role="alert" className="field-error">
            {errors[path]}
          </p>
        )}
        {password && s.minLength === 10 && !!v && (
          <p className="hint">Độ mạnh: {strength(String(v))}</p>
        )}
      </div>
    );
  }
  return (
    <form noValidate onSubmit={submit} className="contract-form">
      <fieldset disabled={busy} className="form-fields">
        {Object.entries(schema.properties || {}).map(([key, spec]) =>
          field(
            spec,
            value[key],
            (next) => setValue({ ...value, [key]: next }),
            key,
            schema.required?.includes(key),
          ),
        )}
        {["Register", "Staff", "Password", "Reset"].includes(schemaName) && (
          <div className="field">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <input
              id="confirmPassword"
              type={visible ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="field-error">{errors.confirmPassword}</p>
            )}
          </div>
        )}
        {[
          "Login",
          "Register",
          "Staff",
          "Profile",
          "Password",
          "Reset",
        ].includes(schemaName) && (
          <label className="check">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            Hiện mật khẩu
          </label>
        )}
      </fieldset>
      {!!message && (
        <p
          role="status"
          className={
            message === "Đã lưu thành công."
              ? "success-message"
              : "error-banner"
          }
        >
          {message}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Đang xử lý..." : title}
      </button>
    </form>
  );
}
