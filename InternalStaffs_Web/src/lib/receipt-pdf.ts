import { jsPDF } from "jspdf";
import { type Order } from "./pos-workflows";
import { type BienThe, vnd, thanhTien } from "./pos";
import { type PickGroup, type WhOrder } from "./warehouse";
import { vnLabel } from "./vietnamese-labels";

const FONT_SANS = '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';
const FONT_MONO = '"JetBrains Mono", Consolas, "Courier New", monospace';

function formatStamp(raw?: string | Date): { dd: string; mm: string; yyyy: number; hh: string; min: string; display: string } {
  const parsed = raw ? new Date(raw) : new Date();
  const date = isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dd: pad(date.getDate()),
    mm: pad(date.getMonth() + 1),
    yyyy: date.getFullYear(),
    hh: pad(date.getHours()),
    min: pad(date.getMinutes()),
    display: date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
  };
}

/**
 * Định dạng tên file PDF hóa đơn:
 * {mã đơn hàng}-{ddmmyyyy}-{hhmm}.pdf
 */
export function getReceiptPdfFilename(order: Order): string {
  const code = String(order.orderId || order.id || "POS").replace(/^#/, "").replace(/[^a-zA-Z0-9_-]/g, "");
  const s = formatStamp(order.created);
  return `${code}-${s.dd}${s.mm}${s.yyyy}-${s.hh}${s.min}.pdf`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      if (ctx.measureText(word).width <= maxWidth) {
        cur = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        cur = chunk;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1.5
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, dashed = false, color = "#cbd5e1") {
  ctx.save();
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

async function drawSvgSelector(
  ctx: CanvasRenderingContext2D,
  selector: string,
  x: number,
  y: number,
  size: number
): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const svg = document.querySelector(selector);
  if (!svg) return false;
  try {
    const svgXml = new XMLSerializer().serializeToString(svg);
    const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgXml)));
    const img = new Image();
    return await new Promise<boolean>((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, x, y, size, size);
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = svgBase64;
    });
  } catch {
    return false;
  }
}

function drawBarcode1D(ctx: CanvasRenderingContext2D, code: string, centerX: number, y: number, maxW: number, h: number) {
  const bars: number[] = [];
  for (let i = 0; i < Math.max(code.length * 3, 24); i++) {
    const c = code.charCodeAt(i % code.length);
    bars.push(((c * (i + 7)) % 4) + 1);
  }
  const unitSum = bars.reduce((a, b) => a + b + 1.2, 0);
  const scale = Math.min(4.2, maxW / Math.max(unitSum, 1));
  const totalW = unitSum * scale;
  let curX = centerX - totalW / 2;
  ctx.save();
  ctx.fillStyle = "#0f172a";
  for (const w of bars) {
    ctx.fillRect(curX, y, w * scale, h);
    curX += (w + 1.2) * scale;
  }
  ctx.restore();
}

function saveMultiPageCanvas(
  canvas: HTMLCanvasElement,
  pageWmm: number,
  pageHmm: number,
  filename: string
): string {
  const pagePxH = Math.round((canvas.width * pageHmm) / pageWmm);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWmm, pageHmm],
  });

  if (canvas.height <= pagePxH) {
    // Center vertically with gentle top bias when content is shorter than 1 page
    const outCanvas = document.createElement("canvas");
    outCanvas.width = canvas.width;
    outCanvas.height = pagePxH;
    const octx = outCanvas.getContext("2d");
    if (octx) {
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      const topOffset = Math.min(Math.round((pagePxH - canvas.height) * 0.3), 140);
      octx.drawImage(canvas, 0, Math.max(0, topOffset));
    }
    pdf.addImage(outCanvas.toDataURL("image/png"), "PNG", 0, 0, pageWmm, pageHmm);
  } else {
    let offsetY = 0;
    let pageIdx = 0;
    while (offsetY < canvas.height) {
      if (pageIdx > 0) pdf.addPage([pageWmm, pageHmm], "portrait");
      const sliceH = Math.min(pagePxH, canvas.height - offsetY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = pagePxH;
      const pctx = pageCanvas.getContext("2d");
      if (pctx) {
        pctx.fillStyle = "#ffffff";
        pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, pageWmm, pageHmm);
      offsetY += pagePxH;
      pageIdx++;
    }
  }

  pdf.save(filename);
  return filename;
}

