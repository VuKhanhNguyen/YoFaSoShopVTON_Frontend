"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRightLeft,
  Camera,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, ApiError } from "@/lib/api";
import { useAuth, ACCOUNTS } from "@/lib/auth";

interface UserProfileData {
  userId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarKey?: string;
  avatarUrl?: string;
  avatarDirectUrl?: string;
  gender?: "NAM" | "NU" | "KHAC";
  roles?: string[];
  loyaltyPoints?: number;
  membership?: string;
}

interface AddressItem {
  addressId: string;
  recipientName: string;
  phone: string;
  street: string;
  ward: string;
  city: string;
  defaultAddress: boolean;
}

export interface LocationUnit {
  code: string;
  name: string;
  type?: string;
  fullName?: string;
}

export interface LocationCandidate {
  province: LocationUnit;
  ward: LocationUnit;
  street?: string;
  fullAddress?: string;
}

export interface ConversionResponse {
  status: "EXACT" | "NEEDS_CONFIRMATION" | "UNMAPPED";
  requiresConfirmation: boolean;
  candidates: LocationCandidate[];
  oldAddress?: {
    fullAddress?: string;
  };
}

// Chuẩn hóa tên địa danh để so khớp linh hoạt, bỏ tiền tố hành chính
function normalizeLocationName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/^(thành phố|tỉnh|quận|huyện|thị xã|thị trấn|phường|xã|tp\.|tp)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLocationMatch(candidate: LocationUnit | undefined, target: string): boolean {
  if (!candidate || !target) return false;
  const targetTrim = target.trim().toLowerCase();
  const cName = String(candidate.name || "").trim().toLowerCase();
  const cFull = String(
    candidate.fullName || (candidate.type ? `${candidate.type} ${candidate.name}` : "")
  ).trim().toLowerCase();
  const cWithType = `${String(candidate.type || "").trim()} ${cName}`.trim().toLowerCase();

  if (targetTrim === cName || targetTrim === cFull || targetTrim === cWithType) {
    return true;
  }

  const targetNorm = normalizeLocationName(target);
  const cNorm = normalizeLocationName(cName);
  if (targetNorm && cNorm && targetNorm === cNorm) {
    return true;
  }

  return false;
}

/** Tạo URL tải ảnh đại diện từ R2 hoặc Proxy Backend */
function getAvatarUrl(profile: UserProfileData | null, version: number): string | null {
  if (!profile) return null;
  if (profile.avatarDirectUrl) {
    return `${profile.avatarDirectUrl}?v=${version}`;
  }
  if (profile.avatarUrl) {
    const cleanUrl = profile.avatarUrl.replace(/^\/api\/v1/, "");
    const joinChar = cleanUrl.includes("?") ? "&" : "?";
    return `/api/backend${cleanUrl}${joinChar}t=${version}`;
  }
  if (profile.avatarKey && profile.userId) {
    return `/api/backend/users/${profile.userId}/avatar?t=${version}`;
  }
  return null;
}

