"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { api, requestKey } from "@/lib/api";
import { pushToast } from "@/lib/feedback";

type Audit = {
  id: string;
  reason: string;
  author: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  lines: { variantId: string; book: number; counted: number }[];
};

export function InventoryAuditReview({ onApproved }: { onApproved: () => void }) {
  const audits = useResource<Audit[]>("/staff/inventory/audits");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ body: string; key: string }>();

  async function receive(form: HTMLFormElement) {
    const fields = new FormData(form);
    const body = {
      variantId: String(fields.get("variantId")).trim(),
      delta: Number(fields.get("quantity")),
      reason: String(fields.get("reason")).trim(),
      type: "NHAP_KHO_BO_SUNG",
    };
    const serialized = JSON.stringify(body);
    const key = receipt?.body === serialized ? receipt.key : requestKey();
    setReceipt({ body: serialized, key });
    setBusy(true);
    try {
      const result = await api<{ movementId: string }>("/staff/inventory/adjustments", "POST", body, key);
      pushToast({ tone: "success", title: "Đã nhập kho · " + result.movementId });
      form.reset();
      setReceipt(undefined);
      onApproved();
    } catch (error) {
      pushToast({ tone: "error", title: error instanceof Error ? error.message : "Không thể ghi phiếu nhập." });
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      await api("/staff/inventory/audits/" + id + "/" + action, "POST");
      audits.reload();
      if (action === "approve") onApproved();
    } catch (error) {
      pushToast({ tone: "error", title: error instanceof Error ? error.message : "Không thể xử lý phiếu." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 space-y-2 rounded-md border border-border p-3" aria-label="Phiếu kiểm kê">
      <details className="rounded border border-border p-2">
        <summary>Nhập hàng bổ sung</summary>
        <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(event) => {
          event.preventDefault();
          void receive(event.currentTarget);
        }}>
          <label className="grid gap-1">Mã biến thể<input className="rounded border p-2" name="variantId" maxLength={20} required /></label>
          <label className="grid gap-1">Số lượng thực nhận<input className="rounded border p-2" name="quantity" type="number" min={1} max={100000} required /></label>
          <label className="grid gap-1">Lý do / mã chứng từ<input className="rounded border p-2" name="reason" maxLength={255} required /></label>
          <Button type="submit" disabled={busy}>Xác nhận nhập kho</Button>
        </form>
      </details>
      {audits.loading && <p>Đang tải phiếu kiểm kê…</p>}
      {audits.error && <p role="alert">{audits.error} <Button onClick={audits.reload}>Thử lại</Button></p>}
      {audits.data?.length === 0 && <p>Chưa có phiếu kiểm kê.</p>}
      {audits.data?.map((audit) => (
        <details key={audit.id} className="rounded border border-border p-2">
          <summary>{audit.id} · {audit.author} · {{ PENDING: "Chờ duyệt", APPROVED: "Đã ghi sổ", REJECTED: "Yêu cầu đếm lại" }[audit.status]}</summary>
          <p className="my-2">{audit.reason}</p>
          <ul className="my-2">
            {audit.lines.map((line) => <li key={line.variantId}>{line.variantId} · Sổ {line.book} · Đếm {line.counted}</li>)}
          </ul>
          {audit.status === "PENDING" && <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void review(audit.id, "approve")}>Duyệt và ghi tồn</Button>
            <Button disabled={busy} variant="outline" onClick={() => void review(audit.id, "reject")}>Yêu cầu đếm lại</Button>
          </div>}
        </details>
      ))}
    </section>
  );
}