/**
 * 1) Xuất hóa đơn POS khổ A5 dọc (148 × 210mm) căn giữa chuyên nghiệp,
 * tự động tải về thư mục Downloads của trình duyệt.
 */
export async function exportReceiptPdf(order: Order): Promise<string> {
  const filename = getReceiptPdfFilename(order);
  const displayId = String(order.orderId || order.id || "").replace(/^#?POS-/, "");
  const orderCode = displayId.startsWith("DH") ? displayId : `#POS-${displayId}`;
  const stamp = formatStamp(order.created);

  const W = 1184; // A5 portrait at ~203 DPI (148mm × 210mm => 1184 × 1680)
  const padX = 88;
  const cardX = padX;
  const cardW = W - padX * 2;
  const innerL = cardX + 48;
  const innerR = cardX + cardW - 48;
  const innerW = innerR - innerL;

  const lines = order.lines || [];
  const estH = Math.max(1500, 1080 + lines.length * 76 + (order.discountDetails?.length || 0) * 34);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = estH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  let y = 64;
  const cardTop = y - 16;
  y += 28;

  // Brand header
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 40px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.fillText("YOFASO SHOP", W / 2, y);
  y += 50;

  ctx.fillStyle = "#8a6d3b";
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.fillText("THỜI TRANG THÔNG MINH & THỬ ĐỒ ẢO VTON", W / 2, y);
  y += 30;

  ctx.fillStyle = "#475569";
  ctx.font = `400 18px ${FONT_SANS}`;
  ctx.fillText("48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng · Hotline: 0905.123.456", W / 2, y);
  y += 36;

  // Title pill
  const pillW = 460;
  drawRoundedRect(ctx, (W - pillW) / 2, y, pillW, 54, 12, "#f8f5ef", "#c5a880", 2);
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillText(`HÓA ĐƠN BÁN LẺ · ${orderCode}`, W / 2, y + 14);
  y += 76;

  // Metadata grid box
  const cashierName = order.cashierId && order.cashierId !== "NV-REAL" ? order.cashierId : "Quầy Thu Ngân POS";
  const metaRows: [string, string][] = [
    ["Thu ngân:", cashierName],
    ["Khách hàng:", order.customerName ? `${order.customerName}${order.customerPhone ? ` (${order.customerPhone})` : ""}` : "Khách lẻ tại quầy"],
    ["Kênh bán:", vnLabel(order.channel || "TAI_QUAY_POS")],
    ["Thời gian:", stamp.display],
    ["Trạng thái:", vnLabel(order.status || "HOAN_TAT")],
  ];
  const metaH = metaRows.length * 32 + 24;
  drawRoundedRect(ctx, innerL, y, innerW, metaH, 10, "#f8fafc", "#e2e8f0", 1.5);
  let my = y + 14;
  for (const [k, v] of metaRows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = `600 19px ${FONT_SANS}`;
    ctx.fillText(k, innerL + 20, my);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 19px ${FONT_SANS}`;
    ctx.fillText(v, innerR - 20, my);
    my += 32;
  }
  y += metaH + 28;

  // Items table header
  drawRoundedRect(ctx, innerL, y, innerW, 44, 8, "#0f172a");
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 18px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("SẢN PHẨM / PHÂN LOẠI", innerL + 16, y + 12);
  ctx.textAlign = "center";
  ctx.fillText("SL", innerR - 260, y + 12);
  ctx.textAlign = "right";
  ctx.fillText("ĐƠN GIÁ", innerR - 140, y + 12);
  ctx.fillText("THÀNH TIỀN", innerR - 16, y + 12);
  y += 54;

  // Items rows
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    const nameLines = wrapText(ctx, item.ten || "Sản phẩm", innerW - 360);
    const subLine = [item.sku, item.size ? `Size ${item.size}` : "", item.mau].filter(Boolean).join(" · ");
    const rowH = Math.max(58, nameLines.length * 24 + 30);

    if (i % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(innerL, y - 4, innerW, rowH);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 19px ${FONT_SANS}`;
    let ty = y + 4;
    for (const nl of nameLines) {
      ctx.fillText(nl, innerL + 16, ty);
      ty += 24;
    }
    ctx.fillStyle = "#64748b";
    ctx.font = `400 15px ${FONT_MONO}`;
    ctx.fillText(subLine, innerL + 16, ty);

    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 19px ${FONT_MONO}`;
    ctx.fillText(String(item.soLuong), innerR - 260, y + 14);

    ctx.textAlign = "right";
    ctx.fillStyle = "#475569";
    ctx.font = `400 18px ${FONT_MONO}`;
    ctx.fillText(vnd(item.donGia), innerR - 140, y + 14);

    ctx.fillStyle = "#0f172a";
    ctx.font = `700 19px ${FONT_MONO}`;
    ctx.fillText(vnd(thanhTien(item)), innerR - 16, y + 14);

    y += rowH;
    drawRule(ctx, innerL, innerR, y - 2, false, "#e2e8f0");
  }
  y += 18;

  // Summary block
  const subtotal = lines.reduce((s, l) => s + thanhTien(l), 0);
  const totalDue = order.total ?? Math.max(0, subtotal - (order.discount || 0));

  const drawSummaryRow = (label: string, val: string, color = "#0f172a", bold = false, size = 20) => {
    ctx.textAlign = "left";
    ctx.fillStyle = color === "#0f172a" && !bold ? "#475569" : color;
    ctx.font = `${bold ? 700 : 500} ${size}px ${FONT_SANS}`;
    ctx.fillText(label, innerL + 16, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = `${bold ? 700 : 600} ${size}px ${FONT_MONO}`;
    ctx.fillText(val, innerR - 16, y);
    y += size + 14;
  };

  drawSummaryRow("Tạm tính tiền hàng", vnd(subtotal));

  if (order.discountDetails && order.discountDetails.length > 0) {
    for (const d of order.discountDetails) {
      drawSummaryRow(d.label, `-${vnd(d.amount)}`, "#dc2626", false, 18);
    }
  } else if (order.discount && order.discount > 0) {
    drawSummaryRow("Giảm giá / Ưu đãi", `-${vnd(order.discount)}`, "#dc2626", false, 19);
  }

  drawRule(ctx, innerL, innerR, y + 2, true, "#94a3b8");
  y += 16;

  drawSummaryRow("TỔNG THANH TOÁN", vnd(totalDue), "#0f172a", true, 26);

  const methodLabel =
    order.method === "CASH" ? "Tiền mặt tại quầy" : order.method === "QR" ? "VietQR Napas247" : "Thẻ POS";
  drawSummaryRow("Phương thức thanh toán", methodLabel, "#334155", false, 18);

  if (order.method === "CASH" && order.tendered) {
    drawSummaryRow("Tiền khách đưa", vnd(order.tendered), "#334155", false, 18);
    drawSummaryRow("Tiền thối lại", vnd(Math.max(0, order.tendered - totalDue)), "#059669", true, 20);
  }

  y += 12;
  drawRule(ctx, innerL, innerR, y, true, "#cbd5e1");
  y += 22;

  // QR code centered
  const drewQr = await drawSvgSelector(ctx, ".receipt svg", (W - 144) / 2, y, 144);
  if (drewQr) {
    y += 158;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.font = `500 17px ${FONT_SANS}`;
  ctx.fillText("Quét mã để xem lại lịch sử thử đồ VTON & Hỗ trợ đổi trả trong 7 ngày", W / 2, y);
  y += 28;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 19px ${FONT_SANS}`;
  ctx.fillText("Cảm ơn quý khách đã mua sắm tại YoFaSo Shop!", W / 2, y);
  y += 48;

  // Draw crisp outer frame around card
  drawRoundedRect(ctx, cardX, cardTop, cardW, y - cardTop, 18, undefined, "#cbd5e1", 2.5);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = W;
  finalCanvas.height = y + 48;
  const fctx = finalCanvas.getContext("2d")!;
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  fctx.drawImage(canvas, 0, 0);

  return saveMultiPageCanvas(finalCanvas, 148, 210, filename);
}

/**
 * 2) Xuất Phiếu Nhặt Hàng Tổng Hợp (Pick List) khổ A4 dọc (210 × 297mm) căn giữa.
 */
export async function exportPickListPdf(orders: WhOrder[], groups: PickGroup[]): Promise<string> {
  const stamp = formatStamp();
  const filename = `PickList-${stamp.dd}${stamp.mm}${stamp.yyyy}-${stamp.hh}${stamp.min}.pdf`;
  const W = 1680; // A4 portrait at ~203 DPI (1680 × 2376)
  const padX = 110;
  const contentW = W - padX * 2;
  const totalItems = groups.reduce((s, g) => s + g.items.reduce((x, i) => x + i.qty, 0), 0);
  const totalRows = groups.reduce((s, g) => s + g.items.length, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(2200, 950 + groups.length * 80 + totalRows * 74);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  let y = 90;
  // Centered Letterhead
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 38px ${FONT_SANS}`;
  ctx.fillText("YOFASO SHOP · TRUNG TÂM ĐIỀU PHỐI KHO", W / 2, y);
  y += 50;
  ctx.fillStyle = "#64748b";
  ctx.font = `500 20px ${FONT_SANS}`;
  ctx.fillText("48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng · Phân hệ Kho bãi (RBAC — Ẩn đơn giá)", W / 2, y);
  y += 42;
  drawRule(ctx, padX, W - padX, y, false, "#0f172a");
  y += 32;

  ctx.fillStyle = "#0f172a";
  ctx.font = `700 34px ${FONT_SANS}`;
  ctx.fillText("PHIẾU NHẶT HÀNG TỔNG HỢP (PICK LIST)", W / 2, y);
  y += 46;
  ctx.fillStyle = "#475569";
  ctx.font = `500 20px ${FONT_MONO}`;
  ctx.fillText(`Thời gian xuất: ${stamp.display}  ·  ${orders.length} đơn hàng  ·  Tổng ${totalItems} sản phẩm`, W / 2, y);
  y += 44;

  // Order list box
  const orderIdsStr = orders.map((o) => `#${o.id}`).join(", ");
  const orderLines = wrapText(ctx, `Danh sách đơn: ${orderIdsStr || "—"}`, contentW - 40);
  const boxH = orderLines.length * 28 + 26;
  drawRoundedRect(ctx, padX, y, contentW, boxH, 10, "#f8fafc", "#cbd5e1", 1.5);
  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = `600 19px ${FONT_MONO}`;
  let oy = y + 14;
  for (const ol of orderLines) {
    ctx.fillText(ol, padX + 20, oy);
    oy += 28;
  }
  y += boxH + 34;

  // Groups
  for (const g of groups) {
    drawRoundedRect(ctx, padX, y, contentW, 48, 8, "#0f172a");
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = `700 21px ${FONT_SANS}`;
    ctx.fillText(`DÃY KỆ ${g.shelf.day} · KỆ ${g.shelf.ke} · TẦNG ${g.shelf.tang}`, padX + 20, y + 13);
    y += 56;

    // Table header
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(padX, y, contentW, 40);
    ctx.fillStyle = "#334155";
    ctx.font = `700 17px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("KIỂM", padX + 42, y + 11);
    ctx.textAlign = "left";
    ctx.fillText("MÃ BARCODE / SKU", padX + 100, y + 11);
    ctx.fillText("TÊN HÀNG · SIZE · MÀU", padX + 430, y + 11);
    ctx.fillText("CHO ĐƠN", padX + 1060, y + 11);
    ctx.textAlign = "right";
    ctx.fillText("SL LẤY", W - padX - 24, y + 11);
    y += 44;

    for (const item of g.items) {
      const nameLines = wrapText(ctx, `${item.ten} (Size ${item.size} · ${item.mau})`, 600);
      const rowH = Math.max(60, nameLines.length * 24 + 26);

      // Checkbox square
      drawRoundedRect(ctx, padX + 28, y + 14, 28, 28, 5, "#ffffff", "#0f172a", 2);

      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = `600 18px ${FONT_MONO}`;
      ctx.fillText(item.barcode, padX + 100, y + 18);

      ctx.font = `600 19px ${FONT_SANS}`;
      let ny = y + 14;
      for (const nl of nameLines) {
        ctx.fillText(nl, padX + 430, ny);
        ny += 24;
      }

      ctx.fillStyle = "#475569";
      ctx.font = `500 17px ${FONT_MONO}`;
      ctx.fillText(item.orderIds.map((id) => `#${id.slice(-4)}`).join(", "), padX + 1060, y + 18);

      ctx.textAlign = "right";
      ctx.fillStyle = "#8a6d3b";
      ctx.font = `700 24px ${FONT_MONO}`;
      ctx.fillText(`×${item.qty}`, W - padX - 24, y + 14);

      y += rowH;
      drawRule(ctx, padX, W - padX, y, false, "#e2e8f0");
    }
    y += 28;
  }

  // Signature block (2 centered columns)
  y = Math.max(y + 60, 1920);
  drawRule(ctx, padX, W - padX, y, true, "#cbd5e1");
  y += 36;
  const col1 = padX + contentW * 0.25;
  const col2 = padX + contentW * 0.75;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 21px ${FONT_SANS}`;
  ctx.fillText("NHÂN VIÊN NHẶT HÀNG", col1, y);
  ctx.fillText("TỔ TRƯỞNG ĐIỀU PHỐI KHO", col2, y);
  y += 30;
  ctx.fillStyle = "#64748b";
  ctx.font = `italic 17px ${FONT_SANS}`;
  ctx.fillText("(Ký và ghi rõ họ tên)", col1, y);
  ctx.fillText("(Ký và ghi rõ họ tên)", col2, y);
  y += 180;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = W;
  finalCanvas.height = Math.max(2376, y + 60);
  const fctx = finalCanvas.getContext("2d")!;
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  fctx.drawImage(canvas, 0, 0);

  return saveMultiPageCanvas(finalCanvas, 210, 297, filename);
}

/**
 * 3) Xuất Tem Vận Đơn khổ A6 chuẩn (105 × 148mm) căn giữa sắc nét.
 */
export async function exportWaybillPdf(order: WhOrder): Promise<string> {
  const stamp = formatStamp();
  const waybillCode = `YFS${order.id}`;
  const filename = `Waybill-${order.id}-${stamp.dd}${stamp.mm}${stamp.yyyy}-${stamp.hh}${stamp.min}.pdf`;

  const W = 840; // A6 portrait at ~203 DPI (105 × 148mm => 840 × 1184)
  const H = 1184;
  const margin = 44;
  const boxW = W - margin * 2;
  const innerL = margin + 28;
  const innerR = W - margin - 28;
  const innerW = innerR - innerL;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";

  // Crisp outer A6 label frame
  drawRoundedRect(ctx, margin, margin, boxW, H - margin * 2, 16, "#ffffff", "#0f172a", 4);

  let y = margin + 24;
  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 32px ${FONT_SANS}`;
  ctx.fillText("YoFaSo Shop", innerL, y);
  drawRoundedRect(ctx, innerR - 230, y + 2, 230, 36, 6, "#0f172a");
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `700 16px ${FONT_MONO}`;
  ctx.fillText("HÀNG THỜI TRANG", innerR - 115, y + 11);
  y += 56;
  drawRule(ctx, margin, W - margin, y, false, "#0f172a");
  y += 22;

  // Barcode 1D centered
  drawBarcode1D(ctx, waybillCode, W / 2, y, innerW - 40, 88);
  y += 100;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 28px ${FONT_MONO}`;
  ctx.fillText(waybillCode, W / 2, y);
  y += 44;
  drawRule(ctx, margin, W - margin, y, false, "#cbd5e1");
  y += 22;

  // Sender
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = `700 16px ${FONT_SANS}`;
  ctx.fillText("TỪ (NGƯỜI GỬI):", innerL, y);
  y += 24;
  ctx.fillStyle = "#0f172a";
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText("YoFaSo Shop · 02 Thanh Sơn, Hải Châu, Đà Nẵng", innerL, y);
  y += 36;
  drawRule(ctx, innerL, innerR, y, true, "#cbd5e1");
  y += 20;

  // Receiver + QR side by side
  const qrSize = 148;
  const textMaxW = innerW - qrSize - 24;
  const receiverStartY = y;

  ctx.fillStyle = "#64748b";
  ctx.font = `700 16px ${FONT_SANS}`;
  ctx.fillText("ĐẾN (NGƯỜI NHẬN):", innerL, y);
  y += 26;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 22px ${FONT_SANS}`;
  for (const l of wrapText(ctx, `${order.receiver} — ${order.phone}`, textMaxW)) {
    ctx.fillText(l, innerL, y);
    y += 28;
  }
  ctx.fillStyle = "#334155";
  ctx.font = `500 18px ${FONT_SANS}`;
  for (const l of wrapText(ctx, order.address || "Chưa có địa chỉ", textMaxW)) {
    ctx.fillText(l, innerL, y);
    y += 25;
  }

  await drawSvgSelector(ctx, ".waybill svg", innerR - qrSize, receiverStartY + 6, qrSize);
  y = Math.max(y, receiverStartY + qrSize + 18);
  y += 14;
  drawRule(ctx, margin, W - margin, y, false, "#cbd5e1");
  y += 20;

  // Contents
  ctx.fillStyle = "#64748b";
  ctx.font = `700 16px ${FONT_SANS}`;
  ctx.fillText("NỘI DUNG KIỆN HÀNG:", innerL, y);
  y += 26;
  const contentText = (order.lines || []).map((l) => `${l.ten} (Size ${l.size} · ${l.mau}) ×${l.qty}`).join("; ");
  ctx.fillStyle = "#0f172a";
  ctx.font = `500 18px ${FONT_SANS}`;
  for (const l of wrapText(ctx, contentText || "Hàng thời trang YoFaSo", innerW).slice(0, 5)) {
    ctx.fillText(l, innerL, y);
    y += 26;
  }

  // Prominent centered COD box anchored near bottom
  const codBoxY = H - margin - 210;
  drawRoundedRect(ctx, innerL, codBoxY, innerW, 120, 12, "#f8fafc", "#0f172a", 3);
  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.font = `700 18px ${FONT_SANS}`;
  ctx.fillText("TIỀN THU HỘ NGƯỜI NHẬN (COD)", W / 2, codBoxY + 18);
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 44px ${FONT_MONO}`;
  ctx.fillText(order.cod > 0 ? vnd(order.cod) : "0 đ (ĐÃ THANH TOÁN)", W / 2, codBoxY + 54);

  // Footer
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 17px ${FONT_SANS}`;
  ctx.fillText("Cho xem hàng, không cho thử · Thời trang YoFaSo Shop", W / 2, H - margin - 66);
  ctx.fillStyle = "#64748b";
  ctx.font = `400 14px ${FONT_MONO}`;
  ctx.fillText(`In lúc: ${stamp.display}`, W / 2, H - margin - 38);

  return saveMultiPageCanvas(canvas, 105, 148, filename);
}

/**
 * 4) Xuất Phiếu Xuất / Nhập Kho & Phiếu Nhận Hàng Hoàn khổ A4 dọc (210 × 297mm) căn giữa,
 * có bảng chi tiết & 2 cột chữ ký chuyên nghiệp.
 */
export async function exportStockSlipPdf(
  title: string,
  lines: string[],
  meta?: { docCode?: string; actor?: string }
): Promise<string> {
  const stamp = formatStamp();
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "PhieuKho";
  const filename = `${slug}-${stamp.dd}${stamp.mm}${stamp.yyyy}-${stamp.hh}${stamp.min}.pdf`;

  const W = 1680;
  const padX = 120;
  const contentW = W - padX * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(2376, 1100 + lines.length * 80);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  let y = 100;
  // Letterhead centered
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 40px ${FONT_SANS}`;
  ctx.fillText("YOFASO SHOP", W / 2, y);
  y += 50;
  ctx.fillStyle = "#8a6d3b";
  ctx.font = `600 19px ${FONT_MONO}`;
  ctx.fillText("HỆ THỐNG QUẢN LÝ KHO & TỒN KHO SINGLE POOL", W / 2, y);
  y += 32;
  ctx.fillStyle = "#64748b";
  ctx.font = `400 19px ${FONT_SANS}`;
  ctx.fillText("48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng · Hotline: 0905.123.456", W / 2, y);
  y += 42;
  drawRule(ctx, padX, W - padX, y, false, "#0f172a");
  y += 44;

  // Document title centered
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 36px ${FONT_SANS}`;
  ctx.fillText(title.toUpperCase(), W / 2, y);
  y += 54;

  // Document metadata box
  const metaRows: [string, string][] = [
    ["Số chứng từ:", meta?.docCode || `PK-${stamp.dd}${stamp.mm}${stamp.yyyy}-${stamp.hh}${stamp.min}`],
    ["Ngày lập phiếu:", stamp.display],
    ["Đơn vị / Nhân sự lập:", meta?.actor || "Bộ phận Kho vận YoFaSo"],
  ];
  const metaH = metaRows.length * 38 + 28;
  drawRoundedRect(ctx, padX, y, contentW, metaH, 12, "#f8fafc", "#cbd5e1", 1.5);
  let my = y + 16;
  for (const [k, v] of metaRows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = `600 20px ${FONT_SANS}`;
    ctx.fillText(k, padX + 26, my);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 20px ${FONT_MONO}`;
    ctx.fillText(v, W - padX - 26, my);
    my += 38;
  }
  y += metaH + 40;

  // Table header
  drawRoundedRect(ctx, padX, y, contentW, 50, 8, "#0f172a");
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 19px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.fillText("STT", padX + 46, y + 15);
  ctx.textAlign = "left";
  ctx.fillText("NỘI DUNG CHI TIẾT CHỨNG TỪ / HÀNG HÓA", padX + 116, y + 15);
  y += 58;

  const safeLines = lines.length > 0 ? lines : ["Không có dòng chi tiết."];
  for (let i = 0; i < safeLines.length; i++) {
    const wrapped = wrapText(ctx, safeLines[i], contentW - 148);
    const rowH = Math.max(58, wrapped.length * 28 + 26);
    if (i % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(padX, y, contentW, rowH);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#64748b";
    ctx.font = `700 19px ${FONT_MONO}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), padX + 46, y + 16);

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = `500 20px ${FONT_SANS}`;
    let ty = y + 14;
    for (const wl of wrapped) {
      ctx.fillText(wl, padX + 116, ty);
      ty += 28;
    }
    y += rowH;
    drawRule(ctx, padX, W - padX, y, false, "#e2e8f0");
  }

  // Two centered signature blocks anchored cleanly
  y = Math.max(y + 120, 1860);
  drawRule(ctx, padX, W - padX, y, true, "#cbd5e1");
  y += 44;

  const leftCol = padX + contentW * 0.25;
  const rightCol = padX + contentW * 0.75;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 22px ${FONT_SANS}`;
  ctx.fillText("NGƯỜI LẬP PHIẾU / THỦ KHO", leftCol, y);
  ctx.fillText("CHỦ SHOP / PHÊ DUYỆT", rightCol, y);
  y += 34;
  ctx.fillStyle = "#64748b";
  ctx.font = `italic 18px ${FONT_SANS}`;
  ctx.fillText("(Ký và ghi rõ họ tên)", leftCol, y);
  ctx.fillText("(Ký và ghi rõ họ tên)", rightCol, y);
  y += 220;

  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 16px ${FONT_MONO}`;
  ctx.fillText("Chứng từ tự động xuất từ YoFaSo Internal Operations Portal", W / 2, y);
  y += 50;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = W;
  finalCanvas.height = Math.max(2376, y + 60);
  const fctx = finalCanvas.getContext("2d")!;
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  fctx.drawImage(canvas, 0, 0);

  return saveMultiPageCanvas(finalCanvas, 210, 297, filename);
}

