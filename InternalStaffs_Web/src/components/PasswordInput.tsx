"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { strength } from "@/lib/validation";
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-eye"
        aria-label={`${visible ? "Ẩn" : "Hiện"} mật khẩu`}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeSlash size={22} /> : <Eye size={22} />}
      </button>
    </div>
  );
}
export function PasswordMeter({ value }: { value: string }) {
  const label = strength(value);
  const level = value
    ? ["Yếu", "Trung bình", "Tốt", "Mạnh"].indexOf(label) + 1
    : 0;
  const color = ["#64748B", "#B91C1C", "#A16207", "#4D7C0F", "#15803D"][level];
  return (
    <div className="password-meter" style={{ color }}>
      <div
        role="meter"
        aria-label="Độ mạnh mật khẩu"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        aria-valuetext={label}
        className="password-segments"
      >
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{ background: i <= level ? color : "#E2E8F0" }}
          />
        ))}
      </div>
      <small>Độ mạnh: {value ? label : "Chưa nhập"}</small>
    </div>
  );
}
