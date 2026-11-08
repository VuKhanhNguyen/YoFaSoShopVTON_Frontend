"use client";

import { useEffect, useState } from "react";
import { ACCOUNTS, useAuth } from "@/lib/auth";
import { ProfileModal } from "@/components/admin/profile-modal";
import { api } from "@/lib/api";

/**
 * Widget hiển thị cố định người dùng và vai trò (viên thuốc cố định có viền).
 * Tự động tải avatar thực từ Cloudflare R2 / Backend.
 * Bấm vào viên thuốc để mở xem/chỉnh sửa Hồ sơ cá nhân & Địa chỉ cho mọi vai trò nội bộ.
 */
export function RoleSwitcher() {
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchAvatar = () => {
      api<{
        avatarKey?: string;
        avatarUrl?: string;
        avatarDirectUrl?: string;
        userId?: string;
      }>("/me")
        .then((me) => {
          if (!active || !me) return;
          const proxy = me.avatarUrl
            ? `/api/backend${me.avatarUrl.replace(/^\/api\/v1/, "")}`
            : me.avatarKey && me.userId
            ? `/api/backend/users/${me.userId}/avatar`
            : null;
          const direct = me.avatarDirectUrl || null;
          if (direct) {
            setAvatarUrl(direct);
            setFallbackSrc(proxy);
          } else {
            setAvatarUrl(proxy);
            setFallbackSrc(null);
          }
          setAvatarError(false);
        })
        .catch(() => {});
    };

    fetchAvatar();

    const onAvatarUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ avatarUrl?: string }>;
      if (custom.detail?.avatarUrl) {
        setAvatarUrl(custom.detail.avatarUrl);
        setFallbackSrc(null);
        setAvatarError(false);
      } else {
        fetchAvatar();
      }
    };

    window.addEventListener("yofaso:avatar-updated", onAvatarUpdated);
    return () => {
      active = false;
      window.removeEventListener("yofaso:avatar-updated", onAvatarUpdated);
    };
  }, [user]);

  if (!user) return null;
  const acc = ACCOUNTS[user.role] ?? ACCOUNTS.ROLE_SHOP_ADMIN;

  return (
    <>
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        title="Xem và chỉnh sửa hồ sơ cá nhân"
        aria-label={`Người dùng hiện tại: ${user.name} - ${acc.label}. Bấm để xem và sửa hồ sơ cá nhân.`}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 shadow-xs transition-colors hover:border-accent hover:bg-surface-muted/60"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary font-mono text-[10px] font-bold text-primary-foreground">
          {avatarUrl && !avatarError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={user.name}
              className="h-full w-full object-cover"
              onError={() => {
                if (fallbackSrc && avatarUrl !== fallbackSrc) {
                  setAvatarUrl(fallbackSrc);
                  setFallbackSrc(null);
                } else {
                  setAvatarError(true);
                }
              }}
            />
          ) : (
            <span>{user.name.split(" ").slice(-1)[0]?.slice(0, 1) ?? "?"}</span>
          )}
        </span>
        <span className="hidden text-xs font-semibold text-foreground sm:inline">{user.name}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-bold text-accent-hover">
          <span aria-hidden>{acc.icon}</span> {acc.label}
        </span>
      </button>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

export const UserBadge = RoleSwitcher;
