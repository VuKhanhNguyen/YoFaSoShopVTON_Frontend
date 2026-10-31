import { notFound } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { PosTerminal } from "@/components/PosTerminal";
import { CatalogManager } from "@/components/CatalogManager";
import { OrderBoard } from "@/components/OrderBoard";
import {
  Inventory,
  Notifications,
  People,
  Promotions,
  Reviews,
  Shifts,
} from "@/components/Operations";
import { Studio } from "@/components/Studio";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "dashboard":
      return <Dashboard />;
    case "pos":
      return <PosTerminal />;
    case "catalog":
      return <CatalogManager />;
    case "orders":
      return <OrderBoard />;
    case "warehouse":
      return (
        <>
          <OrderBoard warehouse />
          <Inventory />
        </>
      );
    case "deliveries":
      return <OrderBoard deliveries />;
    case "users":
      return <People />;
    case "promotions":
      return <Promotions />;
    case "reviews":
      return <Reviews />;
    case "shifts":
      return <Shifts />;
    case "notifications":
      return <Notifications />;
    case "studio":
      return <Studio />;
    default:
      notFound();
  }
}
