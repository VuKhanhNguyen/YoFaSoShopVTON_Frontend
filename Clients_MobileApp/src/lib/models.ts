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
  shelf?: string;
  status: string;
};

export type ProductColor = {
  hex: string;
  name: string;
};

export type Product = {
  productId: string;
  name: string;
  coverUrl?: string;
  minPrice?: number;
  originalPrice?: number;
  hasDiscount?: boolean;
  discountPercent?: number;
  sku?: string;
  description: string;
  material: string;
  fit: string;
  waist?: string;
  length?: string;
  pattern?: string;
  vtonCategory: string;
  gender?: "NAM" | "NU" | "UNISEX" | string;
  subtype?: string;
  avgRating?: number;
  reviewCount?: number;
  soldCount?: number;
  colorSwatches?: ProductColor[];
  variants?: Variant[];
  images?: {
    imageId: string;
    originalUrl: string;
    cutoutUrl?: string | null;
    colors?: string;
    cover?: boolean;
    position?: number;
  }[];
};

export type Review = {
  reviewId: string;
  stars: number;
  comment: string;
  shopReply?: string;
  createdAt: string;
  photoUrl?: string;
  userName?: string;
  userAvatar?: string;
  size?: string;
  colorName?: string;
  sku?: string;
};

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export const money = (value: unknown) =>
  `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

export const text = (row: Row, key: string) => String(row[key] ?? "");

