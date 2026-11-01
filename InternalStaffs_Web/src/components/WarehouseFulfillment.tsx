"use client";

import { useState } from "react";
import { ClipboardList, Package, Truck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffHeader } from "@/components/staff-header";
import { useRequireAuth } from "@/lib/auth";
import { WH_ORDERS, type WhOrder } from "@/lib/warehouse";
import { PickListBoard } from "@/components/warehouse/picklist";
import { PackingStation } from "@/components/warehouse/packing";
import { HandoverReturn } from "@/components/warehouse/handover";
import { AuditReport } from "@/components/warehouse/audit";

type Tab = "pick" | "pack" | "handover" | "audit";

const TABS: { k: Tab; l: string; icon: typeof Package }[] = [
  { k: "pick", l: "Điều phối & Pick List", icon: ClipboardList },
  { k: "pack", l: "Đóng gói & In tem A6", icon: Package },
  { k: "handover", l: "Bàn giao & Hoàn kho", icon: Truck },
  { k: "audit", l: "Kiểm kê & Báo cáo", icon: ClipboardCheck },
];

export function WarehouseFulfillment() {
  const { user, ready } = useRequireAuth(["ROLE_STAFF_WAREHOUSE", "ROLE_SHOP_ADMIN"]);
  const [tab, setTab] = useState<Tab>("pick");
  const [orders, setOrders] = useState<WhOrder[]>(WH_ORDERS);

  if (!ready || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-muted-foreground">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  const waiting = orders.filter((o) => o.status === "CHO_XAC_NHAN").length;
  const packing = orders.filter((o) => o.status === "DANG_DONG_GOI").length;
  const readyShip = orders.filter((o) => o.status === "CHO_SHIPPER").length;

  const handover = (ids: string[]) =>
    setOrders((ds) => ds.map((o) => (ids.includes(o.id) ? { ...o, status: "DANG_GIAO_HANG" } : o)));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <StaffHeader title="KHO">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Nhân viên: <b className="font-mono text-foreground">{user.code}</b> {user.name}
          </span>
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 font-mono font-bold text-warning">
            {waiting} đơn chờ nhặt
          </span>
          <span className="rounded-full bg-info-subtle px-2 py-0.5 font-mono font-bold text-info">
            {packing} đang đóng gói
          </span>
          <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono font-bold text-accent-hover">
            {readyShip} chờ shipper nhận
          </span>
        </div>
      </StaffHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="font-editorial text-3xl">Trung tâm điều phối kho YoFaSo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thủ kho chỉ thấy mã đơn, SKU, tên hàng, size, màu và tọa độ kệ — giá bán &amp; doanh thu bị ẩn theo phân quyền RBAC (dữ liệu mô phỏng).
          </p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Phân hệ kho">
          {TABS.map((t) => (
            <Button
              key={t.k}
              variant={tab === t.k ? "default" : "outline"}
              aria-pressed={tab === t.k}
              onClick={() => setTab(t.k)}
              className="h-11 gap-2 rounded-full px-5"
            >
              <t.icon className="h-4 w-4" />
              {t.l}
            </Button>
          ))}
        </nav>

        {tab === "pick" && <PickListBoard orders={orders} onPrint={() => window.print()} />}
        {tab === "pack" && <PackingStation orders={orders} />}
        {tab === "handover" && <HandoverReturn orders={orders} onHandover={handover} />}
        {tab === "audit" && <AuditReport />}
      </main>
    </div>
  );
}
