"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportStockSlipPdf } from "@/lib/receipt-pdf";
import { pushToast } from "@/lib/feedback";

export function PrintStockSlip({
  title,
  lines,
  docCode,
  actor,
}: {
  title: string;
  lines: string[];
  docCode?: string;
  actor?: string;
}) {
  const [busy, setBusy] = useState(false);

  const handleDownloadPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const filename = await exportStockSlipPdf(title, lines, { docCode, actor });
      pushToast({
        tone: "success",
        title: "Đã xuất & tải phiếu kho (PDF A4)",
        detail: `Đã lưu tự động: ${filename}`,
      });
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Không thể xuất file PDF phiếu kho",
        detail: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" disabled={busy} onClick={() => void handleDownloadPdf()} className="mt-3 gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      {busy ? "Đang tạo PDF…" : "In phiếu / Lưu PDF (A4)"}
    </Button>
  );
}
