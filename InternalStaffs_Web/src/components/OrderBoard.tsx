"use client";
import { useState } from "react";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { can, useStaff } from "./StaffShell";
import { ActionDialog, type Action } from "./ActionDialog";
import { DataTable, Details, Modal, State } from "./ui";
export function OrderBoard({
  warehouse = false,
  deliveries = false,
}: {
  warehouse?: boolean;
  deliveries?: boolean;
}) {
  const user = useStaff(),
    [page, setPage] = useState(0),
    [id, setId] = useState(""),
    [action, setAction] = useState<Action>();
  const state = useResource<Row[]>(`/staff/orders?page=${page}&size=20`),
    detail = useResource<Row>(id ? `/staff/orders/${id}` : null),
    picks = useResource<Row[]>(
      id && warehouse ? `/staff/orders/${id}/pick-list` : null,
    );
  const operations = (row: Row) => {
    const id = String(row.orderId),
      status = String(row.status);
    return (
      <>
        <button className="secondary" onClick={() => setId(id)}>
          Chi tiết
        </button>
        {can(user, "SHOP_ADMIN", "STAFF_WAREHOUSE") &&
          status === "CHO_XAC_NHAN" && (
            <button
              onClick={() =>
                setAction({
                  title: "Bắt đầu đóng gói",
                  path: `/staff/orders/${id}/pack`,
                })
              }
            >
              Đóng gói
            </button>
          )}
        {can(user, "SHOP_ADMIN", "STAFF_WAREHOUSE") &&
          status === "DANG_DONG_GOI" && (
            <button
              onClick={() =>
                setAction({
                  title: "Phân công giao hàng",
                  path: `/staff/orders/${id}/assign`,
                  schema: "Assignment",
                })
              }
            >
              Phân giao
            </button>
          )}
        {can(user, "STAFF_SHIPPER") && status === "DANG_GIAO_HANG" && (
          <>
            <button
              className="shipper-action"
              onClick={() =>
                setAction({
                  title: "Xác nhận giao thành công và thu COD",
                  path: `/staff/orders/${id}/deliver`,
                })
              }
            >
              Giao thành công
            </button>
            <button
              className="secondary shipper-action"
              onClick={() =>
                setAction({
                  title: "Xác nhận giao thất bại",
                  path: `/staff/orders/${id}/delivery-failed`,
                })
              }
            >
              Giao thất bại
            </button>
          </>
        )}
        {can(user, "SHOP_ADMIN", "STAFF_WAREHOUSE") &&
          status === "DANG_DONG_GOI" && (
            <button
              className="secondary"
              onClick={() =>
                setAction({
                  title: "Nhận lại hàng về kho",
                  path: `/staff/orders/${id}/receive-return`,
                  destructive: true,
                })
              }
            >
              Nhận hoàn
            </button>
          )}
        {can(user, "SHOP_ADMIN") &&
          !["HOAN_TAT", "DA_HUY"].includes(status) && (
            <button
              className="secondary danger"
              onClick={() =>
                setAction({
                  title: "Hủy đơn",
                  path: `/admin/orders/${id}/cancel`,
                  destructive: true,
                })
              }
            >
              Hủy đơn
            </button>
          )}
      </>
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {deliveries
              ? "Điểm giao của bạn"
              : warehouse
                ? "Gom hàng & đóng gói"
                : "Đơn hàng đa kênh"}
          </h1>
          <p className="muted">
            Dữ liệu trong phạm vi vai trò và tài khoản hiện tại.
          </p>
        </div>
        <button className="secondary" onClick={state.reload}>
          Làm mới
        </button>
      </div>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data &&
        (deliveries ? (
          <div className="delivery-list">
            {state.data.map((row) => (
              <article className="panel" key={String(row.orderId)}>
                <h2>{String(row.recipientName)}</h2>
                <Details
                  row={row}
                  omit={["userId", "channel", "paymentMethod"]}
                />
                <div className="toolbar">
                  <a
                    className="button secondary shipper-action"
                    href={`tel:${row.phone}`}
                  >
                    Gọi khách
                  </a>
                  <a
                    className="button secondary shipper-action"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(row.address))}`}
                  >
                    Chỉ đường
                  </a>
                  {operations(row)}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <DataTable
            rows={state.data}
            columns={[
              "orderId",
              "recipientName",
              "status",
              ...(warehouse ? [] : ["channel", "collectAmount"]),
              "createdAt",
            ]}
            actions={operations}
          />
        ))}
      <div className="pagination">
        <button
          className="secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <span>{page + 1}</span>
        <button
          className="secondary"
          disabled={(state.data?.length || 0) < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
      {id && (
        <Modal title={`Đơn ${id}`} onClose={() => setId("")}>
          <State {...detail} retry={detail.reload} />
          {detail.data && (
            <>
              <Details
                row={detail.data}
                omit={
                  warehouse
                    ? [
                        "subtotal",
                        "total",
                        "discount",
                        "collectAmount",
                        "shippingFee",
                        "paymentStatus",
                        "paymentMethod",
                      ]
                    : []
                }
              />
              <DataTable
                rows={
                  warehouse
                    ? picks.data || []
                    : (detail.data.items as Row[]) || []
                }
                columns={
                  warehouse
                    ? ["sku", "name", "size", "colorName", "quantity", "shelf"]
                    : [
                        "productName",
                        "size",
                        "colorName",
                        "quantity",
                        "unitPrice",
                      ]
                }
              />
              {warehouse && <State {...picks} retry={picks.reload} />}
              <button
                className="secondary print-button"
                onClick={() => window.print()}
              >
                {warehouse ? "In phiếu gom hàng" : "In thông tin đơn"}
              </button>
            </>
          )}
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(undefined)}
          onDone={state.reload}
        />
      )}
    </>
  );
}
