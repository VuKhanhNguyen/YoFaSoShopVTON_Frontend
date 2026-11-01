"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { roleHome, useAuth } from "@/lib/auth";

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(roleHome(user.role));
    }
  }, [ready, user, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas text-foreground">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="font-mono text-sm tracking-wide text-muted-foreground">
          Đang điều phối cổng vận hành YoFaSo…
        </span>
      </div>
    </div>
  );
}
