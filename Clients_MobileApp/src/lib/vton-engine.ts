/**
 * YoFaSo Shop — VTON Engine & Stylist 40-40-20 Scoring Rule
 * Implementation of Master Design System Section 5.1 & fromLovable vton algorithm
 */

import { SanPham, BienTheSanPham, SAN_PHAM_MOCK, tonKho, KichCo, KICH_CO } from "./catalog-data";

export type LoaiKhungAnhNguoi = "FULL_BODY" | "THREE_QUARTER" | "HALF_BODY" | "KHONG_HOP_LE";
export type XepHangThamMy = "RECOMMENDED" | "ACCEPTABLE" | "NEEDS_ADJUSTMENT" | "NOT_RECOMMENDED";

export interface DiemThanhPhan {
  tiLe: number;
  mauSac: number;
  hoaTiet: number;
  phat: number;
}

export interface MonDo {
  p: SanPham;
  b: BienTheSanPham;
}

export function khungTuTiLe(w: number, h: number): LoaiKhungAnhNguoi {
  if (!w || !h) return "KHONG_HOP_LE";
  const r = h / w;
  if (r >= 1.4) return "FULL_BODY";
  if (r >= 1.15) return "THREE_QUARTER";
  if (r >= 0.85) return "HALF_BODY";
  return "KHONG_HOP_LE";
}

export function khungHopLe(k: LoaiKhungAnhNguoi, loai: SanPham["loai"]): boolean {
  if (k === "KHONG_HOP_LE") return false;
  if (loai === "upper_body") return true;
  return k === "FULL_BODY";
}

export const diemTong = (d: DiemThanhPhan): number => {
  return Math.max(0, Math.min(100, Math.round(0.4 * d.tiLe + 0.4 * d.mauSac + 0.2 * d.hoaTiet - d.phat)));
};

export function xepHang(s: number): XepHangThamMy {
  if (s >= 88) return "RECOMMENDED";
  if (s >= 75) return "ACCEPTABLE";
  if (s >= 60) return "NEEDS_ADJUSTMENT";
  return "NOT_RECOMMENDED";
}

export const nhanXepHang: Record<XepHangThamMy, string> = {
  RECOMMENDED: "TÔN DÁNG XUẤT SẮC",
  ACCEPTABLE: "PHỐI HÀI HOÀ",
  NEEDS_ADJUSTMENT: "CẦN ĐIỀU CHỈNH",
  NOT_RECOMMENDED: "CHƯA PHÙ HỢP",
};

const getLightness = (hex: string): number => {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

export function chamDiem(chinh: MonDo, phu?: MonDo): DiemThanhPhan & { ghiChu: [string, string, string] } {
  if (!phu) {
    const isDress = chinh.p.loai === "dress";
    return {
      tiLe: isDress ? 94 : 82,
      mauSac: 88,
      hoaTiet: 92,
      phat: 0,
      ghiChu: [
        isDress ? "Đầm liền tạo đường nét cơ thể thanh thoát, liền mạch" : "Mặc đơn lẻ — nên phối thêm quần cạp cao để tôn tỉ lệ 1/3 - 2/3",
        "Màu sắc đơn sắc tinh tế, an toàn mọi ngữ cảnh",
        chinh.p.hoaTiet === "VAI_TRON" ? "Chất vải trơn cao cấp tối giản" : "Họa tiết tạo điểm nhấn vừa đủ",
      ],
    };
  }

  const hasHighWaist = Boolean(chinh.p.capCao || phu.p.capCao);
  const tiLe = hasHighWaist ? 98 : 88;
  const diff = Math.abs(getLightness(chinh.b.maMauHex) - getLightness(phu.b.maMauHex));
  const mauSac = diff > 0.55 ? 96 : diff > 0.25 ? 90 : 84;
  const countPattern = [chinh.p, phu.p].filter((x) => x.hoaTiet !== "VAI_TRON").length;
  const hoaTiet = countPattern === 0 ? 92 : countPattern === 1 ? 95 : 62;
  const phat = countPattern >= 2 ? 10 : 0;

  return {
    tiLe,
    mauSac,
    hoaTiet,
    phat,
    ghiChu: [
      hasHighWaist ? "Phối cạp cao hack dáng giúp đôi chân trông dài hơn rõ rệt (Tỉ lệ 1/3 - 2/3)" : "Tỉ lệ cân đối, có thể sơ vin để tôn thêm eo",
      diff > 0.55 ? `Bản phối tương phản ${chinh.b.tenMau} — ${phu.b.tenMau} đầy khí chất` : `Cặp sắc thái ${chinh.b.tenMau} — ${phu.b.tenMau} nhã nhặn, hài hòa`,
      countPattern === 0 ? "Vải trơn phối cùng vải trơn chuẩn phong cách Quiet Luxury" : countPattern === 1 ? "Một điểm nhấn họa tiết cân bằng thị giác hoàn hảo" : "Hai họa tiết cạnh tranh nhau làm giảm độ tinh tế (−10đ)",
    ],
  };
}

export function loiNhanXet(score: number): string {
  if (score >= 90) return "Bản phối đỉnh cao! Tỉ lệ chia chuẩn chỉnh, màu sắc bổ trợ và làm bật khí chất sang trọng của bạn.";
  if (score >= 75) return "Bản phối rất thanh lịch. Bạn có thể phối thêm một chiếc quần cạp cao hoặc sơ vin nhẹ để đôi chân trông dài hơn.";
  if (score >= 60) return "Bản phối khá ổn, nhưng nên điều chỉnh độ tương phản màu sắc hoặc chọn vải trơn để tăng vẻ sang trọng.";
  return "Bản phối này chưa tối ưu tỉ lệ vóc dáng — hãy thử gợi ý của Stylist bên dưới để cải thiện điểm số.";
}

export function goiYBanKem(chinh: MonDo, catalog: SanPham[] = SAN_PHAM_MOCK) {
  const targetTypes = chinh.p.loai === "upper_body" ? ["lower_body"] : ["upper_body"];
  return catalog
    .filter((p) => p.maSanPham !== chinh.p.maSanPham && targetTypes.includes(p.loai))
    .flatMap((p) => p.bienThe.map((b) => ({ p, b, diem: diemTong(chamDiem(chinh, { p, b })) })))
    .sort((a, b) => b.diem - a.diem)
    .filter((x, idx, arr) => arr.findIndex((y) => y.p.maSanPham === x.p.maSanPham) === idx)
    .slice(0, 4);
}
