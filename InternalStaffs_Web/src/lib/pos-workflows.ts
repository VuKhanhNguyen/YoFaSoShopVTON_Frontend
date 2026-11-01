import { type BienThe, type Dong, themVaoDon, tongThanhToan } from "@/lib/pos";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  tier: "DONG" | "BAC" | "VANG" | "KIM_CUONG";
  points: number;
  birthday: string;
  birthdayUsedYear?: number | undefined;
};

export const CUSTOMERS: Customer[] = [
  { id: "KH0001", name: "Trần Thu Hà", phone: "0912345789", tier: "KIM_CUONG", points: 1250, birthday: "1998-10-15" },
  { id: "KH0002", name: "Nguyễn Minh Anh", phone: "0905123456", tier: "BAC", points: 320, birthday: "1995-04-20" },
];

export function birthdayEligible(c: Customer, date: Date) {
  return Number(c.birthday.slice(5, 7)) === date.getMonth() + 1 && c.birthdayUsedYear !== date.getFullYear();
}

export function isBirthday(c: Customer, date: Date) {
  return Number(c.birthday.slice(5, 7)) === date.getMonth() + 1 && Number(c.birthday.slice(8, 10)) === date.getDate();
}

export function redeemedPoints(balance: number, requested: number, payable: number) {
  return Math.max(0, Math.min(500, Math.floor(balance), Math.floor(requested), Math.floor(payable / 100)));
}

export const birthdayDiscount = (total: number) => Math.round(total * 0.15);
export const cashChange = (due: number, tendered: number) => Math.max(0, tendered - due);
export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000] as const;
export const countCash = (counts: Record<number, number>) =>
  DENOMINATIONS.reduce((sum, d) => sum + d * Math.max(0, Math.floor(counts[d] || 0)), 0);
export const shiftVariance = (counts: Record<number, number>, opening: number, cashRevenue: number) =>
  countCash(counts) - (opening + cashRevenue);
export const canReturn = (created: string, now: Date) =>
  now.getTime() >= new Date(created).getTime() && now.getTime() - new Date(created).getTime() <= 7 * 86400000;

export type Method = "CASH" | "QR" | "CARD";

export type Order = {
  id: number;
  created: string;
  lines: Dong[];
  discount: number;
  pointsUsed: number;
  customerId?: string | undefined;
  method: Method;
  tendered: number;
  channel: "TAI_QUAY_POS";
  exchanges: { from: string; to: string; quantity: number; priceDifference: number; created: string }[];
};

export const orderDue = (order: Order) => tongThanhToan(order.lines, order.discount);

export function loadSet(lines: Dong[], products: BienThe[]): Dong[] | null {
  const required = new Map<string, number>();
  for (const p of products) required.set(p.maQuanLy, (required.get(p.maQuanLy) ?? 0) + 1);
  if (
    products.some(
      (p) =>
        (lines.find((d) => d.maQuanLy === p.maQuanLy)?.soLuong ?? 0) + (required.get(p.maQuanLy) ?? 0) > p.ton
    )
  )
    return null;
  return products.reduce((cart, p) => themVaoDon(cart, p), lines);
}

export function exchangeOrder(order: Order, catalog: BienThe[], fromCode: string, toCode: string, now: Date) {
  const line = order.lines.find((d) => d.maQuanLy === fromCode);
  const target = catalog.find((p) => p.maQuanLy === toCode);
  if (!canReturn(order.created, now) || !line || !target || target.ton < 1 || fromCode === toCode || target.ten !== line.ten)
    return null;
  const updated = order.lines
    .map((d) => (d.maQuanLy === fromCode ? { ...d, soLuong: d.soLuong - 1 } : d))
    .filter((d) => d.soLuong > 0);
  const lines = themVaoDon(updated, { ...target, ton: target.ton + (updated.find((d) => d.maQuanLy === toCode)?.soLuong ?? 0) });
  const difference = target.donGia - line.donGia;
  return {
    order: {
      ...order,
      lines,
      exchanges: [
        ...order.exchanges,
        { from: fromCode, to: toCode, quantity: 1, priceDifference: difference, created: now.toISOString() },
      ],
    },
    catalog: catalog.map((p) =>
      p.maQuanLy === fromCode ? { ...p, ton: p.ton + 1 } : p.maQuanLy === toCode ? { ...p, ton: p.ton - 1 } : p
    ),
    movements: [
      { code: fromCode, quantity: 1, kind: "HOAN_DOI" },
      { code: toCode, quantity: -1, kind: "XUAT_DOI" },
    ],
    difference,
  };
}
