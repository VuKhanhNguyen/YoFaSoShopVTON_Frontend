"use client";
import { useState } from "react";
import Image from "next/image";
import { useResource } from "@/hooks/use-resource";
import { catalogImage } from "@/lib/api";
import type { Page, Row } from "@/lib/models";
import { can, useStaff } from "./StaffShell";
import { ActionDialog, type Action } from "./ActionDialog";
import { DataTable, Details, Modal, State } from "./ui";
export function CatalogManager() {
  const user = useStaff(),
    admin = can(user, "SHOP_ADMIN"),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [id, setId] = useState(""),
    [action, setAction] = useState<Action>();
  const state = useResource<Page<Row>>(
      `/staff/products?page=${page}&size=20&q=${encodeURIComponent(q)}`,
    ),
    detail = useResource<Row>(
      id ? `/staff/products/${encodeURIComponent(id)}` : null,
    ),
    categories = useResource<Row[]>("/catalog/categories");
  const reload = () => {
    state.reload();
    detail.reload();
    categories.reload();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Catalog YoFaSo</p>
          <h1>Sản phẩm & biến thể</h1>
          <p className="muted">Một sản phẩm, nhiều lựa chọn màu và kích cỡ.</p>
        </div>
        {admin && (
          <button
            onClick={() =>
              setAction({
                title: "Tạo sản phẩm",
                path: "/admin/products",
                schema: "Product",
              })
            }
          >
            Thêm sản phẩm
          </button>
        )}
      </div>
      <div className="toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQ(query);
          }}
        >
          <label htmlFor="catalog-query">Tên sản phẩm</label>
          <input
            id="catalog-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
          />
          <button className="secondary">Tìm kiếm</button>
        </form>
        {admin && (
          <button
            className="secondary"
            onClick={() =>
              setAction({
                title: "Tạo danh mục",
                path: "/admin/categories",
                schema: "Category",
                initial: { name: "", position: 0 },
              })
            }
          >
            Thêm danh mục
          </button>
        )}
      </div>
      <State
        {...state}
        empty={state.data?.items.length === 0}
        retry={state.reload}
      />
      {state.data && (
        <DataTable
          rows={state.data.items}
          columns={["productId", "name", "material", "vtonCategory", "status"]}
          actions={(row) => (
            <button
              className="secondary"
              onClick={() => setId(String(row.productId))}
            >
              Chi tiết
            </button>
          )}
        />
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <span>Trang {page + 1}</span>
        <button
          className="secondary"
          disabled={!state.data || (page + 1) * 20 >= state.data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
      {admin && (
        <details className="panel">
          <summary>Quản lý danh mục</summary>
          <State {...categories} retry={categories.reload} />
          {categories.data && (
            <DataTable
              rows={categories.data}
              columns={["categoryId", "name", "description"]}
              actions={(r) => (
                <button
                  className="secondary danger"
                  onClick={() =>
                    setAction({
                      title: "Xóa danh mục",
                      path: `/admin/categories/${r.categoryId}`,
                      method: "DELETE",
                      destructive: true,
                    })
                  }
                >
                  Xóa
                </button>
              )}
            />
          )}
        </details>
      )}
      {id && (
        <Modal title="Chi tiết sản phẩm" onClose={() => setId("")}>
          <State {...detail} retry={detail.reload} />
          {detail.data && (
            <>
              <Details row={detail.data} />
              <div className="image-grid">
                {(detail.data.images as Row[])?.map((image) => (
                  <Image
                    key={String(image.imageId)}
                    src={catalogImage(String(image.originalUrl))}
                    alt={String(detail.data!.name)}
                    width={240}
                    height={300}
                    unoptimized
                  />
                ))}
              </div>
              {admin && (
                <div className="toolbar">
                  <button
                    onClick={() => {
                      setAction({
                        title: "Sửa sản phẩm",
                        path: `/admin/products/${id}`,
                        method: "PUT",
                        schema: "Product",
                        initial: detail.data,
                      });
                      setId("");
                    }}
                  >
                    Sửa sản phẩm
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      setAction({
                        title: "Thêm biến thể",
                        path: `/admin/products/${id}/variants`,
                        schema: "Variant",
                      })
                    }
                  >
                    Thêm biến thể
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      setAction({
                        title: "Công bố sản phẩm",
                        path: `/admin/products/${id}/publish`,
                      })
                    }
                  >
                    Công bố
                  </button>
                  <button
                    className="secondary danger"
                    onClick={() =>
                      setAction({
                        title: "Ngừng kinh doanh",
                        path: `/admin/products/${id}`,
                        method: "DELETE",
                        destructive: true,
                      })
                    }
                  >
                    Ngừng kinh doanh
                  </button>
                </div>
              )}
              <DataTable
                rows={(detail.data.variants as Row[]) || []}
                columns={[
                  "sku",
                  "size",
                  "colorName",
                  "stock",
                  ...(can(user, "SHOP_ADMIN", "STAFF_CASHIER")
                    ? ["price", "salePrice"]
                    : []),
                  "shelf",
                  "status",
                ]}
                actions={
                  admin
                    ? (row) => (
                        <button
                          className="secondary"
                          onClick={() =>
                            setAction({
                              title: "Sửa biến thể",
                              path: `/admin/products/${id}/variants/${row.variantId}`,
                              schema: "Variant",
                              method: "PUT",
                              initial: row,
                            })
                          }
                        >
                          Sửa
                        </button>
                      )
                    : undefined
                }
              />
            </>
          )}
        </Modal>
      )}
      {action && (
        <ActionDialog
          action={action}
          onClose={() => setAction(undefined)}
          onDone={reload}
          options={{
            categoryId:
              categories.data?.map((c) => ({
                value: String(c.categoryId),
                label: String(c.name),
              })) || [],
          }}
        />
      )}
    </>
  );
}
