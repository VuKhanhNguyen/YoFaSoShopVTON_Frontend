"use client";

import { useState } from "react";
import { Cake, Crown, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { birthdayEligible, isBirthday, redeemedPoints, type Customer } from "@/lib/pos-workflows";
import { vnd } from "@/lib/pos";

export function Loyalty({
  customers,
  payable,
  onAssign,
}: {
  customers: Customer[];
  payable: number;
  onAssign: (c: Customer, birthday: boolean, points: number) => void;
}) {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searched, setSearched] = useState(false);
  const [birthday, setBirthday] = useState(false);
  const [points, setPoints] = useState(false);
  const date = new Date();

  const lookup = (value = phone) => {
    setCustomer(customers.find((c) => c.phone === value.replace(/\D/g, "")) ?? null);
    setSearched(true);
    setBirthday(false);
    setPoints(false);
  };

  const available = customer ? redeemedPoints(customer.points, 500, payable * (birthday ? 0.85 : 1)) : 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (customer) onAssign(customer, birthday, points ? available : 0);
        else lookup();
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label="Số điện thoại khách hàng"
          type="tel"
          autoFocus
          placeholder="Số điện thoại khách hàng (10 số)"
          maxLength={10}
          value={phone}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            setPhone(value);
            setCustomer(null);
            setSearched(false);
            if (value.length === 10) lookup(value);
          }}
          className="h-12 font-mono text-base"
        />
        <Button type="button" className="h-12 px-5 gap-2" onClick={() => lookup()}>
          <Search className="h-4 w-4" />
          Tìm kiếm
        </Button>
      </div>

      {!searched && (
        <div className="flex items-center gap-3 border-b border-border pb-6 text-muted-foreground text-sm">
          <UserRound className="h-6 w-6 text-accent" />
          <span>
            Khách hàng mẫu: <span className="font-mono text-foreground font-semibold">0912345789</span> (Trần Thu Hà)
          </span>
        </div>
      )}

      {searched && !customer && (
        <p role="alert" className="text-destructive text-sm font-medium">
          Không tìm thấy khách hàng với số điện thoại này trong hệ thống CRM.
        </p>
      )}

      {customer && (
        <>
          <section className="space-y-4 border-b border-border pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{customer.name}</h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {customer.phone.slice(0, 4)}.***.{customer.phone.slice(-3)}
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-full border border-accent bg-accent-subtle px-3 py-1.5 text-xs font-bold text-accent-hover">
                <Crown className="h-4 w-4" />
                {({ DONG: "HẠNG ĐỒNG", BAC: "HẠNG BẠC", VANG: "HẠNG VÀNG", KIM_CUONG: "KIM CƯƠNG" })[customer.tier]}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Điểm tích lũy</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-accent-hover">
                  {customer.points.toLocaleString("vi-VN")}
                </dd>
                <dd className="text-xs text-muted-foreground">Tương đương {vnd(customer.points * 100)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Ngày sinh nhật</dt>
                <dd className="mt-2 font-mono font-semibold">{customer.birthday.split("-").reverse().join("/")}</dd>
              </div>
            </dl>
          </section>

          {birthdayEligible(customer, date) && (
            <section className="space-y-3 rounded-xl border border-accent bg-accent-subtle p-4">
              <div className="flex items-center gap-2 font-semibold text-accent-hover">
                <Cake className="h-5 w-5" />
                {isBirthday(customer, date) ? "Chúc mừng sinh nhật hôm nay!" : "Ưu đãi đặc biệt tháng sinh nhật"}
              </div>
              <p className="text-xs text-muted-foreground">Giảm 15% cho 01 hóa đơn mua sắm trong tháng {date.getMonth() + 1}.</p>
              <Button
                type="button"
                variant={birthday ? "default" : "accent"}
                className="h-auto w-full whitespace-normal py-3 text-sm font-bold"
                onClick={() => setBirthday((v) => !v)}
              >
                {birthday ? "✓ Đã kích hoạt voucher sinh nhật −15%" : "Áp dụng voucher sinh nhật −15%"}
              </Button>
            </section>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
            <Checkbox checked={points} disabled={!available} onCheckedChange={(v) => setPoints(v === true)} />
            <span className="text-sm font-medium">
              Đổi {available} điểm thưởng = Giảm {vnd(available * 100)}
              <span className="mt-0.5 block text-xs text-muted-foreground">Tối đa 500 điểm (50.000 đ) / hóa đơn</span>
            </span>
          </label>

          <Button type="submit" className="h-12 w-full text-sm font-bold">
            Gán khách hàng vào hóa đơn này (Enter)
          </Button>
        </>
      )}
    </form>
  );
}
