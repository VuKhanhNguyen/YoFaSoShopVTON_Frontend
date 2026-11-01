"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { StaffNotificationPopover } from "@/components/staff-notifications";
import { RoleSwitcher } from "@/components/role-switcher";
import { useAuth } from "@/lib/auth";

/** Header dùng chung cho các phân hệ nội bộ: logo, tiêu đề, chuông thông báo, widget đổi vai trò. */
export function StaffHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { user } = useAuth();
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2">
      <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
        <Image
          src="/brand/logo.png"
          alt="YoFaSo Shop"
          width={110}
          height={36}
          className="h-8 w-auto object-contain"
          priority
        />
        <span className="text-base font-bold tracking-wide text-accent">{title}</span>
      </Link>
      {children}
      <div className="ml-auto flex items-center gap-2">
        {user && <StaffNotificationPopover role={user.role} />}
        <RoleSwitcher />
      </div>
    </header>
  );
}