/**
 * 5) Xuất Phiếu Lấy Đồ Thử O2O khổ A5 dọc (148 × 210mm) căn giữa từ dữ liệu thật.
 */
export async function exportO2OPickingPdf(
  info: {
    sessionId?: string;
    customerName?: string;
    customerPhone?: string;
    score?: number;
    advice?: string;
    lookupLabel?: string;
  },
  items: BienThe[]
): Promise<string> {
  const stamp = formatStamp();
  const code = (info.sessionId || "O2O").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `PhieuLayDo-${code}-${stamp.dd}${stamp.mm}${stamp.yyyy}-${stamp.hh}${stamp.min}.pdf`;

  const W = 1184;
  const padX = 88;
  const cardW = W - padX * 2;
  const innerL = padX + 44;
  const innerR = padX + cardW - 44;
  const innerW = innerR - innerL;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(1680, 1020 + items.length * 88);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";

  let y = 70;
  const cardTop = y - 16;
  y += 24;

  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 36px ${FONT_SANS}`;
  ctx.fillText("YOFASO SHOP · PHIẾU LẤY ĐỒ THỬ O2O", W / 2, y);
  y += 48;
  ctx.fillStyle = "#8a6d3b";
  ctx.font = `600 18px ${FONT_MONO}`;
  ctx.fillText(
    info.sessionId
      ? `MÃ PHIÊN VTON: ${info.sessionId}${info.score ? ` · ĐIỂM AI: ${info.score}/100` : ""}`
      : info.lookupLabel || "TRA CỨU PHỐI ĐỒ TẠI QUẦY",
    W / 2,
    y
  );
  y += 38;

  // Info box
  const infoRows: [string, string][] = [
    ["Thời gian xuất:", stamp.display],
    ...(info.customerName ? [["Khách hàng:", `${info.customerName}${info.customerPhone ? ` (${info.customerPhone})` : ""}`] as [string, string]] : []),
    ["Tổng số món:", `${items.length} sản phẩm`],
  ];
  const infoH = infoRows.length * 32 + 24;
  drawRoundedRect(ctx, innerL, y, innerW, infoH, 10, "#f8fafc", "#cbd5e1", 1.5);
  let iy = y + 14;
  for (const [k, v] of infoRows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText(k, innerL + 18, iy);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText(v, innerR - 18, iy);
    iy += 32;
  }
  y += infoH + 22;

  if (info.advice) {
    const adviceLines = wrapText(ctx, `Stylist AI: "${info.advice}"`, innerW - 36);
    const aH = adviceLines.length * 24 + 22;
    drawRoundedRect(ctx, innerL, y, innerW, aH, 10, "#f8f5ef", "#c5a880", 1.5);
    ctx.textAlign = "left";
    ctx.fillStyle = "#5c4a26";
    ctx.font = `italic 17px ${FONT_SANS}`;
    let ay = y + 12;
    for (const al of adviceLines) {
      ctx.fillText(al, innerL + 18, ay);
      ay += 24;
    }
    y += aH + 24;
  }

  // Table header
  drawRoundedRect(ctx, innerL, y, innerW, 44, 8, "#0f172a");
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 17px ${FONT_SANS}`;
  ctx.textAlign = "left";
  ctx.fillText("SẢN PHẨM · SIZE · MÀU · SKU", innerL + 16, y + 13);
  ctx.textAlign = "center";
  ctx.fillText("VỊ TRÍ KỆ", innerR - 200, y + 13);
  ctx.textAlign = "right";
  ctx.fillText("GIÁ BÁN / TỒN", innerR - 16, y + 13);
  y += 54;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nameLines = wrapText(ctx, item.ten, innerW - 340);
    const rowH = Math.max(64, nameLines.length * 24 + 34);
    if (i % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(innerL, y - 2, innerW, rowH);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 19px ${FONT_SANS}`;
    let ny = y + 6;
    for (const nl of nameLines) {
      ctx.fillText(nl, innerL + 16, ny);
      ny += 24;
    }
    ctx.fillStyle = "#64748b";
    ctx.font = `500 15px ${FONT_MONO}`;
    ctx.fillText(`Size ${item.size} · ${item.mau} · ${item.sku}`, innerL + 16, ny + 2);

    // Shelf badge
    drawRoundedRect(ctx, innerR - 260, y + 12, 120, 34, 8, "#f8f5ef", "#c5a880", 1.5);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a6d3b";
    ctx.font = `700 17px ${FONT_MONO}`;
    ctx.fillText(item.shelf || "KHO-01", innerR - 200, y + 20);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 18px ${FONT_MONO}`;
    ctx.fillText(vnd(item.donGia), innerR - 16, y + 8);
    ctx.fillStyle = item.ton > 0 ? "#059669" : "#dc2626";
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.fillText(item.ton > 0 ? `Còn ${item.ton} chiếc` : "Hết hàng", innerR - 16, y + 34);

    y += rowH;
    drawRule(ctx, innerL, innerR, y, false, "#e2e8f0");
  }

  y += 38;
  ctx.textAlign = "center";
  ctx.fillStyle = "#64748b";
  ctx.font = `500 16px ${FONT_SANS}`;
  ctx.fillText("Nhân viên mang đồ vào phòng thử theo đúng vị trí giá kệ trên phiếu", W / 2, y);
  y += 46;

  drawRoundedRect(ctx, padX, cardTop, cardW, y - cardTop, 18, undefined, "#cbd5e1", 2.5);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = W;
  finalCanvas.height = y + 48;
  const fctx = finalCanvas.getContext("2d")!;
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  fctx.drawImage(canvas, 0, 0);

  return saveMultiPageCanvas(finalCanvas, 148, 210, filename);
}
