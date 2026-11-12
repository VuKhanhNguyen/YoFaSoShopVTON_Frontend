// Pure POS cart logic. Totals are always derived, never stored (ERD rule).
export type BienThe = {
  variantId?: string; // MaBienThe in database (e.g. BT00000001)
  maQuanLy: string; // MaQuanLyHangHoa (barcode/SKU)
  sku: string;
  productId?: string;
  ten: string;
  nhom?: string; // Danh muc
  size: string;
  mau: string;
  donGia: number;
  ton: number; // SoLuongTonKho (Single Pool)
  img?: string;
  shelf?: string;
};

export type Dong = {
  variantId?: string;
  maQuanLy: string;
  sku: string;
  productId?: string;
  ten: string;
  size: string;
  mau: string;
  donGia: number;
  soLuong: number;
  ton?: number;
  shelf?: string;
};

export const thanhTien = (d: Dong) => d.soLuong * d.donGia;
export const tongTienHang = (ds: Dong[]) => ds.reduce((s, d) => s + thanhTien(d), 0);
export const tongThanhToan = (ds: Dong[], giam: number) => Math.max(0, tongTienHang(ds) - giam);

export function themVaoDon(ds: Dong[], p: BienThe): Dong[] {
  const i = ds.findIndex(
    (d) => (p.variantId && d.variantId && d.variantId === p.variantId) || d.maQuanLy === p.maQuanLy
  );
  if (i >= 0) {
    const existing = ds[i];
    if (!existing || existing.soLuong >= p.ton) return ds;
    return ds.map((d, k) => (k === i ? { ...d, soLuong: d.soLuong + 1 } : d));
  }
  if (p.ton <= 0) return ds;
  return [
    ...ds,
    {
      variantId: p.variantId,
      maQuanLy: p.maQuanLy,
      sku: p.sku,
      productId: p.productId,
      ten: p.ten,
      size: p.size,
      mau: p.mau,
      donGia: p.donGia,
      soLuong: 1,
      ton: p.ton,
      shelf: p.shelf,
    },
  ];
}

export const VOUCHERS: Record<string, { label: string; tinh: (tong: number) => number }> = {
  YOFASO10: { label: "Giảm 10% đơn từ 300k (tối đa 100k)", tinh: (t) => (t >= 300000 ? Math.min(100000, Math.round(t * 0.1)) : 0) },
  FREESHIP50: { label: "Miễn phí vận chuyển 30.000 đ", tinh: () => 30000 },
  YOFASO50: { label: "Giảm 50.000 đ", tinh: () => 50000 },
  VIP10: { label: "Chiết khấu 10%", tinh: (t) => Math.round(t * 0.1) },
};

export const vnd = (n: number) => n.toLocaleString("vi-VN") + " đ";
