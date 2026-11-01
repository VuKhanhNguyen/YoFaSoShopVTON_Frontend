import { notFound } from "next/navigation";
import { PosTerminal } from "@/components/PosTerminal";
import { WarehouseFulfillment } from "@/components/WarehouseFulfillment";
import { ShipperDeliveries } from "@/components/ShipperDeliveries";
import { AdminDashboard } from "@/components/AdminDashboard";

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "dashboard":
    case "analytics":
    case "studio":
    case "promotions":
    case "reviews":
    case "users":
    case "shifts":
    case "notifications":
      return <AdminDashboard />;
    case "pos":
      return <PosTerminal />;
    case "warehouse":
    case "orders":
      return <WarehouseFulfillment />;
    case "deliveries":
      return <ShipperDeliveries />;
    default:
      notFound();
  }
}
