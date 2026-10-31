"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { api, assetUrl } from "@/lib/api";
import type { Page, Row } from "@/lib/models";
import { useResource } from "@/hooks/use-resource";
import { ContractForm } from "./ContractForm";
import { Details, State } from "./ui";
type Upload = { assetId: string; name: string; role: string };
export function Studio() {
  const products = useResource<Page<Row>>("/staff/products?size=100"),
    [productId, setProduct] = useState(""),
    [assets, setAssets] = useState<Upload[]>([]),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [operationId, setOperation] = useState(""),
    [lookup, setLookup] = useState("");
  const product = useResource<Row>(
      productId ? `/staff/products/${productId}` : null,
    ),
    operation = useResource<Row>(
      operationId ? `/admin/analyses/${encodeURIComponent(operationId)}` : null,
    );
  const attempt = useRef<{ payload: string; key: string } | null>(null),
    variants = (product.data?.variants as Row[] | undefined) || [],
    result = operation.data?.result as Row | undefined;
  useEffect(() => {
    if (
      !operation.data ||
      ["COMPLETED", "FAILED", "CANCELLED"].includes(
        String(operation.data.status),
      ) ||
      operation.error
    )
      return;
    const timer = setTimeout(operation.reload, 4000);
    return () => clearTimeout(timer);
  }, [operation.data, operation.error, operation.reload]);
  async function upload(files: FileList | null, role: string) {
    if (!files) return;
    setBusy(true);
    setError("");
    try {
      if (!consent) throw new Error("Vui lòng xác nhận quyền xử lý ảnh.");
      if (assets.filter((a) => a.role === role).length + files.length > 8)
        throw new Error("Tối đa 8 ảnh mỗi nhóm.");
      for (const file of Array.from(files)) {
        if (
          !["image/png", "image/jpeg"].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error("Chỉ nhận PNG/JPEG tối đa 10 MB.");
        const body = new FormData();
        body.set("file", file);
        body.set("role", role);
        body.set("consent", "true");
        const result = await api<{ assetId: string }>("/assets", "POST", body);
        setAssets((prev) => [
          ...prev,
          { assetId: result.assetId, name: file.name, role },
        ]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const body = {
          productAssetIds: assets
            .filter((a) => a.role === "garment")
            .map((a) => a.assetId),
          referenceAssetIds: assets
            .filter((a) => a.role === "reference")
            .map((a) => a.assetId),
        },
        payload = JSON.stringify({ productId, ...body });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const result = await api<Row>(
        `/admin/products/${productId}/analysis`,
        "POST",
        body,
        attempt.current!.key,
      );
      setOperation(String(result.operationId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Studio sản phẩm</p>
          <h1>Chuẩn bị catalog cho VTON</h1>
          <p className="muted">
            Mỗi lần phân tích chỉ dùng ảnh của cùng một mẫu sản phẩm.
          </p>
        </div>
      </div>
      <div className="studio-layout">
        <section className="panel">
          <h2>Ảnh đầu vào</h2>
          <State {...products} retry={products.reload} />
          <div className="field">
            <label htmlFor="studio-product">Sản phẩm</label>
            <select
              id="studio-product"
              value={productId}
              onChange={(e) => {
                setProduct(e.target.value);
                setAssets([]);
                setOperation("");
                attempt.current = null;
              }}
            >
              <option value="">Chọn sản phẩm</option>
              {products.data?.items.map((p) => (
                <option key={String(p.productId)} value={String(p.productId)}>
                  {String(p.name)} ({String(p.productId)})
                </option>
              ))}
            </select>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Tôi có quyền tải và xử lý những ảnh này.
          </label>
          <div className="upload-zone">
            <label htmlFor="garment-files">
              Ảnh sản phẩm (PNG/JPEG, tối đa 8 ảnh)
            </label>
            <input
              id="garment-files"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              disabled={busy || !productId || !consent}
              onChange={(e) => void upload(e.target.files, "garment")}
            />
          </div>
          <div className="upload-zone">
            <label htmlFor="reference-files">
              Ảnh mẫu tham chiếu (tối đa 8 ảnh)
            </label>
            <input
              id="reference-files"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              disabled={busy || !productId || !consent}
              onChange={(e) => void upload(e.target.files, "reference")}
            />
          </div>
          <div className="image-grid">
            {assets.map((a) => (
              <figure key={a.assetId}>
                <Image
                  src={assetUrl(a.assetId)}
                  alt={a.name}
                  width={160}
                  height={200}
                  unoptimized
                />
                <figcaption>
                  {a.role === "garment" ? "Sản phẩm" : "Người mẫu"}: {a.name}
                </figcaption>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api(`/assets/${a.assetId}`, "DELETE")
                      .then(() =>
                        setAssets((prev) =>
                          prev.filter((v) => v.assetId !== a.assetId),
                        ),
                      )
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Xóa ảnh
                </button>
              </figure>
            ))}
          </div>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <button
            disabled={
              busy ||
              !productId ||
              !consent ||
              !assets.some((a) => a.role === "garment")
            }
            onClick={() => void analyze()}
          >
            {busy ? "Đang xử lý..." : "Phân tích sản phẩm"}
          </button>
        </section>
        <section className="panel">
          <h2>Kết quả & duyệt biến thể</h2>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setOperation(lookup);
            }}
          >
            <div className="field">
              <label htmlFor="analysis-lookup">Mã phiên phân tích đã lưu</label>
              <input
                id="analysis-lookup"
                value={lookup}
                maxLength={64}
                onChange={(e) => setLookup(e.target.value)}
                required
              />
            </div>
            <button className="secondary">Tra cứu</button>
          </form>
          <State {...operation} retry={operation.reload} />
          {operation.data ? (
            <>
              <Details row={operation.data} />
              {Boolean(operation.data.simulated) && (
                <p className="info-note">
                  Kết quả mô phỏng: không dùng để duyệt catalog bán hàng thật.
                </p>
              )}
              {result && (
                <>
                  <Details row={result} />
                  {(result.variants as Row[])?.map((r, i) => (
                    <article
                      className="checkerboard"
                      key={String(r.sourceAssetId || i)}
                    >
                      <Details row={r} />
                      {["cutoutAssetId", "maskAssetId"].map((k) =>
                        typeof r[k] === "string" ? (
                          <Image
                            key={k}
                            src={assetUrl(String(r[k]))}
                            alt={
                              k === "cutoutAssetId"
                                ? "Ảnh tách nền"
                                : "Mặt nạ trang phục"
                            }
                            width={200}
                            height={240}
                            unoptimized
                          />
                        ) : null,
                      )}
                    </article>
                  ))}
                </>
              )}
              {operation.data.status === "COMPLETED" &&
                !operation.data.simulated && (
                  <ContractForm
                    key={operationId}
                    schemaName="Approval"
                    title="Duyệt liên kết ảnh"
                    options={{
                      variantId: variants.map((v) => ({
                        value: String(v.variantId),
                        label: `${v.sku} / ${v.colorName} / ${v.size}`,
                      })),
                      sourceAssetId: ((result?.variants as Row[]) || []).map(
                        (r) => ({
                          value: String(r.sourceAssetId),
                          label:
                            assets.find((a) => a.assetId === r.sourceAssetId)
                              ?.name || String(r.sourceAssetId),
                        }),
                      ),
                    }}
                    onSubmit={async (v) => {
                      await api(
                        `/admin/analyses/${operationId}/approve`,
                        "POST",
                        v,
                      );
                      operation.reload();
                    }}
                  />
                )}
            </>
          ) : (
            <div className="empty">
              <p>Tải ảnh và gửi phân tích để xem kết quả tại đây.</p>
            </div>
          )}
          <p className="hint">
            Duyệt ảnh đưa sản phẩm về bản nháp. Công bố sau khi kiểm tra thông
            tin và biến thể ở màn hình Sản phẩm.
          </p>
        </section>
      </div>
    </>
  );
}
