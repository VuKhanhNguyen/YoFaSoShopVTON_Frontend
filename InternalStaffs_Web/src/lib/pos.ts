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
  sessionId?: string;
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
  sessionId?: string;
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
    return ds.map((d, k) =>
      k === i ? { ...d, soLuong: d.soLuong + 1, sessionId: p.sessionId ?? d.sessionId } : d
    );
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
      sessionId: p.sessionId,
    },
  ];
}

export const vnd = (n: number) => n.toLocaleString("vi-VN") + " đ";
