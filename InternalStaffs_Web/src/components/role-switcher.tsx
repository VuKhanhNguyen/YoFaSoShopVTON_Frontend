"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCOUNTS, ROLES, roleHome, useAuth, type Role } from "@/lib/auth";

/** Widget chuyển vai trò demo 1-chạm: avatar + tên + badge vai trò, đổi vai trò không cần đăng xuất. */
export function RoleSwitcher() {
  const { user, switchRole, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;
  const acc = ACCOUNTS[user.role] ?? ACCOUNTS.ROLE_SHOP_ADMIN;

  const pick = (role: Role) => {
    switchRole(role);
    setOpen(false);
    router.push(roleHome(role));
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        aria-label="Đổi vai trò demo"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-9 gap-2 rounded-full pl-1.5 pr-2"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
          {user.name.split(" ").slice(-1)[0]?.slice(0, 1) ?? "?"}
        </span>
        <span className="hidden text-xs font-semibold sm:inline">{user.name}</span>
        <span className="hidden rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-bold text-accent-hover md:inline">
          {acc.icon} {acc.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-modal">
          <p className="border-b border-border bg-accent-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-accent-hover">
            Chuyển vai trò tức thì (demo chấm điểm)
          </p>
          {ROLES.map((role) => {
            const a = ACCOUNTS[role];
            const active = role === user.role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => pick(role)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                  active ? "bg-accent-subtle" : ""
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{a.email}</span>
                </span>
                {active && <span className="h-2 w-2 rounded-full bg-success" aria-label="Đang dùng" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={async () => {
              await logout();
              setOpen(false);
              router.push("/login");
            }}
            className="flex w-full items-center gap-3 border-t border-border px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-danger-subtle"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất khỏi cổng vận hành
          </button>
        </div>
      )}
    </div>
  );
}
