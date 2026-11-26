export type Row = Record<string, unknown>;

export type User = {
  userId: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string;
  gender?: "NAM" | "NU" | "KHAC" | string;
  roles: string[];
  linkedProviders?: string[];
  loyaltyPoints: number;
  membership: string;
  membershipLabel?: string;
  avatarUrl?: string | null;
  avatarDirectUrl?: string | null;
  avatarKey?: string | null;
};

export type Tokens = { accessToken: string; refreshToken: string; user: User };

export type OAuthProvider = "google" | "facebook";

export type LinkedAccountItem = {
  linkId: string;
  provider: "GOOGLE" | "FACEBOOK" | string;
  linkedAt: string;
};

export type OAuthLinkRequired = {
  status: "LINK_REQUIRED";
  linkToken: string;
  provider: "GOOGLE" | "FACEBOOK" | string;
  email: string;
  existingFullName: string;
  existingProviders: string[];
  message: string;
};

export type OAuthExchangeResponse =
  | (Tokens & { status: "AUTHENTICATED"; provider: string; isNewUser?: boolean })
  | OAuthLinkRequired
  | { status: "LINKED"; provider: string; linkedAccounts: LinkedAccountItem[] };

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
    role?: string;
  }[];
};

export type Review = {
  reviewId: string;
  stars: number;
  comment: string;
  shopReply?: string;
  status?: "CHO_DUYET" | "DA_HIEN_THI" | "DA_AN_VI_PHAM" | string;
  isOwn?: boolean;
  createdAt: string;
  photoUrl?: string | null;
  userName?: string;
  userAvatar?: string | null;
  size?: string;
  colorName?: string;
  sku?: string;
};

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export const money = (value: unknown) =>
  `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

export const text = (row: Row, key: string) => String(row[key] ?? "");

