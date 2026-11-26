"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shirt } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { api, catalogImage } from "@/lib/api";
import { pushToast } from "@/lib/feedback";
import { vnd } from "@/lib/pos";
import { Badge, Metric, PageHeading } from "./shared";

interface FunnelStep {
  label: string;
  count: number;
  note: string;
}

interface AbBucket {
  orderCount: number;
  completedCount: number;
  returnedCount: number;
  returnRate: number;
  revenue: number;
  avgOrderValue: number;
}

interface TopCombo {
  mainVariantId: string;
  recVariantId: string;
  mainProductName: string;
  recProductName: string;
  mainPrice: number;
  recPrice: number;
  avgProjectedScore: number;
  suggestedCount: number;
  purchasedCount: number;
  mainImageUrl?: string | null;
  recImageUrl?: string | null;
}

interface VtonReport {
  periodDays: number;
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  scoredSessions: number;
  avgScore: number;
  funnel: FunnelStep[];
  interactions: Record<string, number>;
  abComparison: {
    vton: AbBucket;
    nonVton: AbBucket;
  };
  crossSell: {
    purchasedSuggestions: number;
    orderLines: number;
    revenue: number;
  };
  scoreDistribution: {
    recommended: number;
    acceptable: number;
    needsAdjustment: number;
    notRecommended: number;
  };
  topCombos: TopCombo[];
}

