"use client";
import { useState } from "react";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import type { Row } from "@/lib/models";
import { ActionDialog, type Action } from "./ActionDialog";
import { can, useStaff } from "./StaffShell";
import { DataTable, Details, Modal, State } from "./ui";
export function Inventory() {
  const [sku, setSku] = useState(""),
    [search, setSearch] = useState(""),
    [action, setAction] = useState<Action>();
  const state = useResource<Row[]>(`/staff/inventory/low-stock?size=100`),
    variant = useResource<Row>(
      search
        ? `/staff/variants/by-sku?sku=${encodeURIComponent(search)}`
        : null,
    ),
    movements = useResource<Row[]>(
      variant.data
        ? `/staff/inventory/movements?variantId=${variant.data.variantId}`
        : null,
    );
  return (
    <section className="panel">
      <h2>Tồn kho & kiểm kê</h2>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(sku);
        }}
      >
        <label htmlFor="inventory-sku">Quét hoặc nhập SKU</label>
        <input
          id="inventory-sku"
          maxLength={50}
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />
        <button>Tra cứu</button>
      </form>
      <State {...variant} retry={variant.reload} />
      {variant.data && (
        <>
          <Details row={variant.data} omit={["price", "salePrice"]} />
          <button
            onClick={() =>
              setAction({
                title: "Ghi biến động kiểm kê",
                path: "/staff/inventory/adjustments",
                schema: "Adjustment",
                initial: {
                  variantId: variant.data!.variantId,
                  delta: 0,
                  reason: "",
                },
              })
            }
          >
            Ghi kiểm kê / nhập hàng
          </button>
          <h3>Lịch sử biến động</h3>
          <State {...movements} retry={movements.reload} />
          {movements.data && (
            <DataTable
              rows={movements.data}
              columns={[
                "createdAt",
                "delta",
                "beforeStock",
                "afterStock",
                "reason",
              ]}
            />
          )}
        </>
      )}
      <h3>Cảnh báo tồn thấp</h3>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data && (
        <DataTable
          rows={state.data}
          columns={["sku", "size", "colorName", "stock", "shelf"]}
          actions={(r) => (
            <button
              className="secondary"
              onClick={() => {
                setSku(String(r.sku));
                setSearch(String(r.sku));
              }}
            >
              Kiểm kê
            </button>
          )}
        />
      )}
      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(undefined)}
          onDone={() => {
            state.reload();
            variant.reload();
            movements.reload();
          }}
        />
      )}
    </section>
  );
}
export function People() {
  const [page, setPage] = useState(0),
    [id, setId] = useState(""),
    [action, setAction] = useState<Action>();
  const state = useResource<Row[]>(`/admin/users?page=${page}&size=20`),
    roles = useResource<Row[]>("/admin/roles"),
    detail = useResource<Row>(id ? `/admin/users/${id}` : null);
  const options = {
    roleIds:
      roles.data?.map((r) => ({
        value: String(r.roleId),
        label: String(r.label || r.name),
      })) || [],
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Nhân sự & phân quyền</h1>
          <p className="muted">Quyền được lưu và kiểm tra trên máy chủ.</p>
        </div>
        <button
          onClick={() =>
            setAction({
              title: "Tạo tài khoản nhân sự",
              path: "/admin/users",
              schema: "Staff",
            })
          }
        >
          Thêm nhân sự
        </button>
      </div>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data && (
        <DataTable
          rows={state.data}
          columns={["username", "fullName", "status"]}
          actions={(r) => (
            <button
              className="secondary"
              onClick={() => setId(String(r.userId))}
            >
              Quản lý
            </button>
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={!page}
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
      <details className="panel">
        <summary>Danh mục vai trò</summary>
        <State {...roles} retry={roles.reload} />
        {roles.data && (
          <DataTable rows={roles.data} columns={["roleId", "name", "label"]} />
        )}
      </details>
      {id && (
        <Modal title="Quản lý tài khoản" onClose={() => setId("")}>
          <State {...detail} retry={detail.reload} />
          {detail.data && (
            <>
              <Details row={detail.data} />
              <DataTable
                rows={detail.data.roles as Row[]}
                columns={["name", "label"]}
              />
              <div className="toolbar">
                <button
                  onClick={() =>
                    setAction({
                      title: "Cập nhật hồ sơ",
                      path: `/admin/users/${id}`,
                      method: "PATCH",
                      schema: "Profile",
                      initial: detail.data,
                    })
                  }
                >
                  Sửa hồ sơ
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    setAction({
                      title: "Thay đổi vai trò",
                      path: `/admin/users/${id}/roles`,
                      method: "PUT",
                      schema: "Roles",
                      initial: {
                        roleIds: (detail.data!.roles as Row[]).map(
                          (r) => r.roleId,
                        ),
                      },
                    })
                  }
                >
                  Phân quyền
                </button>
                <button
                  className="secondary danger"
                  onClick={() =>
                    setAction({
                      title: "Thay đổi trạng thái tài khoản",
                      path: `/admin/users/${id}/status`,
                      method: "PATCH",
                      schema: "AccountStatus",
                      initial: { status: detail.data!.status },
                    })
                  }
                >
                  Khóa / mở khóa
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          options={options}
          onClose={() => setAction(undefined)}
          onDone={() => {
            state.reload();
            detail.reload();
          }}
        />
      )}
    </>
  );
}
export function Shifts() {
  const user = useStaff(),
    [page, setPage] = useState(0),
    [id, setId] = useState(""),
    [action, setAction] = useState<Action>();
  const state = useResource<Row[]>(`/pos/shifts?page=${page}&size=20`),
    detail = useResource<Row>(id ? `/pos/shifts/${id}` : null);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ca làm việc & bàn giao</h1>
          <p className="muted">
            Số tiền dự kiến được máy chủ tính từ đơn tiền mặt trong ca.
          </p>
        </div>
        <button
          onClick={() =>
            setAction({
              title: "Mở ca",
              path: "/pos/shifts",
              schema: "ShiftMoney",
              initial: { amount: 0 },
            })
          }
        >
          Mở ca
        </button>
      </div>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data && (
        <DataTable
          rows={state.data}
          columns={[
            "shiftId",
            "cashierId",
            "openedAt",
            "closedAt",
            "status",
            "openingCash",
            "countedCash",
          ]}
          actions={(row) => (
            <>
              <button
                className="secondary"
                onClick={() => setId(String(row.shiftId))}
              >
                Đối soát
              </button>
              {row.status === "DANG_MO" && row.cashierId === user.userId && (
                <button
                  onClick={() =>
                    setAction({
                      title: "Kết ca và bàn giao",
                      path: `/pos/shifts/${row.shiftId}/close`,
                      schema: "ShiftMoney",
                    })
                  }
                >
                  Kết ca
                </button>
              )}
              {can(user, "SHOP_ADMIN") &&
                row.status === "DA_DONG_CHO_DUYET" && (
                  <button
                    onClick={() =>
                      setAction({
                        title: "Duyệt bàn giao ca",
                        path: `/admin/shifts/${row.shiftId}/approve`,
                      })
                    }
                  >
                    Duyệt ca
                  </button>
                )}
            </>
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <button
          className="secondary"
          disabled={(state.data?.length || 0) < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
      {id && (
        <Modal title={`Đối soát ca ${id}`} onClose={() => setId("")}>
          <State {...detail} retry={detail.reload} />
          {detail.data && <Details row={detail.data} />}
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(undefined)}
          onDone={() => {
            state.reload();
            detail.reload();
          }}
        />
      )}
    </>
  );
}
export function Reviews() {
  const [page, setPage] = useState(0),
    [action, setAction] = useState<Action>();
  const state = useResource<Row[]>(`/admin/reviews?page=${page}&size=20`);
  return (
    <>
      <h1>Duyệt đánh giá</h1>
      <p className="muted">Đánh giá đã mua hàng, phản hồi trực tiếp từ shop.</p>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data && (
        <DataTable
          rows={state.data}
          columns={["productId", "stars", "comment", "status"]}
          actions={(r) => (
            <button
              className="secondary"
              onClick={() =>
                setAction({
                  title: "Duyệt và phản hồi",
                  path: `/admin/reviews/${r.reviewId}`,
                  method: "PATCH",
                  schema: "Moderation",
                  initial: { status: r.status, reply: r.shopReply || "" },
                })
              }
            >
              Phản hồi
            </button>
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <button
          className="secondary"
          disabled={(state.data?.length || 0) < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
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
export function Promotions() {
  const state = useResource<Row[]>("/promotions"),
    [action, setAction] = useState<Action>();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Chương trình ưu đãi</h1>
          <p className="muted">
            Các chương trình đang hiệu lực và còn lượt sử dụng.
          </p>
        </div>
        <button
          onClick={() =>
            setAction({
              title: "Tạo chương trình",
              path: "/admin/promotions",
              schema: "Promotion",
              initial: { type: "PHAN_TRAM", minimumTotal: 0, quantity: 1 },
            })
          }
        >
          Tạo ưu đãi
        </button>
      </div>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {state.data && (
        <DataTable
          rows={state.data}
          columns={[
            "code",
            "name",
            "type",
            "value",
            "minimumTotal",
            "expiresAt",
          ]}
        />
      )}
      <aside className="info-note">
        Chỉ hiển thị các chương trình đang hiệu lực. Quản lý lịch sử ưu đãi chưa
        khả dụng.
      </aside>
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
export function Notifications() {
  const [page, setPage] = useState(0),
    [error, setError] = useState("");
  const state = useResource<Row[]>(`/notifications?page=${page}&size=20`);
  return (
    <>
      <h1>Hộp thư nội bộ</h1>
      <State {...state} empty={state.data?.length === 0} retry={state.reload} />
      {error && <p className="error-banner">{error}</p>}
      {state.data && (
        <DataTable
          rows={state.data}
          columns={["title", "message", "createdAt", "readStatus"]}
          actions={(r) => (
            <button
              className="secondary"
              disabled={Boolean(r.readStatus)}
              onClick={() =>
                void api(`/notifications/${r.notificationId}/read`, "POST")
                  .then(state.reload)
                  .catch((e) => setError(e.message))
              }
            >
              Đã đọc
            </button>
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <button
          className="secondary"
          disabled={(state.data?.length || 0) < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
    </>
  );
}
