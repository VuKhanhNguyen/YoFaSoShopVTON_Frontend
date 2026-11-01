import { WarehouseFulfillment } from "@/components/WarehouseFulfillment";

export const metadata = {
  title: "YoFaSo Kho — Trung tâm điều phối",
  description: "Phân hệ kho YoFaSo: gom đơn sinh Pick List theo kệ, đóng gói đối soát barcode, in tem A6, bàn giao shipper, kiểm kê tồn kho.",
};

export default function WarehousePage() {
  return <WarehouseFulfillment />;
}
