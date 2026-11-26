"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { api, requestKey } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import { exportStockSlipPdf } from "@/lib/receipt-pdf";

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
      if (action === "approve") {
        onApproved();
        pushToast({ tone: "success", title: `Đã duyệt phiếu kiểm kê ${id} và cập nhật tồn kho` });
      } else {
        pushToast({ tone: "info", title: `Đã yêu cầu kho đếm lại phiếu ${id}` });
      }
    } catch (error) {
      pushToast({ tone: "error", title: error instanceof Error ? error.message : "Không thể xử lý phiếu." });
    } finally {
      setBusy(false);
    }
  }

  async function downloadAuditPdf(audit: Audit) {
    try {
      const statusLabel = { PENDING: "Chờ duyệt", APPROVED: "Đã ghi sổ", REJECTED: "Yêu cầu đếm lại" }[audit.status];
      const lines = [
        `Trạng thái phiếu: ${statusLabel}`,
        `Lý do giải trình: ${audit.reason || "—"}`,
        ...audit.lines.map(
          (l) => `Biến thể ${l.variantId} · Tồn sổ sách: ${l.book} · Thực đếm: ${l.counted} · Lệch: ${l.counted - l.book > 0 ? "+" : ""}${l.counted - l.book}`
        ),
      ];
      const filename = await exportStockSlipPdf("Phiếu Kiểm Kê & Điều Chỉnh Tồn Kho", lines, {
        docCode: audit.id,
        actor: audit.author,
      });
      pushToast({ tone: "success", title: "Đã tải phiếu kiểm kê (PDF A4)", detail: filename });
    } catch (err) {
      pushToast({ tone: "error", title: "Không thể xuất PDF phiếu kiểm kê", detail: err instanceof Error ? err.message : undefined });
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
          <div className="flex flex-wrap gap-2">
            {audit.status === "PENDING" && (
              <>
                <Button disabled={busy} onClick={() => void review(audit.id, "approve")}>Duyệt và ghi tồn</Button>
                <Button disabled={busy} variant="outline" onClick={() => void review(audit.id, "reject")}>Yêu cầu đếm lại</Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => void downloadAuditPdf(audit)} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Tải phiếu PDF (A4)
            </Button>
          </div>
        </details>
      ))}
    </section>
  );
}
