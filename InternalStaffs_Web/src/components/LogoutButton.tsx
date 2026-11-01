"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { logout } from "@/lib/api";
import { Modal } from "./ui";
export function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        <SignOut size={18} />
        Đăng xuất
      </button>
      {open && (
        <Modal
          title="Đăng xuất khỏi YoFaSo?"
          onClose={() => !busy && setOpen(false)}
        >
          <p>
            Bạn sẽ cần đăng nhập lại để tiếp tục công việc. Phiên đã ghi nhớ
            trên trình duyệt cũng được xóa.
          </p>
          <div className="table-actions">
            <button
              autoFocus
              className="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Ở lại
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void logout()
                  .catch(() => {})
                  .finally(() => router.replace("/login"));
              }}
            >
              {busy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
