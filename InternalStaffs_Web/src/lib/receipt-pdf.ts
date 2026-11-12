import { jsPDF } from "jspdf";
import { type Order } from "./pos-workflows";
import { vnd, thanhTien } from "./pos";
import { vnLabel } from "./vietnamese-labels";

/**
 * Định dạng tên file PDF hóa đơn theo công thức yêu cầu:
 * {mã đơn hàng} - ngày tháng năm format ddmmyyyy - giờ format hhmm
 * Ví dụ: DH00000023-31102026-1530.pdf
 */
export function getReceiptPdfFilename(order: Order): string {
  const code = String(order.orderId || order.id || "POS").replace(/^#/, "").replace(/[^a-zA-Z0-9_-]/g, "");
  const rawDate = order.created ? new Date(order.created) : new Date();
  const date = isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${code}-${dd}${mm}${yyyy}-${hh}${min}.pdf`;
}

/**
 * Xuất hóa đơn POS thành file PDF khổ 80mm chuẩn máy in nhiệt K80
 * và tự động tải về thư mục Downloads của máy tính (C:/Users/KHANH/Downloads).
 */
export async function exportReceiptPdf(order: Order): Promise<string> {
  const filename = getReceiptPdfFilename(order);
  const displayId = String(order.orderId || order.id || "").replace(/^#?POS-/, "");
  const orderCode = displayId.startsWith("DH") ? displayId : `#POS-${displayId}`;

  // Chuẩn bị Canvas vẽ độ phân giải cao (~200 DPI cho khổ giấy 80mm)
  const canvas = document.createElement("canvas");
  const widthPx = 560; // 560px tương ứng 70-80mm khi in
  canvas.width = widthPx;
  
  // Tính toán sơ bộ chiều cao canvas
  const linesCount = (order.lines || []).length;
  const estimatedHeight = 620 + linesCount * 50;
  canvas.height = Math.max(750, estimatedHeight);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể khởi tạo Canvas 2D");

  // Nền trắng tinh
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  let y = 24;

  // 1. Header Shop
  ctx.font = "bold 22px 'Courier New', monospace, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("YOFASO SHOP", widthPx / 2, y);
  y += 28;

  ctx.font = "11px 'Courier New', monospace, sans-serif";
  ctx.fillText("THỜI TRANG THÔNG MINH & VTON", widthPx / 2, y);
  y += 18;
  ctx.fillText("48 Cao Thắng, Q. Hải Châu, TP. Đà Nẵng", widthPx / 2, y);
  y += 16;
  ctx.fillText("Hotline: 0905.123.456", widthPx / 2, y);
  y += 22;

  ctx.font = "bold 16px 'Courier New', monospace, sans-serif";
  ctx.fillText(orderCode, widthPx / 2, y);
  y += 24;

  // Đường gạch đứt ngăn cách
  const drawDashedLine = (currY: number) => {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, currY);
    ctx.lineTo(widthPx - 20, currY);
    ctx.stroke();
    ctx.restore();
  };

  drawDashedLine(y);
  y += 12;

  // 2. Thông tin đơn hàng
  ctx.textAlign = "left";
  ctx.font = "12px 'Courier New', monospace, sans-serif";

  const cashierName = order.cashierId && order.cashierId !== "NV-REAL" ? order.cashierId : "Quầy Thu Ngân POS";
  ctx.fillText(`Thu ngân: ${cashierName}`, 24, y);
  y += 18;

  if (order.customerName) {
    ctx.fillText(`Khách hàng: ${order.customerName}`, 24, y);
    y += 18;
  }

  ctx.fillText(`Kênh bán: ${vnLabel(order.channel || "TAI_QUAY_POS")}`, 24, y);
  y += 18;

  const orderDate = (() => {
    try {
      const d = new Date(order.created);
      return isNaN(d.getTime()) ? new Date().toLocaleString("vi-VN") : d.toLocaleString("vi-VN");
    } catch {
      return new Date().toLocaleString("vi-VN");
    }
  })();
  ctx.fillText(`Thời gian: ${orderDate}`, 24, y);
  y += 18;

  ctx.fillText(`Trạng thái: ${vnLabel(order.status || "HOAN_TAT")}`, 24, y);
  y += 20;

  drawDashedLine(y);
  y += 14;

  // 3. Tiêu đề bảng sản phẩm
  ctx.font = "bold 12px 'Courier New', monospace, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Tên hàng / SL × Giá", 24, y);
  ctx.textAlign = "right";
  ctx.fillText("Thành tiền", widthPx - 24, y);
  y += 18;

  drawDashedLine(y);
  y += 12;

  // 4. Danh sách mặt hàng
  ctx.font = "12px 'Courier New', monospace, sans-serif";
  for (const item of order.lines || []) {
    ctx.textAlign = "left";
    const title = `${item.ten} ${item.size ? `(${item.size})` : ""}`;
    ctx.fillText(title.slice(0, 32), 24, y);
    y += 16;

    ctx.fillStyle = "#555555";
    ctx.fillText(`${item.soLuong} × ${vnd(item.donGia)}`, 24, y);
    ctx.fillStyle = "#000000";

    ctx.textAlign = "right";
    ctx.font = "bold 12px 'Courier New', monospace, sans-serif";
    ctx.fillText(vnd(thanhTien(item)), widthPx - 24, y);
    ctx.font = "12px 'Courier New', monospace, sans-serif";
    y += 20;
  }

  drawDashedLine(y);
  y += 14;

  // 5. Tổng kết thanh toán
  const totalDue = order.total ?? (order.lines || []).reduce((s, l) => s + thanhTien(l), 0);
  
  if (order.discount && order.discount > 0) {
    ctx.textAlign = "left";
    ctx.fillText("Giảm giá voucher/điểm:", 24, y);
    ctx.textAlign = "right";
    ctx.fillText(`-${vnd(order.discount)}`, widthPx - 24, y);
    y += 18;
  }

  ctx.textAlign = "left";
  ctx.font = "bold 14px 'Courier New', monospace, sans-serif";
  ctx.fillText("TỔNG CỘNG:", 24, y);
  ctx.textAlign = "right";
  ctx.fillText(vnd(totalDue), widthPx - 24, y);
  y += 22;

  ctx.font = "12px 'Courier New', monospace, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Phương thức:", 24, y);
  ctx.textAlign = "right";
  const methodLabel = order.method === "CASH" ? "Tiền mặt tại quầy" : order.method === "QR" ? "VietQR Napas247" : "Thẻ POS";
  ctx.fillText(methodLabel, widthPx - 24, y);
  y += 18;

  if (order.method === "CASH" && order.tendered) {
    ctx.textAlign = "left";
    ctx.fillText("Khách đưa:", 24, y);
    ctx.textAlign = "right";
    ctx.fillText(vnd(order.tendered), widthPx - 24, y);
    y += 18;

    const change = Math.max(0, order.tendered - totalDue);
    ctx.textAlign = "left";
    ctx.fillText("Tiền thối lại:", 24, y);
    ctx.textAlign = "right";
    ctx.font = "bold 12px 'Courier New', monospace, sans-serif";
    ctx.fillText(vnd(change), widthPx - 24, y);
    ctx.font = "12px 'Courier New', monospace, sans-serif";
    y += 20;
  }

  drawDashedLine(y);
  y += 18;

  // 6. QR Code từ DOM (nếu có)
  const existingSvg = document.querySelector(".receipt svg");
  if (existingSvg) {
    try {
      const svgXml = new XMLSerializer().serializeToString(existingSvg);
      const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgXml)));
      const qrImg = new Image();
      await new Promise<void>((resolve) => {
        qrImg.onload = () => {
          const qrSize = 96;
          ctx.drawImage(qrImg, (widthPx - qrSize) / 2, y, qrSize, qrSize);
          y += qrSize + 12;
          resolve();
        };
        qrImg.onerror = () => resolve();
        qrImg.src = svgBase64;
      });
    } catch {
      // Bỏ qua lỗi render SVG
    }
  }

  // 7. Footer
  ctx.textAlign = "center";
  ctx.font = "10px 'Courier New', monospace, sans-serif";
  ctx.fillStyle = "#666666";
  ctx.fillText("Quét mã để xem lại ảnh thử đồ VTON", widthPx / 2, y);
  y += 14;
  ctx.fillText("& Đổi trả trong 7 ngày", widthPx / 2, y);
  y += 16;
  ctx.fillText("Cảm ơn quý khách và hẹn gặp lại!", widthPx / 2, y);
  y += 20;

  // Cắt canvas theo chiều cao thực tế
  const actualHeight = Math.max(300, y);
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = widthPx;
  trimmedCanvas.height = actualHeight;
  const tCtx = trimmedCanvas.getContext("2d");
  if (tCtx) {
    tCtx.drawImage(canvas, 0, 0, widthPx, actualHeight, 0, 0, widthPx, actualHeight);
  }

  // Đổi sang mm cho jsPDF (khổ rộng 80mm)
  const heightMm = Math.round((actualHeight / widthPx) * 80);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, heightMm],
  });

  const imgData = trimmedCanvas.toDataURL("image/png");
  pdf.addImage(imgData, "PNG", 0, 0, 80, heightMm);

  // Kích hoạt tải tự động vào thư mục Downloads mặc định của trình duyệt
  pdf.save(filename);
  return filename;
}
