import { ShipperDeliveries } from "@/components/ShipperDeliveries";

export const metadata = {
  title: "YoFaSo Giao vận — Lộ trình giao hàng hôm nay",
  description: "App shipper nội bộ YoFaSo: quét nhận kiện, lộ trình tối ưu, cập nhật giao hàng, thu COD và quyết toán cuối ca.",
};

export default function ShipperPage() {
  return <ShipperDeliveries />;
}
