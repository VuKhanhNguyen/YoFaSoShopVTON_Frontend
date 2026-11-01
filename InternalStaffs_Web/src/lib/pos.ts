// Pure POS cart logic. Totals are always derived, never stored (ERD rule).
export type BienThe = {
  maQuanLy: string; // MaQuanLyHangHoa (barcode)
  sku: string;
  ten: string;
  nhom: "AO" | "QUAN" | "VAY" | "DAM";
  size: string;
  mau: string;
  donGia: number;
  ton: number; // SoLuongTonKho (Single Pool)
  img: string;
};

export type Dong = {
  maQuanLy: string;
  sku: string;
  ten: string;
  size: string;
  mau: string;
  donGia: number;
  soLuong: number;
};

export const thanhTien = (d: Dong) => d.soLuong * d.donGia;
export const tongTienHang = (ds: Dong[]) => ds.reduce((s, d) => s + thanhTien(d), 0);
export const tongThanhToan = (ds: Dong[], giam: number) => Math.max(0, tongTienHang(ds) - giam);

export function themVaoDon(ds: Dong[], p: BienThe): Dong[] {
  const i = ds.findIndex((d) => d.maQuanLy === p.maQuanLy);
  if (i >= 0) {
    const existing = ds[i];
    if (!existing || existing.soLuong >= p.ton) return ds;
    return ds.map((d, k) => (k === i ? { ...d, soLuong: d.soLuong + 1 } : d));
  }
  if (p.ton <= 0) return ds;
  return [
    ...ds,
    {
      maQuanLy: p.maQuanLy,
      sku: p.sku,
      ten: p.ten,
      size: p.size,
      mau: p.mau,
      donGia: p.donGia,
      soLuong: 1,
    },
  ];
}

export const VOUCHERS: Record<string, { label: string; tinh: (tong: number) => number }> = {
  YOFASO50: { label: "Giảm 50.000 đ", tinh: () => 50000 },
  VIP10: { label: "Chiết khấu 10%", tinh: (t) => Math.round(t * 0.1) },
};

export const vnd = (n: number) => n.toLocaleString("vi-VN") + " đ";
