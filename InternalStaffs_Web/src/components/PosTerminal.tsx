"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Barcode, ShoppingBag, Trash } from "@phosphor-icons/react";
import { useResource } from "@/hooks/use-resource";
import { api, catalogImage } from "@/lib/api";
import {
  money,
  type Page,
  type Product,
  type Row,
  type Variant,
} from "@/lib/models";
import { DataTable, Details, Modal, State } from "./ui";
type Line = Variant & { quantity: number; name: string };
export function PosTerminal() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [id, setId] = useState(""),
    [sku, setSku] = useState(""),
    [lines, setLines] = useState<Line[]>([]),
    [voucher, setVoucher] = useState(""),
    [quote, setQuote] = useState<{ amount: number; fingerprint: string }>(),
    [cash, setCash] = useState(""),
    [phone, setPhone] = useState(""),
    [customer, setCustomer] = useState<Row>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<Row>(),
    [pass, setPass] = useState(""),
    [fitting, setFitting] = useState<Row>();
  const catalog = useResource<Page<Product>>(
      `/staff/products?q=${encodeURIComponent(search)}&size=20`,
    ),
    product = useResource<Product>(id ? `/staff/products/${id}` : null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const fingerprint = JSON.stringify({ lines, voucher }),
    discount = quote?.fingerprint === fingerprint ? quote.amount : 0;
  const subtotal = lines.reduce(
      (sum, l) => sum + Number(l.salePrice ?? l.price) * l.quantity,
      0,
    ),
    total = subtotal - discount;
  function add(v: Variant, name: string) {
    const existing = lines.find((l) => l.variantId === v.variantId);
    if (v.status !== "DANG_BAN" || v.stock < (existing?.quantity || 0) + 1) {
      setError("Biến thể không đủ tồn hoặc đã ngừng bán.");
      return;
    }
    setLines(
      existing
        ? lines.map((l) =>
            l.variantId === v.variantId
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [...lines, { ...v, quantity: 1, name }],
    );
    setError("");
  }
  function quantity(id: string, count: number) {
    setLines(
      lines.flatMap((l) =>
        l.variantId !== id
          ? [l]
          : count < 1
            ? []
            : [{ ...l, quantity: Math.min(count, l.stock, 99) }],
      ),
    );
  }
  async function task(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!Number.isFinite(Number(cash)) || Number(cash) < total || !cash)
      throw new Error("Tiền khách đưa phải đủ thanh toán.");
    const body = {
        items: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        cashReceived: Number(cash),
        ...(customer ? { customerId: customer.userId } : {}),
        ...(voucher ? { voucher } : {}),
      },
      payload = JSON.stringify(body);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    const order = await api<Row>(
      "/pos/orders",
      "POST",
      body,
      attempt.current!.key,
    );
    setReceipt(order);
    setLines([]);
    setCash("");
    setVoucher("");
    setCustomer(undefined);
    attempt.current = null;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Bán hàng tại quầy</h1>
          <p className="muted">Quét SKU, chọn biến thể và xác nhận tiền mặt.</p>
        </div>
        <ShoppingBag size={28} />
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="pos-layout">
        <section>
          <form
            className="barcode-bar"
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                const v = await api<Variant>(
                  `/staff/variants/by-sku?sku=${encodeURIComponent(sku)}`,
                );
                add(v, v.sku);
                setSku("");
              });
            }}
          >
            <Barcode size={24} />
            <label className="sr-only" htmlFor="barcode">
              Quét mã SKU
            </label>
            <input
              id="barcode"
              autoFocus
              value={sku}
              maxLength={50}
              placeholder="Quét hoặc nhập mã SKU"
              onChange={(e) => setSku(e.target.value)}
              required
            />
            <button disabled={busy}>Thêm</button>
          </form>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
            }}
          >
            <label htmlFor="pos-search">Tìm sản phẩm</label>
            <input
              id="pos-search"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="secondary">Tìm</button>
          </form>
          <State
            {...catalog}
            retry={catalog.reload}
            empty={catalog.data?.items.length === 0}
          />
          <div className="pos-catalog">
            {catalog.data?.items.map((p) => (
              <button
                key={p.productId}
                className={
                  id === p.productId
                    ? "product-choice selected"
                    : "product-choice"
                }
                onClick={() => setId(p.productId)}
              >
                <span className="product-letter">{p.name.slice(0, 1)}</span>
                <strong>{p.name}</strong>
                <small>{p.material}</small>
              </button>
            ))}
          </div>
          {id && (
            <section className="panel">
              <State {...product} retry={product.reload} />
              {product.data && (
                <>
                  <h2>{product.data.name}</h2>
                  {product.data.images?.[0] && (
                    <Image
                      className="pos-product-photo"
                      src={catalogImage(product.data.images[0].originalUrl)}
                      alt={product.data.name}
                      width={180}
                      height={220}
                      unoptimized
                    />
                  )}
                  <DataTable
                    rows={product.data.variants as unknown as Row[]}
                    columns={["sku", "size", "colorName", "stock", "price"]}
                    actions={(v) => (
                      <button
                        className="secondary"
                        disabled={
                          Number(v.stock) < 1 || v.status !== "DANG_BAN"
                        }
                        onClick={() =>
                          add(v as unknown as Variant, product.data!.name)
                        }
                      >
                        Thêm
                      </button>
                    )}
                  />
                </>
              )}
            </section>
          )}
        </section>
        <aside className="pos-bill panel">
          <h2>Phiếu bán hàng</h2>
          {lines.length ? (
            <div className="bill-lines">
              {lines.map((l) => (
                <div className="bill-line" key={l.variantId}>
                  <div>
                    <strong>{l.name}</strong>
                    <p>
                      {l.colorName} / {l.size}
                    </p>
                    <span className="mono">
                      {money(Number(l.salePrice ?? l.price) * l.quantity)}
                    </span>
                  </div>
                  <div className="quantity-controls">
                    <button
                      className="secondary"
                      aria-label={`Giảm ${l.name}`}
                      onClick={() => quantity(l.variantId, l.quantity - 1)}
                    >
                      -
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      className="secondary"
                      aria-label={`Thêm ${l.name}`}
                      disabled={l.quantity >= Math.min(99, l.stock)}
                      onClick={() => quantity(l.variantId, l.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      className="secondary"
                      aria-label={`Xóa ${l.name}`}
                      onClick={() => quantity(l.variantId, 0)}
                    >
                      <Trash size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <ShoppingBag size={36} />
              <p>Quét sản phẩm đầu tiên để bắt đầu.</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="customer-phone">Số điện thoại khách</label>
            <input
              id="customer-phone"
              type="tel"
              maxLength={15}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setCustomer(undefined);
              }}
            />
            <button
              className="secondary"
              disabled={busy || !/^[0-9+]{9,15}$/.test(phone)}
              onClick={() =>
                void task(async () =>
                  setCustomer(
                    await api<Row>(
                      `/pos/customers?phone=${encodeURIComponent(phone)}`,
                    ),
                  ),
                )
              }
            >
              Tra khách hàng
            </button>
            {phone && !/^[0-9+]{9,15}$/.test(phone) && (
              <p className="field-error">Số điện thoại 9-15 ký tự số hoặc +.</p>
            )}
            {customer && <Details row={customer} />}
          </div>
          <div className="field">
            <label htmlFor="voucher">Mã ưu đãi</label>
            <input
              id="voucher"
              value={voucher}
              maxLength={50}
              onChange={(e) => setVoucher(e.target.value)}
            />
            <button
              className="secondary"
              disabled={busy || !lines.length}
              onClick={() =>
                void task(async () => {
                  const r = await api<Row>("/promotions/quote", "POST", {
                    items: lines.map((l) => ({
                      variantId: l.variantId,
                      quantity: l.quantity,
                    })),
                    voucher,
                  });
                  setQuote({ amount: Number(r.discount), fingerprint });
                })
              }
            >
              Áp dụng
            </button>
          </div>
          <dl className="bill-totals">
            <div>
              <dt>Tiền hàng</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div>
              <dt>Giảm giá</dt>
              <dd>{money(discount)}</dd>
            </div>
            <div>
              <dt>Cần thanh toán</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          <div className="field">
            <label htmlFor="cash-received">Tiền khách đưa</label>
            <input
              id="cash-received"
              type="number"
              min={0}
              step={1}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
            {cash && Number(cash) < total && (
              <p className="field-error">Chưa đủ số tiền thanh toán.</p>
            )}
          </div>
          <p>
            Tiền trả lại:{" "}
            <strong className="mono">
              {money(Math.max(0, Number(cash || 0) - total))}
            </strong>
          </p>
          <button
            disabled={busy || !lines.length || !cash || Number(cash) < total}
            onClick={() => void task(checkout)}
          >
            {busy ? "Đang xác nhận..." : "Thanh toán tiền mặt"}
          </button>
          <p className="hint">
            Cần mở ca trước khi thanh toán. Giá cuối cùng được máy chủ xác nhận.
          </p>
        </aside>
      </div>
      <section className="panel">
        <h2>Tra vé thử đồ tại quầy</h2>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            void task(async () =>
              setFitting(
                await api<Row>(
                  `/pos/try-on/sessions/${encodeURIComponent(pass)}?phone=${encodeURIComponent(phone)}`,
                ),
              ),
            );
          }}
        >
          <div className="field">
            <label htmlFor="fitting-pass">Mã phiên thử</label>
            <input
              id="fitting-pass"
              value={pass}
              maxLength={20}
              required
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <p className="hint">
            Dùng số điện thoại khách ở phiếu bán hàng để xác minh.
          </p>
          <button disabled={busy || !/^[0-9+]{9,15}$/.test(phone)}>
            Tra vé
          </button>
        </form>
        {fitting && <Details row={fitting} />}
      </section>
      {receipt && (
        <Modal title="Hóa đơn bán hàng" onClose={() => setReceipt(undefined)}>
          <article className="receipt">
            <h2>YoFaSo Shop</h2>
            <Details row={receipt} />
            <DataTable
              rows={(receipt.items as Row[]) || []}
              columns={["productName", "size", "quantity", "unitPrice"]}
            />
            <p>Cảm ơn bạn đã chọn YoFaSo.</p>
          </article>
          <button className="print-button" onClick={() => window.print()}>
            In hóa đơn K80
          </button>
        </Modal>
      )}
    </>
  );
}