export function ProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile data & loading
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Quản lý hiển thị Popup chỉnh sửa thông tin
  const [editOpen, setEditOpen] = useState(false);

  // Quản lý đăng xuất
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      onClose();
      router.push("/login");
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  // Form states: Thông tin cá nhân
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"NAM" | "NU" | "KHAC">("NAM");

  // Form states: Địa chỉ
  const [currentAddressId, setCurrentAddressId] = useState<string | null>(null);
  const [address, setAddress] = useState(""); // Chuỗi địa chỉ hiển thị hiện tại
  const [street, setStreet] = useState("");
  const [addressMode, setAddressMode] = useState<"new" | "legacy">("new");

  // Danh mục MỚI (sau sáp nhập 01/07/2025: Tỉnh -> Phường/Xã)
  const [newProvinces, setNewProvinces] = useState<LocationUnit[]>([]);
  const [selectedNewProvince, setSelectedNewProvince] = useState<LocationUnit | null>(null);
  const [newWards, setNewWards] = useState<LocationUnit[]>([]);
  const [selectedNewWard, setSelectedNewWard] = useState<LocationUnit | null>(null);
  const [loadingNewWards, setLoadingNewWards] = useState(false);

  // Danh mục CŨ (trước sáp nhập: Tỉnh -> Huyện -> Xã)
  const [legacyProvinces, setLegacyProvinces] = useState<LocationUnit[]>([]);
  const [selectedLegacyProvince, setSelectedLegacyProvince] = useState<LocationUnit | null>(null);
  const [legacyDistricts, setLegacyDistricts] = useState<LocationUnit[]>([]);
  const [selectedLegacyDistrict, setSelectedLegacyDistrict] = useState<LocationUnit | null>(null);
  const [legacyWards, setLegacyWards] = useState<LocationUnit[]>([]);
  const [selectedLegacyWard, setSelectedLegacyWard] = useState<LocationUnit | null>(null);
  const [loadingLegacyDistricts, setLoadingLegacyDistricts] = useState(false);
  const [loadingLegacyWards, setLoadingLegacyWards] = useState(false);

  // Chuyển đổi địa chỉ cũ sang mới
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<LocationCandidate | null>(null);

  // Admin in-app OTP Reset Password states (ONLY for ROLE_SHOP_ADMIN)
  const isAdmin = user?.role === "ROLE_SHOP_ADMIN" || profile?.roles?.includes("ROLE_SHOP_ADMIN");
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequestId, setOtpRequestId] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resettingPass, startResetPassTransition] = useTransition();

  // Chuyển đổi địa chỉ cũ -> mới qua API
  const runConversion = useCallback(
    async (
      provCode: string,
      distCode: string,
      wardCode?: string,
      currentStreet?: string
    ) => {
      if (!provCode || !distCode) return;
      setConverting(true);
      try {
        const res = await api<ConversionResponse>("/convert/address", "POST", {
          provinceCode: provCode,
          districtCode: distCode,
          wardCode: wardCode || undefined,
          street: currentStreet?.trim() || "",
        });
        setConversionResult(res);
        if (res?.candidates && res.candidates.length > 0) {
          setSelectedCandidate(res.candidates[0]);
        } else {
          setSelectedCandidate(null);
        }
      } catch {
        setConversionResult(null);
        setSelectedCandidate(null);
      } finally {
        setConverting(false);
      }
    },
    []
  );

  // Load initial data
  useEffect(() => {
    if (!open) return;
    let active = true;

    Promise.all([
      api<UserProfileData>("/me").catch(() => null),
      api<AddressItem[]>("/me/addresses").catch(() => []),
      api<LocationUnit[]>("/new-provinces").catch(() => []),
      api<LocationUnit[]>("/provinces").catch(() => []),
    ]).then(([meData, addrList, newProvList, legProvList]) => {
      if (!active) return;
      if (meData) {
        setProfile(meData);
        setFullName(meData.fullName || user?.name || "");
        setEmail(meData.email || user?.email || "");
        setPhone(meData.phone || "");
        if (meData.gender === "NAM" || meData.gender === "NU" || meData.gender === "KHAC") {
          setGender(meData.gender);
        }
      } else {
        setFullName(user?.name || "");
        setEmail(user?.email || "");
      }

      const validNewProvs = newProvList || [];
      const validLegProvs = legProvList || [];
      setNewProvinces(validNewProvs);
      setLegacyProvinces(validLegProvs);

      if (addrList && addrList.length > 0) {
        const def = addrList.find((a) => a.defaultAddress) || addrList[0];
        setCurrentAddressId(def.addressId);
        setStreet(def.street || "");
        const formatted = [def.street, def.ward, def.city].filter(Boolean).join(", ");
        setAddress(formatted);

        // Auto-match province mới
        if (validNewProvs.length > 0 && def.city) {
          const matchedP = validNewProvs.find((p) => isLocationMatch(p, def.city));
          if (matchedP) {
            setSelectedNewProvince(matchedP);
            api<LocationUnit[]>(`/new-provinces/${matchedP.code}/wards`)
              .then((wList) => {
                if (!active) return;
                setNewWards(wList);
                if (def.ward) {
                  const matchedW = wList.find((w) => isLocationMatch(w, def.ward));
                  if (matchedW) setSelectedNewWard(matchedW);
                }
              })
              .catch(() => {});
          }
        }
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [open, user]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Xử lý khi chọn tỉnh mới
  const handleSelectNewProvince = async (code: string) => {
    const prov = newProvinces.find((p) => p.code === code) || null;
    setSelectedNewProvince(prov);
    setSelectedNewWard(null);
    setNewWards([]);
    if (!prov) return;

    setLoadingNewWards(true);
    try {
      const wards = await api<LocationUnit[]>(`/new-provinces/${prov.code}/wards`);
      setNewWards(wards);
    } catch {
      setNewWards([]);
    } finally {
      setLoadingNewWards(false);
    }
  };

  // Xử lý khi chọn tỉnh cũ
  const handleSelectLegacyProvince = async (code: string) => {
    const prov = legacyProvinces.find((p) => p.code === code) || null;
    setSelectedLegacyProvince(prov);
    setSelectedLegacyDistrict(null);
    setSelectedLegacyWard(null);
    setLegacyDistricts([]);
    setLegacyWards([]);
    setConversionResult(null);
    setSelectedCandidate(null);
    if (!prov) return;

    setLoadingLegacyDistricts(true);
    try {
      const districts = await api<LocationUnit[]>(`/provinces/${prov.code}/districts`);
      setLegacyDistricts(districts);
    } catch {
      setLegacyDistricts([]);
    } finally {
      setLoadingLegacyDistricts(false);
    }
  };

  // Xử lý khi chọn huyện cũ
  const handleSelectLegacyDistrict = async (code: string) => {
    const dist = legacyDistricts.find((d) => d.code === code) || null;
    setSelectedLegacyDistrict(dist);
    setSelectedLegacyWard(null);
    setLegacyWards([]);
    setConversionResult(null);
    setSelectedCandidate(null);
    if (!dist || !selectedLegacyProvince) return;

    setLoadingLegacyWards(true);
    try {
      const wards = await api<LocationUnit[]>(`/districts/${dist.code}/wards`);
      setLegacyWards(wards);
      if (wards.length === 0) {
        void runConversion(selectedLegacyProvince.code, dist.code, undefined, street);
      }
    } catch {
      setLegacyWards([]);
    } finally {
      setLoadingLegacyWards(false);
    }
  };

  // Xử lý khi chọn xã cũ
  const handleSelectLegacyWard = (code: string) => {
    const ward = legacyWards.find((w) => w.code === code) || null;
    setSelectedLegacyWard(ward);
    if (selectedLegacyProvince && selectedLegacyDistrict) {
      void runConversion(selectedLegacyProvince.code, selectedLegacyDistrict.code, ward?.code, street);
    }
  };

  // Đồng bộ lại dữ liệu form khi mở popup chỉnh sửa
  const handleOpenEditPopup = () => {
    if (profile) {
      setFullName(profile.fullName || user?.name || "");
      setEmail(profile.email || user?.email || "");
      setPhone(profile.phone || "");
      if (profile.gender === "NAM" || profile.gender === "NU" || profile.gender === "KHAC") {
        setGender(profile.gender);
      }
    }
    setEditOpen(true);
  };

  // Xử lý cập nhật thông tin cá nhân & Địa chỉ từ Popup
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!fullName.trim()) {
      setMessage({ text: "Vui lòng nhập họ và tên.", type: "error" });
      setSaving(false);
      return;
    }
    if (!email.trim()) {
      setMessage({ text: "Vui lòng nhập email hợp lệ.", type: "error" });
      setSaving(false);
      return;
    }

    // Kiểm tra tính hợp lệ của địa chỉ nếu người dùng có nhập/chọn
    let finalCity = "";
    let finalWard = "";
    let finalProvinceCode: string | undefined = undefined;
    let finalWardCode: string | undefined = undefined;
    const hasAddressInput = Boolean(street.trim() || selectedNewProvince || selectedLegacyProvince);

    if (hasAddressInput) {
      if (addressMode === "new") {
        if (!selectedNewProvince) {
          setMessage({ text: "Vui lòng chọn Tỉnh / Thành phố mới (sau sáp nhập).", type: "error" });
          setSaving(false);
          return;
        }
        if (!selectedNewWard) {
          setMessage({ text: "Vui lòng chọn Phường / Xã mới (sau sáp nhập).", type: "error" });
          setSaving(false);
          return;
        }
        if (!street.trim()) {
          setMessage({ text: "Vui lòng nhập số nhà, tên đường chi tiết.", type: "error" });
          setSaving(false);
          return;
        }
        finalCity = selectedNewProvince.name;
        finalWard = selectedNewWard.name;
        finalProvinceCode = selectedNewProvince.code.padStart(2, "0");
        finalWardCode = selectedNewWard.code.padStart(5, "0");
      } else {
        // Mode legacy
        if (!selectedLegacyProvince || !selectedLegacyDistrict) {
          setMessage({ text: "Vui lòng chọn Tỉnh/Thành và Quận/Huyện cũ.", type: "error" });
          setSaving(false);
          return;
        }
        if (!selectedCandidate) {
          setMessage({
            text: "Chưa hoàn tất chuyển đổi địa chỉ sang đơn vị hành chính sau sáp nhập.",
            type: "error",
          });
          setSaving(false);
          return;
        }
        if (!street.trim()) {
          setMessage({ text: "Vui lòng nhập số nhà, tên đường chi tiết.", type: "error" });
          setSaving(false);
          return;
        }
        finalCity = selectedCandidate.province.name;
        finalWard = selectedCandidate.ward.name;
        finalProvinceCode = selectedCandidate.province.code.padStart(2, "0");
        finalWardCode = selectedCandidate.ward.code.padStart(5, "0");
      }
    }

    try {
      // 1. Cập nhật thông tin cá nhân qua PATCH /me
      const updatedUser = await api<UserProfileData>("/me", "PATCH", {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender,
      });

      if (updatedUser) {
        setProfile(updatedUser);
      }

      // 2. Cập nhật địa chỉ qua PUT hoặc POST /me/addresses
      if (hasAddressInput && finalCity && finalWard) {
        const addressPayload = {
          recipientName: fullName.trim(),
          phone: phone.trim() || profile?.phone || "0900000000",
          street: street.trim(),
          ward: finalWard,
          city: finalCity,
          provinceCode: finalProvinceCode,
          wardCode: finalWardCode,
          defaultAddress: true,
        };

        if (currentAddressId && !currentAddressId.startsWith("addr-")) {
          await api(`/me/addresses/${currentAddressId}`, "PUT", addressPayload);
        } else {
          const res = await api<{ addressId: string }>("/me/addresses", "POST", addressPayload);
          if (res?.addressId) setCurrentAddressId(res.addressId);
        }
        const formatted = [street.trim(), finalWard, finalCity].filter(Boolean).join(", ");
        setAddress(formatted);
      }

      setMessage({ text: "Cập nhật thông tin cá nhân và địa chỉ thành công!", type: "success" });
      setEditOpen(false); // Đóng popup chỉnh sửa sau khi lưu thành công
    } catch (err: unknown) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Cập nhật hồ sơ thất bại.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Upload Avatar lên Cloudflare R2
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("png") && !file.type.includes("jpeg")) {
      setMessage({ text: "Chỉ chấp nhận file ảnh định dạng PNG hoặc JPEG.", type: "error" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: "Dung lượng ảnh tối đa là 10 MB.", type: "error" });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name || "avatar.png");
      await api("/me/avatar", "POST", formData);

      // Lấy lại dữ liệu người dùng mới nhất từ BE
      const updated = await api<UserProfileData>("/me");
      if (updated) {
        setProfile(updated);
        setAvatarLoadError(false);
        const ver = Date.now();
        setAvatarVersion(ver);
        const newSrc = getAvatarUrl(updated, ver);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("yofaso:avatar-updated", { detail: { avatarUrl: newSrc } })
          );
        }
      }
      setMessage({ text: "Đã cập nhật ảnh đại diện lên Cloudflare R2 thành công!", type: "success" });
    } catch (err: unknown) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Tải ảnh đại diện thất bại.",
        type: "error",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Step 1: Admin sends OTP to own email
  const handleRequestOtp = async () => {
    const targetEmail = email.trim() || profile?.email || user?.email || "";
    if (!targetEmail) {
      setMessage({ text: "Vui lòng nhập email hợp lệ.", type: "error" });
      return;
    }
    setMessage(null);
    try {
      const res = await api<{ requestId: string; message?: string }>("/auth/forgot-password", "POST", {
        email: targetEmail,
      });
      setOtpRequestId(res.requestId);
      setOtpSent(true);
      setCooldown(60);
      setMessage({
        text: "Mã OTP đã được gửi đến email quản trị viên. Vui lòng kiểm tra hộp thư!",
        type: "success",
      });
    } catch (err: unknown) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Không thể gửi mã OTP.",
        type: "error",
      });
    }
  };

  // Step 2: Admin enters OTP and new password
  const handleResetPasswordWithOtp = () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setMessage({ text: "Vui lòng nhập mã OTP 6 chữ số.", type: "error" });
      return;
    }
    if (newPassword.length < 10) {
      setMessage({ text: "Mật khẩu mới phải có tối thiểu 10 ký tự.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: "Mật khẩu xác nhận không khớp.", type: "error" });
      return;
    }

    startResetPassTransition(async () => {
      setMessage(null);
      try {
        await api("/auth/reset-password", "POST", {
          requestId: otpRequestId,
          email: email.trim() || profile?.email || user?.email || "",
          otp: otp.trim(),
          newPassword,
        });
        setMessage({
          text: "Đổi mật khẩu tài khoản quản trị thành công! Mật khẩu mới đã có hiệu lực.",
          type: "success",
        });
        setOtpSent(false);
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err: unknown) {
        setMessage({
          text: err instanceof ApiError ? err.message : "Đổi mật khẩu thất bại. Kiểm tra mã OTP.",
          type: "error",
        });
      }
    });
  };

  const accInfo = ACCOUNTS[user?.role ?? "ROLE_SHOP_ADMIN"];
  const avatarSrc = getAvatarUrl(profile, avatarVersion);

  return (
    <>
      {/* 1. MAIN PROFILE VIEW MODAL: Khung hiển thị thông tin cá nhân trang nhã */}
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <User className="h-5 w-5 text-accent-hover" />
            Hồ sơ cá nhân &amp; Thông tin tài khoản
          </DialogTitle>
          <DialogDescription>
            Xem thông tin định danh, địa chỉ công tác và bảo mật tài khoản nội bộ trên YoFaSo Portal.
          </DialogDescription>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent-hover" />
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {message && (
                <div
                  className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
                    message.type === "success"
                      ? "bg-success-subtle text-success border border-success/30"
                      : "bg-danger-subtle text-destructive border border-destructive/30"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Header / Avatar Profile Summary Card */}
              <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-border bg-surface-muted/50 p-5 shadow-2xs">
                {/* Avatar with Camera upload button */}
                <div className="relative shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-primary text-3xl font-bold text-primary-foreground shadow-sm">
                    {avatarSrc && !avatarLoadError ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={`${avatarSrc}-${avatarVersion}`}
                        src={avatarSrc}
                        alt={fullName}
                        className="h-full w-full object-cover"
                        onError={() => setAvatarLoadError(true)}
                      />
                    ) : (
                      <span>{fullName.split(" ").slice(-1)[0]?.slice(0, 1) || "A"}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Tải ảnh đại diện mới lên Cloudflare R2"
                    title="Đổi ảnh đại diện (lưu trực tiếp lên Cloudflare R2)"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-hover text-white shadow-md transition-transform hover:scale-110 active:scale-95 disabled:opacity-70"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-xl font-bold text-foreground">{fullName || "Người dùng YoFaSo"}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-bold text-accent-hover">
                      {accInfo?.icon} {accInfo?.label}
                    </span>
                    
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{email || "Chưa thiết lập email"}</p>
                  
                </div>
              </div>

              {/* KHUNG THÔNG TIN CHI TIẾT (READ-ONLY VIEW) VÀ NÚT MỞ POPUP CHỈNH SỬA */}
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                      Thông tin cá nhân &amp; Đơn vị công tác
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Dữ liệu người dùng được lưu trữ và kiểm soát theo phân quyền nội bộ.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOpenEditPopup}
                    size="sm"
                    className="gap-1.5 shadow-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Chỉnh sửa thông tin
                  </Button>
                </div>

                {/* Grid hiển thị thông tin dạng read-only */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-3">
                    <span className="font-semibold text-muted-foreground">Họ và tên:</span>
                    <p className="mt-1 text-sm font-bold text-foreground">{fullName || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-3">
                    <span className="font-semibold text-muted-foreground">Số điện thoại:</span>
                    <p className="mt-1 font-mono text-sm font-bold text-foreground">{phone || "Chưa cập nhật"}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-3">
                    <span className="font-semibold text-muted-foreground">Email liên hệ:</span>
                    <p className="mt-1 font-mono text-sm font-semibold text-foreground">{email || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-3">
                    <span className="font-semibold text-muted-foreground">Giới tính:</span>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {gender === "NAM" ? "Nam" : gender === "NU" ? "Nữ" : "Khác"}
                    </p>
                  </div>
                </div>

                {/* Box hiển thị địa chỉ chi tiết */}
                <div className="rounded-lg border border-accent/20 bg-accent-subtle/20 p-3.5 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-accent-hover">
                    <MapPin className="h-4 w-4" />
                    <span>Địa chỉ công tác / nhận hàng:</span>
                  </div>
                  {address ? (
                    <p className="text-sm font-semibold text-foreground leading-relaxed pl-5">
                      {address}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic pl-5">
                      Chưa thiết lập địa chỉ. Bấm nút &quot;Chỉnh sửa thông tin&quot; phía trên để cập nhật.
                    </p>
                  )}
                </div>
              </div>

              {/* In-app Password Reset Area: ONLY FOR ADMIN */}
              {isAdmin ? (
                <div className="space-y-4 rounded-2xl border border-accent/40 bg-accent-subtle/30 p-5">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-accent-hover" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                      Đổi mật khẩu quản trị viên (Bắt buộc xác thực OTP)
                    </h4>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Đổi mật khẩu trực tiếp trong hệ thống quản trị mà không cần đăng xuất. Mã OTP bảo mật 6 chữ số sẽ được gửi về email của chủ shop/quản trị viên.
                  </p>

                  {!otpSent ? (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRequestOtp}
                        disabled={cooldown > 0}
                        className="border-accent text-accent-hover hover:bg-accent-subtle"
                      >
                        {cooldown > 0
                          ? `Gửi lại mã OTP sau (${cooldown}s)`
                          : `Gửi mã OTP xác nhận về ${email}`}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Mã OTP (6 số)
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="123456"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-center text-sm font-bold tracking-widest focus:ring-2 focus:ring-ring outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Mật khẩu mới (≥10 ký tự)
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mật khẩu mới"
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Xác nhận mật khẩu
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu"
                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={cooldown > 0}
                          onClick={handleRequestOtp}
                          className="text-xs text-muted-foreground"
                        >
                          {cooldown > 0 ? `Gửi lại OTP (${cooldown}s)` : "Chưa nhận được? Gửi lại mã OTP"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={resettingPass || !otp || !newPassword}
                          onClick={handleResetPasswordWithOtp}
                        >
                          {resettingPass && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                          Xác nhận đổi mật khẩu
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-info" />
                    Chính sách bảo mật nhân sự
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Tài khoản nhân viên được cấp và quản lý bởi Quản trị viên hệ thống. Vui lòng liên hệ Admin nếu bạn cần cấp lại mật khẩu truy cập.
                  </p>
                </div>
              )}

              {/* Nút Đăng xuất tài khoản nội bộ (Dùng chung cho cả Admin và Nhân viên) */}
              <div className="border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 border-destructive/40 text-destructive hover:bg-danger-subtle hover:text-destructive h-10 text-xs font-bold transition-colors"
                  onClick={() => {
                    onClose();
                    setLogoutConfirmOpen(true);
                  }}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Đăng xuất tài khoản
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Xác nhận đăng xuất?"
        description={
          isAdmin
            ? "Bạn sẽ kết thúc phiên làm việc của chủ shop trên YoFaSo Admin Portal. Mọi dữ liệu thao tác chưa lưu có thể bị gián đoạn."
            : "Bạn sẽ kết thúc phiên làm việc của nhân sự trên YoFaSo Portal. Mọi dữ liệu thao tác chưa lưu có thể bị gián đoạn."
        }
        confirmLabel="Đăng xuất ngay"
        cancelLabel="Ở lại"
        tone="danger"
        loading={loggingOut}
        onConfirm={handleLogout}
        onClose={() => setLogoutConfirmOpen(false)}
      />

      {/* 2. EDIT PROFILE POPUP: Popup chuyên dụng xuất hiện khi người dùng bấm "Chỉnh sửa thông tin" */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-6 z-[60]">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Pencil className="h-4 w-4 text-accent-hover" />
            Chỉnh sửa thông tin cá nhân &amp; Địa chỉ
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin định danh và địa chỉ công tác chuẩn hóa theo đơn vị hành chính sau sáp nhập 01/07/2025.
          </DialogDescription>

          <form onSubmit={handleUpdateProfile} className="mt-4 space-y-5">
            {/* Mục 1: Thông tin cá nhân cơ bản */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                1. Thông tin cá nhân cơ bản
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Họ và tên</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Nguyễn Văn A"
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Số điện thoại</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="090xxxxxxx"
                      className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Giới tính</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "NAM" | "NU" | "KHAC")}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                  >
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mục 2: Địa chỉ công tác / nhận hàng */}
            <div className="border-t border-border pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-accent-hover" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent-hover">
                    2. Địa chỉ công tác / nhận hàng
                  </h4>
                </div>

                {/* Tabs chuyển đổi chế độ địa chỉ */}
                <div className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAddressMode("new")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                      addressMode === "new"
                        ? "bg-surface text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent-hover" />
                    Sau sáp nhập (01/07/2025)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressMode("legacy")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                      addressMode === "legacy"
                        ? "bg-surface text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-info" />
                    Trước sáp nhập (Quy đổi)
                  </button>
                </div>
              </div>

              {/* Chế độ 1: Sau sáp nhập 01/07/2025 */}
              {addressMode === "new" ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Tỉnh / Thành phố mới (Sau sáp nhập)
                      </label>
                      <select
                        value={selectedNewProvince?.code || ""}
                        onChange={(e) => void handleSelectNewProvince(e.target.value)}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                      >
                        <option value="">-- Chọn Tỉnh / Thành phố --</option>
                        {newProvinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.fullName || `${p.type ? p.type + " " : ""}${p.name}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Phường / Xã mới {loadingNewWards && "(Đang tải...)"}
                      </label>
                      <select
                        value={selectedNewWard?.code || ""}
                        onChange={(e) => {
                          const w = newWards.find((item) => item.code === e.target.value) || null;
                          setSelectedNewWard(w);
                        }}
                        disabled={!selectedNewProvince || loadingNewWards}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none disabled:bg-surface-muted disabled:text-muted-foreground"
                      >
                        <option value="">
                          {!selectedNewProvince
                            ? "-- Chọn Tỉnh/Thành trước --"
                            : loadingNewWards
                            ? "-- Đang nạp danh sách phường/xã... --"
                            : "-- Chọn Phường / Xã mới --"}
                        </option>
                        {newWards.map((w) => (
                          <option key={w.code} value={w.code}>
                            {w.fullName || `${w.type ? w.type + " " : ""}${w.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Số nhà, tên đường, ngõ/tòa nhà
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ví dụ: 123 Lê Duẩn, Tòa nhà Diamond"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                    />
                  </div>

                  {selectedNewProvince && selectedNewWard && (
                    <div className="rounded-lg border border-accent/20 bg-accent-subtle/20 p-2.5 text-xs">
                      <span className="font-semibold text-accent-hover">Địa chỉ hoàn chỉnh: </span>
                      <span className="text-foreground">
                        {[street.trim(), selectedNewWard.name, selectedNewProvince.name]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Chế độ 2: Trước sáp nhập (tự động quy đổi) */
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border bg-surface-muted/50 p-3 text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 text-accent-hover shrink-0 mt-0.5" />
                    <span>
                      Chọn đơn vị hành chính cũ trước ngày 01/07/2025, hệ thống sẽ tự động tra cứu Nghị quyết sáp nhập và quy đổi sang đơn vị hành chính mới để cập nhật vào hệ thống.
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Tỉnh / TP cũ (63 tỉnh thành)
                      </label>
                      <select
                        value={selectedLegacyProvince?.code || ""}
                        onChange={(e) => void handleSelectLegacyProvince(e.target.value)}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                      >
                        <option value="">-- Chọn Tỉnh/TP cũ --</option>
                        {legacyProvinces.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.fullName || `${p.type ? p.type + " " : ""}${p.name}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Quận / Huyện cũ {loadingLegacyDistricts && "(Đang tải...)"}
                      </label>
                      <select
                        value={selectedLegacyDistrict?.code || ""}
                        onChange={(e) => void handleSelectLegacyDistrict(e.target.value)}
                        disabled={!selectedLegacyProvince || loadingLegacyDistricts}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none disabled:bg-surface-muted disabled:text-muted-foreground"
                      >
                        <option value="">
                          {!selectedLegacyProvince
                            ? "-- Chọn Tỉnh trước --"
                            : loadingLegacyDistricts
                            ? "-- Đang nạp quận/huyện... --"
                            : "-- Chọn Quận / Huyện --"}
                        </option>
                        {legacyDistricts.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.fullName || `${d.type ? d.type + " " : ""}${d.name}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Phường / Xã cũ {loadingLegacyWards && "(Đang tải...)"}
                      </label>
                      <select
                        value={selectedLegacyWard?.code || ""}
                        onChange={(e) => handleSelectLegacyWard(e.target.value)}
                        disabled={!selectedLegacyDistrict || loadingLegacyWards}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none disabled:bg-surface-muted disabled:text-muted-foreground"
                      >
                        <option value="">
                          {!selectedLegacyDistrict
                            ? "-- Chọn Quận/Huyện trước --"
                            : loadingLegacyWards
                            ? "-- Đang nạp xã/phường... --"
                            : "-- Chọn Phường / Xã cũ --"}
                        </option>
                        {legacyWards.map((w) => (
                          <option key={w.code} value={w.code}>
                            {w.fullName || `${w.type ? w.type + " " : ""}${w.name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Số nhà, tên đường, ngõ/tòa nhà
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStreet(val);
                        if (selectedLegacyProvince && selectedLegacyDistrict) {
                          void runConversion(selectedLegacyProvince.code, selectedLegacyDistrict.code, selectedLegacyWard?.code, val);
                        }
                      }}
                      placeholder="Ví dụ: 123 Lê Duẩn, Tòa nhà Diamond"
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring outline-none"
                    />
                  </div>

                  {/* Trạng thái và kết quả quy đổi */}
                  {converting && (
                    <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-subtle/20 p-3 text-xs text-accent-hover">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Đang đối soát lịch sử sáp nhập 01/07/2025 theo Nghị quyết hành chính...</span>
                    </div>
                  )}

                  {!converting && conversionResult && (
                    <div
                      className={`space-y-2 rounded-lg border p-3 text-xs ${
                        conversionResult.status === "EXACT"
                          ? "border-success/30 bg-success-subtle/20"
                          : "border-warning/30 bg-warning-subtle/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {conversionResult.status === "EXACT" ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <span className="text-success">Quy đổi tự động chính xác</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                            <span className="text-warning">Cần bạn xác nhận khu vực sáp nhập</span>
                          </>
                        )}
                      </div>

                      {conversionResult.candidates && conversionResult.candidates.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-muted-foreground">
                            Địa chỉ sẽ được lưu vào cơ sở dữ liệu sau quy đổi:
                          </p>
                          <div className="grid gap-2">
                            {conversionResult.candidates.map((cand, idx) => {
                              const isPicked = selectedCandidate?.ward.code === cand.ward.code;
                              return (
                                <button
                                  key={cand.ward.code || idx}
                                  type="button"
                                  onClick={() => setSelectedCandidate(cand)}
                                  className={`flex items-start justify-between rounded-md border p-2 text-left transition-all ${
                                    isPicked
                                      ? "border-accent bg-accent-subtle text-foreground"
                                      : "border-border bg-surface hover:border-accent/40"
                                  }`}
                                >
                                  <div>
                                    <p className="font-semibold text-foreground">
                                      {cand.ward.fullName || cand.ward.name}, {cand.province.fullName || cand.province.name}
                                    </p>
                                    <p className="font-mono text-[11px] text-muted-foreground">
                                      {street ? `${street}, ` : ""}{cand.ward.name}, {cand.province.name}
                                    </p>
                                  </div>
                                  {isPicked && <Check className="h-4 w-4 text-accent-hover shrink-0 mt-0.5" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-destructive">
                          Không tìm thấy quy hoạch sáp nhập tự động. Vui lòng chuyển sang tab &quot;Sau sáp nhập&quot; để chọn trực tiếp.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer hành động của Popup */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Lưu thông tin &amp; Địa chỉ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
