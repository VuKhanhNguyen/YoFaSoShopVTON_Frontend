"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { ContractForm, type Options } from "./ContractForm";
import { Modal } from "./ui";
export type Action = {
  title: string;
  path: string;
  method?: string;
  schema?: string;
  initial?: Record<string, unknown>;
  destructive?: boolean;
};
export function ActionDialog({
  action,
  onClose,
  onDone,
  options,
}: {
  action: Action;
  onClose: () => void;
  onDone: () => void;
  options?: Options;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(body?: Record<string, unknown>, key?: string) {
    await api(action.path, action.method || "POST", body, key);
    onDone();
    onClose();
  }
  return (
    <Modal title={action.title} onClose={onClose}>
      {action.schema ? (
        <ContractForm
          schemaName={action.schema}
          initial={action.initial}
          options={options}
          title={action.title}
          onSubmit={save}
        />
      ) : (
        <>
          <p>
            {action.destructive
              ? "Thao tác này sẽ thay đổi trạng thái dữ liệu. Vui lòng xác nhận trước khi tiếp tục."
              : "Xác nhận thực hiện thao tác với dữ liệu trên máy chủ."}
          </p>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void save()
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </>
      )}
    </Modal>
  );
}
