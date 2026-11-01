export type Row = Record<string, unknown>;
export type User = {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  roles: string[];
  loyaltyPoints: number;
  membership: string;
  avatarUrl?: string | null;
  avatarKey?: string | null;
};
export type Tokens = { accessToken: string; refreshToken: string; user: User };
export type Variant = {
  variantId: string;
  productId: string;
  sku: string;
  size: string;
  colorName: string;
  colors: string;
  price: number;
  salePrice: number | null;
  stock: number;
  status: string;
};
export type Product = {
  productId: string;
  name: string;
  coverUrl?: string;
  minPrice?: number;
  description: string;
  material: string;
  fit: string;
  vtonCategory: string;
  variants?: Variant[];
  images?: { imageId: string; originalUrl: string }[];
};
export type Page<T> = { items: T[]; total: number; page: number; size: number };
export const money = (value: unknown) =>
  `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
export const text = (row: Row, key: string) => String(row[key] ?? "");