export function Analytics() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<VtonReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async (windowDays: number, silent = false) => {
    setLoading(true);
    try {
      const data = await api<VtonReport>(`/admin/reports/vton?days=${windowDays}`);
      setReport(data);
    } catch (err) {
      if (!silent) {
        pushToast({
          tone: "error",
          title: "Không tải được báo cáo VTON & AI",
          detail: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(days, true);
  }, [days, loadReport]);

  const funnel = report?.funnel || [];
  const maxFunnel = Math.max(1, funnel[0]?.count || 1);
  const vtonOrders = report?.abComparison?.vton?.orderCount || 0;
  const completedSessions = report?.completedSessions || 0;
  const vtonConvRate =
    completedSessions > 0 ? Math.round((vtonOrders / completedSessions) * 1000) / 10 : 0;

  const vtonRetRate = report?.abComparison?.vton?.returnRate ?? 0;
  const nonVtonRetRate = report?.abComparison?.nonVton?.returnRate ?? 0;

  const distRaw = report?.scoreDistribution;
  const distTotal =
    Number(distRaw?.recommended || 0) +
    Number(distRaw?.acceptable || 0) +
    Number(distRaw?.needsAdjustment || 0) +
    Number(distRaw?.notRecommended || 0);
  const toPct = (n: number) => (distTotal > 0 ? Math.round((n / distTotal) * 1000) / 10 : 0);

  const distribution = [
    { name: "RECOMMENDED · 85–100", count: Number(distRaw?.recommended || 0), value: toPct(Number(distRaw?.recommended || 0)), color: "var(--success)" },
    { name: "ACCEPTABLE · 70–84", count: Number(distRaw?.acceptable || 0), value: toPct(Number(distRaw?.acceptable || 0)), color: "var(--primary)" },
    { name: "NEEDS_ADJUSTMENT · 50–69", count: Number(distRaw?.needsAdjustment || 0), value: toPct(Number(distRaw?.needsAdjustment || 0)), color: "var(--accent)" },
    { name: "NOT_RECOMMENDED · <50", count: Number(distRaw?.notRecommended || 0), value: toPct(Number(distRaw?.notRecommended || 0)), color: "var(--destructive)" },
  ];

  const interactions = report?.interactions || {
    CHUA_XEM: 0,
    DA_THU_THEM: 0,
    DA_THEM_GIO_HANG: 0,
    DA_MUA: 0,
  };

  const abChartData = [
    {
      name: "Có VTON",
      orders: report?.abComparison?.vton?.orderCount || 0,
      returnRate: vtonRetRate,
      aov: report?.abComparison?.vton?.avgOrderValue || 0,
    },
    {
      name: "Không VTON",
      orders: report?.abComparison?.nonVton?.orderCount || 0,
      returnRate: nonVtonRetRate,
      aov: report?.abComparison?.nonVton?.avgOrderValue || 0,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="AI impact · VTON & Stylist · MySQL Realtime"
        title="Báo cáo tác động kinh doanh của AI"
        detail={`${(report?.totalSessions || 0).toLocaleString("vi-VN")} phiên thử đồ trong ${days} ngày qua · Đồng bộ trực tiếp từ PhienThuDoAo, GoiYPhoiDo và DonHang`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d} ngày
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadReport(days)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </PageHeading>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Chuyển đổi phiên VTON → đơn"
          value={`${vtonConvRate}%`}
          note={`${vtonOrders} đơn gắn VTON / ${completedSessions} phiên thành công`}
          positive={vtonConvRate > 0}
        />
        <Metric
          label="Tỷ lệ hoàn hàng (VTON vs Thường)"
          value={`${vtonRetRate}% vs ${nonVtonRetRate}%`}
          note={`VTON: ${report?.abComparison?.vton?.returnedCount || 0} đơn hoàn · Thường: ${report?.abComparison?.nonVton?.returnedCount || 0} đơn hoàn`}
          positive={vtonRetRate <= nonVtonRetRate}
        />
        <Metric
          label="Doanh thu bán kèm AI Stylist"
          value={vnd(Number(report?.crossSell?.revenue || 0))}
          note={`${report?.crossSell?.purchasedSuggestions || 0} gợi ý đã chuyển thành DA_MUA`}
          positive={Number(report?.crossSell?.revenue || 0) > 0}
        />
        <Metric
          label="Điểm thẩm mỹ trung bình"
          value={`${report?.avgScore ?? 0}/100`}
          note={`${report?.scoredSessions || 0} phiên đã chấm điểm 40/40/20`}
          positive={(report?.avgScore ?? 0) >= 75}
        />
      </div>

      {/* Interaction Status Strip for GoiYPhoiDo */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "CHUA_XEM", label: "Gợi ý chưa tương tác", tone: "neutral" as const },
          { k: "DA_THU_THEM", label: "Đã ướm thử thêm", tone: "info" as const },
          { k: "DA_THEM_GIO_HANG", label: "Đã thêm vào túi đồ", tone: "warning" as const },
          { k: "DA_MUA", label: "Đã chốt đơn mua kèm", tone: "success" as const },
        ].map((item) => (
          <div
            key={item.k}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-foreground">
                {Number(interactions[item.k] || 0).toLocaleString("vi-VN")}
              </p>
            </div>
            <Badge tone={item.tone}>{item.k}</Badge>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Phễu chuyển đổi VTON 5 bước</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Số liệu truy vấn trực tiếp từ MySQL trong {days} ngày gần nhất.
          </p>
          <div className="mt-5 space-y-3">
            {funnel.map((f, i) => (
              <div
                key={f.label}
                className={`grid grid-cols-[32px_minmax(0,1fr)] gap-3 ${
                  step === i ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-border font-mono text-xs">
                  0{i + 1}
                </span>
                <div>
                  <div className="mb-1.5 flex flex-wrap justify-between gap-1 text-xs">
                    <span className="font-semibold">{f.label}</span>
                    <span className="font-mono">
                      {Number(f.count || 0).toLocaleString("vi-VN")} · {f.note}
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-sm bg-surface-muted">
                    <div
                      role="progressbar"
                      aria-label={f.label}
                      aria-valuenow={f.count}
                      aria-valuemax={maxFunnel}
                      className={`h-full transition-all ${
                        i === 4 ? "bg-success" : i % 2 === 0 ? "bg-primary" : "bg-accent"
                      }`}
                      style={{
                        width: `${f.count > 0 ? Math.max(8, (f.count / maxFunnel) * 100) : 0}%`,
                      }}
                      onMouseEnter={() => setStep(i)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">So sánh A/B · Đơn có VTON vs Không VTON</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Số lượng đơn hàng và giá trị trung bình đơn (AOV) trong {days} ngày qua
          </p>
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={abChartData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(v: unknown) => [`${Number(v || 0)} đơn`, "Số lượng đơn"]}
                />
                <Bar dataKey="orders" name="Số đơn hàng" radius={[4, 4, 0, 0]} maxBarSize={70}>
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--accent)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Có VTON · AOV</p>
              <p className="font-mono font-semibold text-success">
                {vnd(report?.abComparison?.vton?.avgOrderValue || 0)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Không VTON · AOV</p>
              <p className="font-mono font-semibold text-foreground">
                {vnd(report?.abComparison?.nonVton?.avgOrderValue || 0)}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Top combo gợi ý phối đồ thực tế</h2>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Combo phối đồ</th>
                  <th>Điểm TB</th>
                  <th>Lượt gợi ý</th>
                  <th>Đã bán</th>
                </tr>
              </thead>
              <tbody>
                {(report?.topCombos || []).map((c, i) => (
                  <tr key={`${c.mainVariantId}-${c.recVariantId}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                        <div className="flex shrink-0 gap-1">
                          {c.mainImageUrl ? (
                            <img
                              src={catalogImage(c.mainImageUrl)}
                              alt={c.mainProductName}
                              className="h-12 w-10 rounded border border-border object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-10 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                              <Shirt className="h-4 w-4" />
                            </div>
                          )}
                          {c.recImageUrl ? (
                            <img
                              src={catalogImage(c.recImageUrl)}
                              alt={c.recProductName}
                              className="h-12 w-10 rounded border border-border object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-10 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                              <Shirt className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="max-w-60 text-sm font-semibold">
                          {c.mainProductName} + {c.recProductName}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-success">{c.avgProjectedScore}/100</td>
                    <td className="font-mono">{c.suggestedCount}</td>
                    <td className="font-mono font-semibold">{c.purchasedCount} combo</td>
                  </tr>
                ))}
                {(!report?.topCombos || report.topCombos.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {loading
                        ? "Đang tải danh sách combo từ cơ sở dữ liệu..."
                        : `Chưa có dữ liệu combo gợi ý nào trong ${days} ngày qua.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Phân bổ điểm thẩm mỹ ({distTotal} phiên)</h2>
          <div className="h-48">
            {distTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution.filter((d) => d.count > 0)}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {distribution
                      .filter((d) => d.count > 0)
                      .map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Chưa có phiên nào được chấm điểm trong kỳ này.
              </div>
            )}
          </div>
          <div className="space-y-2.5">
            {distribution.map((d, i) => (
              <div key={d.name} className="flex justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-2">
                  <i
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      ["bg-success", "bg-primary", "bg-accent", "bg-destructive"][i]
                    }`}
                  />
                  {d.name}
                </span>
                <span className="font-mono">
                  {d.count} phiên ({d.value}%)
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
