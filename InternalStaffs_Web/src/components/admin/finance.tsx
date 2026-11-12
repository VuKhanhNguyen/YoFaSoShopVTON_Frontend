import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { vnd } from "@/lib/pos";
import { api } from "@/lib/api";
import { Badge, Field, Metric, PageHeading, inputClass } from "./shared";

type Period = "today" | "week" | "month" | "all" | "custom";

interface DailyFinance {
  day: string;
  online: number;
  pos: number;
  total: number;
  orderCount?: number;
}

interface HourlyFinance {
  hour: string;
  online: number;
  pos: number;
  total: number;
  orderCount?: number;
}

interface MonthlyFinance {
  month: string;
  label: string;
  online: number;
  pos: number;
  total: number;
  orderCount?: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  orderCount: number;
}

interface CustomerBreakdown {
  tier: string;
  orderCount: number;
  totalRevenue: number;
}

interface MoneyFlowItem {
  id: string;
  label: string;
  source: string;
  expected: number;
  actual: number;
}

interface FinanceApiResponse {
  daily?: DailyFinance[];
  hourly?: HourlyFinance[];
  monthly?: MonthlyFinance[];
  payments?: PaymentBreakdown[];
  customers?: CustomerBreakdown[];
  flows?: MoneyFlowItem[];
  returnRate?: number;
  totalOrders?: number;
  completedOrders?: number;
  returnedOrders?: number;
}

/** Chuyển định dạng ngày YYYY-MM-DD sang DD/MM/YYYY */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Bảng màu cho biểu đồ thanh toán và phân khúc khách hàng
const PAYMENT_COLORS: Record<string, string> = {
  VIETQR: "#2563eb",
  TIEN_MAT: "#059669",
  COD: "#d97706",
};

const CUSTOMER_TIER_COLORS: Record<string, string> = {
  KIM_CUONG: "#8b5cf6",
  VANG: "#f59e0b",
  BAC: "#64748b",
  DONG: "#b45309",
  VIP: "#e11d48",
  VANG_LAI: "#0d9488",
};

const CUSTOMER_TIER_NAMES: Record<string, string> = {
  KIM_CUONG: "Kim Cương",
  VANG: "Vàng",
  BAC: "Bạc",
  DONG: "Đồng",
  VIP: "VIP",
  VANG_LAI: "Khách vãng lai",
};

export function Finance() {
  const [period, setPeriod] = useState<Period>("month");
  const [start, setStart] = useState("2026-09-01");
  const [end, setEnd] = useState("2026-10-31");
  const [channel, setChannel] = useState("all");

  // Dữ liệu từ MySQL thật
  const [apiData, setApiData] = useState<FinanceApiResponse | null>(null);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [localFlows, setLocalFlows] = useState<MoneyFlowItem[]>([]);

  const loadFinanceReport = async () => {
    setLoadingFinance(true);
    try {
      const data = await api<FinanceApiResponse | DailyFinance[]>("/admin/reports/finance");
      if (data && typeof data === "object") {
        if ("daily" in data && Array.isArray(data.daily)) {
          setApiData(data as FinanceApiResponse);
          if (Array.isArray(data.flows)) {
            setLocalFlows(data.flows);
          }
        } else if (Array.isArray(data)) {
          // Tương thích ngược nếu API trả về mảng daily
          setApiData({ daily: data });
        }
      }
    } catch (err) {
      console.warn("Could not load real finance report:", err);
    } finally {
      setLoadingFinance(false);
    }
  };

  useEffect(() => {
    loadFinanceReport();
  }, []);

  const dailyList: DailyFinance[] = apiData?.daily || [];
  const hourlyList: HourlyFinance[] = apiData?.hourly || [];
  const monthlyList: MonthlyFinance[] = apiData?.monthly || [];

  // Tìm ngày có đơn hàng mới nhất trong DB để làm mốc tính toán
  const latestDateStr = useMemo(() => {
    if (dailyList.length > 0) {
      return dailyList[dailyList.length - 1].day;
    }
    return "2026-10-28";
  }, [dailyList]);

  // Cấu hình dữ liệu cho Line Chart đa kênh theo 5 tab lọc
  const chartData = useMemo(() => {
    if (period === "today") {
      // 1) Tab "hôm nay": trục hoành từ 8 giờ sáng tới 23 giờ tối (16 mốc)
      const hours = [
        "08", "09", "10", "11", "12", "13", "14", "15",
        "16", "17", "18", "19", "20", "21", "22", "23",
      ];
      return hours.map((h) => {
        const found = hourlyList.find(
          (item) => item.hour === h || Number(item.hour) === Number(h)
        );
        const onlineVal = Number(found?.online || 0);
        const posVal = Number(found?.pos || 0);
        return {
          label: `${h}:00`,
          fullDate: `Khung giờ ${h}:00 - ${h}:59`,
          online: onlineVal,
          pos: posVal,
          total: onlineVal + posVal,
        };
      });
    }

    if (period === "week") {
      // 2) Tab "7 ngày qua": 7 mốc từ Ngày 1 đến Ngày 7 (14 chấm tròn cho 2 đường)
      const baseDate = new Date(latestDateStr);
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayNumber = 7 - i; // 1 đến 7
        const found = dailyList.find((item) => item.day === dateStr);
        const onlineVal = Number(found?.online || 0);
        const posVal = Number(found?.pos || 0);
        days.push({
          label: `Ngày ${dayNumber}`,
          fullDate: `${formatDisplayDate(dateStr)} (Ngày ${dayNumber})`,
          online: onlineVal,
          pos: posVal,
          total: onlineVal + posVal,
        });
      }
      return days;
    }

    if (period === "month") {
      // 3) Tab "tháng này": từng ngày trong tháng (tự động tính 28, 29, 30 hoặc 31 ngày)
      const baseDate = new Date(latestDateStr);
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth() + 1; // 1-12
      const totalDays = new Date(year, month, 0).getDate(); // Số ngày thực tế của tháng

      const days = [];
      for (let d = 1; d <= totalDays; d++) {
        const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const found = dailyList.find((item) => item.day === dayStr);
        const onlineVal = Number(found?.online || 0);
        const posVal = Number(found?.pos || 0);
        days.push({
          label: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
          fullDate: `${String(d).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
          online: onlineVal,
          pos: posVal,
          total: onlineVal + posVal,
        });
      }
      return days;
    }

    if (period === "all") {
      // 4) Tab "Tất cả": Doanh thu tổng từ trước đến nay (theo tháng)
      if (monthlyList.length > 0) {
        return monthlyList.map((m) => ({
          label: m.label || m.month,
          fullDate: m.label || m.month,
          online: Number(m.online || 0),
          pos: Number(m.pos || 0),
          total: Number(m.total || 0),
        }));
      }
      // Nếu chưa có nhiều tháng, hiển thị tất cả các ngày ghi nhận trong DB
      if (dailyList.length > 0) {
        return dailyList.map((d) => ({
          label: formatDisplayDate(d.day),
          fullDate: formatDisplayDate(d.day),
          online: Number(d.online || 0),
          pos: Number(d.pos || 0),
          total: Number(d.total || 0),
        }));
      }
      return [];
    }

    // 5) Tab "tùy chỉnh": theo khoảng range từ datetimepicker, hiển thị đầy đủ ngày trong range
    const result = [];
    const cur = new Date(start);
    const stop = new Date(end);
    if (!isNaN(cur.getTime()) && !isNaN(stop.getTime()) && cur <= stop) {
      while (cur <= stop) {
        const dateStr = cur.toISOString().slice(0, 10);
        const found = dailyList.find((item) => item.day === dateStr);
        const onlineVal = Number(found?.online || 0);
        const posVal = Number(found?.pos || 0);
        result.push({
          label: `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`,
          fullDate: formatDisplayDate(dateStr),
          online: onlineVal,
          pos: posVal,
          total: onlineVal + posVal,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }
    return result;
  }, [period, start, end, hourlyList, dailyList, monthlyList, latestDateStr]);

  // Tính tổng KPI theo khoảng đang hiển thị trên biểu đồ
  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.total, 0);
  }, [chartData]);

  const totalOnline = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.online, 0);
  }, [chartData]);

  const totalPos = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.pos, 0);
  }, [chartData]);

  // 1) Dữ liệu Cơ cấu thanh toán (Donut Chart) từ MySQL
  const paymentChartData = useMemo(() => {
    const rawPayments = apiData?.payments || [];
    let vietqrTotal = 0;
    let cashTotal = 0;
    let codTotal = 0;

    for (const p of rawPayments) {
      const val = Number(p.total || 0);
      if (p.method === "VIETQR_CHUYEN_KHOAN_ONLINE" || p.method === "VIETQR_TAI_QUAY") {
        vietqrTotal += val;
      } else if (p.method === "TIEN_MAT_TAI_QUAY") {
        cashTotal += val;
      } else if (p.method === "COD_TIEN_MAT_KHI_NHAN") {
        codTotal += val;
      }
    }

    const grandTotal = vietqrTotal + cashTotal + codTotal;
    const items = [
      {
        name: "VietQR",
        value: vietqrTotal,
        color: PAYMENT_COLORS.VIETQR,
        percent: grandTotal > 0 ? ((vietqrTotal / grandTotal) * 100).toFixed(1) : "0",
      },
      {
        name: "Tiền mặt POS",
        value: cashTotal,
        color: PAYMENT_COLORS.TIEN_MAT,
        percent: grandTotal > 0 ? ((cashTotal / grandTotal) * 100).toFixed(1) : "0",
      },
      {
        name: "COD khi nhận",
        value: codTotal,
        color: PAYMENT_COLORS.COD,
        percent: grandTotal > 0 ? ((codTotal / grandTotal) * 100).toFixed(1) : "0",
      },
    ];
    return { items, grandTotal };
  }, [apiData?.payments]);

  // 2) Dữ liệu Cơ cấu phân khúc khách hàng (Pie Chart) từ MySQL
  const customerChartData = useMemo(() => {
    const rawCustomers = apiData?.customers || [];
    const grandCustomerRevenue = rawCustomers.reduce(
      (sum, c) => sum + Number(c.totalRevenue || 0),
      0
    );

    return rawCustomers.map((c) => {
      const val = Number(c.totalRevenue || 0);
      const name = CUSTOMER_TIER_NAMES[c.tier] || c.tier;
      const color = CUSTOMER_TIER_COLORS[c.tier] || "#94a3b8";
      const percent =
        grandCustomerRevenue > 0
          ? ((val / grandCustomerRevenue) * 100).toFixed(1)
          : "0";
      return {
        name,
        value: val,
        orderCount: c.orderCount,
        color,
        percent,
      };
    });
  }, [apiData?.customers]);

  // Luồng đối soát dòng tiền
  const activeFlow = localFlows.find((f) => f.id === activeFlowId);
  const flowsAllMatched = localFlows.length > 0 && localFlows.every((f) => Number(f.actual) === Number(f.expected));

  const handleDownloadReconciliation = () => {
    const csv =
      "Luồng tiền,Nguồn đối soát,Sổ sách (VND),Thực nhận (VND),Chênh lệch (VND),Trạng thái\n" +
      localFlows
        .map(
          (f) =>
            `"${f.label}","${f.source}",${f.expected},${f.actual},${f.actual - f.expected},"${
              f.actual === f.expected ? "KHỚP 100%" : "SAI LỆCH"
            }"`
        )
        .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `yofaso-doi-soat-tai-chinh-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeading
        eyebrow="Executive Overview · MySQL Realtime Database"
        title="Tổng quan vận hành & Báo cáo tài chính"
        detail="Theo dõi doanh thu đa kênh, đối soát dòng tiền và cơ cấu khách hàng thời gian thực"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFinanceReport} disabled={loadingFinance}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingFinance ? "animate-spin" : ""}`} />
            Làm mới số liệu
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadReconciliation}>
            <Download className="mr-1.5 h-4 w-4" /> Xuất đối soát
          </Button>
        </div>
      </PageHeading>

      {/* 1) BỘ 5 TAB LỌC THỜI GIAN: Hôm nay, 7 ngày qua, Tháng này, Tất cả, Tùy chỉnh */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            { k: "today", l: "Hôm nay" },
            { k: "week", l: "7 ngày qua" },
            { k: "month", l: "Tháng này" },
            { k: "all", l: "Tất cả" },
            { k: "custom", l: "Tùy chỉnh" },
          ] as const
        ).map((p) => (
          <Button
            key={p.k}
            variant={period === p.k ? "default" : "outline"}
            onClick={() => setPeriod(p.k)}
          >
            {p.l}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {dailyList.length > 0
            ? "Đồng bộ trực tiếp từ bảng DonHang"
            : "Đang tải dữ liệu ..."}
        </span>
      </div>

      {/* TÙY CHỈNH KHOẢNG NGÀY (Định dạng dd/mm/yyyy) */}
      {period === "custom" && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <Field label="Từ ngày">
            <input
              className={inputClass}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              className={inputClass}
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <div className="mt-4 text-xs text-muted-foreground font-mono">
            Khoảng lọc: <strong>{formatDisplayDate(start)}</strong> → <strong>{formatDisplayDate(end)}</strong> ({chartData.length} ngày)
          </div>
          {start > end && (
            <p role="alert" className="w-full text-xs text-destructive">
              Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
            </p>
          )}
        </div>
      )}

      {/* THẺ SỐ LIỆU TỔNG QUAN (KPI CARDS TỪ DỮ LIỆU THẬT) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={
            period === "today"
              ? "Doanh thu hôm nay"
              : period === "week"
              ? "Doanh thu 7 ngày qua"
              : period === "month"
              ? "Doanh thu tháng này"
              : period === "all"
              ? "Tổng doanh thu toàn bộ"
              : "Doanh thu kỳ tùy chọn"
          }
          value={vnd(totalRevenue)}
          note={`${chartData.length} mốc thời gian ghi nhận`}
          positive
        />
        <Metric
          label="Online · Mobile App"
          value={vnd(totalOnline)}
          note={`${totalRevenue > 0 ? ((totalOnline / totalRevenue) * 100).toFixed(1) : 0}% tổng doanh thu kỳ`}
        />
        <Metric
          label="Tại quầy · Web POS"
          value={vnd(totalPos)}
          note={`${totalRevenue > 0 ? ((totalPos / totalRevenue) * 100).toFixed(1) : 0}% tổng doanh thu kỳ`}
        />
        <Metric
          label="Tỷ lệ đơn hoàn trả"
          value={`${apiData?.returnRate !== undefined ? apiData.returnRate : 0}%`}
          note={`${apiData?.returnedOrders || 0} đơn hoàn trả trên tổng số ${apiData?.totalOrders || 0} đơn`}
          positive={(apiData?.returnRate || 0) <= 5}
        />
      </div>

      {/* 2) BIỂU ĐỒ ĐƯỜNG DOANH THU ĐA KÊNH FULL WIDTH (LINE GRAPH CÓ CHẤM TRÒN) */}
      <section className="mt-7 w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Doanh thu đa kênh</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {period === "today" && "Trục hoành hiển thị từ 08:00 đến 23:00 (16 mốc giờ theo dõi trong ngày) · VND"}
              {period === "week" && "Trục hoành hiển thị 7 ngày gần nhất (tổng cộng 14 chấm tròn cho 2 kênh doanh thu) · VND"}
              {period === "month" && `Trục hoành hiển thị đủ các ngày trong tháng (${chartData.length} ngày) · VND`}
              {period === "all" && "Toàn bộ doanh thu lũy kế từ trước đến nay · VND"}
              {period === "custom" && `Trục hoành theo ngày tùy chỉnh (${formatDisplayDate(start)} đến ${formatDisplayDate(end)} - đủ ${chartData.length} mốc) · VND`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Lọc kênh bán hàng"
              className={inputClass}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="all">Tất cả kênh (Online & POS)</option>
              <option value="online">Chỉ Online App</option>
              <option value="pos">Chỉ Tại quầy POS</option>
            </select>
          </div>
        </div>

        <div className="h-80 w-full min-w-0 pr-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000000).toLocaleString("vi-VN")}tr`}
                  tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  formatter={(v: any, name: any) => [vnd(Number(v || 0)), name]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row?.fullDate || label;
                  }}
                  contentStyle={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                  }}
                />
                {channel !== "pos" && (
                  <Line
                    type="monotone"
                    dataKey="online"
                    name="Online App"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6, fill: "#2563eb" }}
                  />
                )}
                {channel !== "online" && (
                  <Line
                    type="monotone"
                    dataKey="pos"
                    name="Tại quầy POS"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#059669", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6, fill: "#059669" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Không có dữ liệu phát sinh trong kỳ này.
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-center gap-8 border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#2563eb] ring-2 ring-[#2563eb]/20" />
            <strong className="font-medium text-foreground">Online App:</strong>
            <span className="font-mono text-muted-foreground">{vnd(totalOnline)}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#059669] ring-2 ring-[#059669]/20" />
            <strong className="font-medium text-foreground">Tại quầy POS:</strong>
            <span className="font-mono text-muted-foreground">{vnd(totalPos)}</span>
          </span>
        </div>
      </section>

      {/* 3) HÀNG 2 BIỂU ĐỒ CÂN ĐỐI ĐỒNG ĐỀU: DONUT CHART & PIE CHART */}
      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BIỂU ĐỒ 1: CƠ CẤU THANH TOÁN (DONUT CHART) */}
        <section className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Cơ cấu phương thức thanh toán</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Phân bổ doanh thu theo cổng thanh toán từ hệ thống
                </p>
              </div>
              <Badge tone="neutral">Đa kênh</Badge>
            </div>

            <div className="relative my-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData.items}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                  >
                    {paymentChartData.items.map((entry, index) => (
                      <Cell key={`cell-pay-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [vnd(Number(v || 0)), "Doanh thu"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-medium text-muted-foreground">Tổng thanh toán</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {vnd(paymentChartData.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            {paymentChartData.items.map((item) => (
              <div key={item.name} className="flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate max-w-[95px]">{item.name}</span>
                </div>
                <span className="mt-1 font-mono text-xs font-semibold">{item.percent}%</span>
                <span className="font-mono text-[11px] text-muted-foreground">{vnd(item.value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BIỂU ĐỒ 2: CƠ CẤU PHÂN KHÚC KHÁCH HÀNG CRM (PIE CHART) */}
        <section className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Cơ cấu phân khúc khách hàng & CRM</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Doanh thu theo hạng thành viên & khách vãng lai từ bảng NguoiDung
                </p>
              </div>
              <Badge tone="neutral">Khách hàng</Badge>
            </div>

            <div className="relative my-4 h-64 w-full">
              {customerChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerChartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {customerChartData.map((entry, index) => (
                        <Cell key={`cell-cust-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, name: any, item: any) => [
                        `${vnd(Number(v || 0))} (${item.payload.orderCount} đơn)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Chưa có dữ liệu phân khúc khách hàng.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3">
            {customerChartData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.name}:</span>
                <span className="font-mono text-muted-foreground">
                  {item.percent}% ({vnd(item.value)})
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 4) ĐỐI SOÁT TÀI CHÍNH CHỐNG THẤT THOÁT (DỮ LIỆU THẬT TỪ DATABASE) */}
      <section className="mt-8 border-t border-border pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Đối soát tài chính chống thất thoát</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Đối chiếu sao kê ngân hàng · Kết ca thu ngân POS · Tiền thu hộ COD
            </p>
          </div>
          <Badge tone={flowsAllMatched ? "success" : "danger"}>
            {flowsAllMatched ? "Dòng tiền khớp 100%" : "Phát hiện sai lệch"}
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Luồng tiền</th>
                <th>Sổ sách hệ thống (VND)</th>
                <th>Thực nhận đối soát (VND)</th>
                <th>Chênh lệch</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {localFlows.map((f) => {
                const diff = Number(f.actual) - Number(f.expected);
                const matched = diff === 0;
                return (
                  <tr key={f.id}>
                    <td>
                      <p className="font-semibold">{f.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{f.source}</p>
                    </td>
                    <td className="font-mono">{vnd(Number(f.expected))}</td>
                    <td className="font-mono">{vnd(Number(f.actual))}</td>
                    <td className={`font-mono ${matched ? "text-success" : "text-destructive"}`}>
                      {vnd(diff)}
                    </td>
                    <td>
                      <Badge tone={matched ? "success" : "danger"}>
                        {matched ? "KHỚP 100%" : "SAI LỆCH"}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Chi tiết ${f.label}`}
                        onClick={() => setActiveFlowId(f.id)}
                      >
                        <ChevronRight />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {localFlows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Đang đồng bộ dữ liệu đối soát tài chính...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          role="status"
          className={`mt-3 flex items-center gap-3 rounded-md p-4 text-xs font-semibold ${
            flowsAllMatched ? "bg-success-subtle text-success" : "bg-danger-subtle text-destructive"
          }`}
        >
          {flowsAllMatched ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          {flowsAllMatched
            ? "DÒNG TIỀN MINH BẠCH — ĐỐI SOÁT KHỚP 100% VỚI CƠ SỞ DỮ LIỆU"
            : "CẢNH BÁO: PHÁT HIỆN CHÊNH LỆCH DÒNG TIỀN — VUI LÒNG KIỂM TRA LẠI KẾT CA VÀ SAO KÊ"}
        </div>
      </section>

      {/* DIALOG KIỂM TRA ĐỐI SOÁT */}
      {activeFlow && (
        <Dialog open onOpenChange={(open) => !open && setActiveFlowId(null)}>
          <DialogContent>
            <DialogTitle>{activeFlow.label}</DialogTitle>
            <DialogDescription>
              Nguồn đối chiếu: {activeFlow.source}. Bạn có thể cập nhật số tiền thực nhận để kiểm tra phản ứng cảnh báo của hệ thống.
            </DialogDescription>
            <p className="font-mono text-lg">Sổ sách hệ thống: {vnd(Number(activeFlow.expected))}</p>
            <Field label="Số tiền thực nhận (đ)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={activeFlow.actual}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value));
                  setLocalFlows((prev) =>
                    prev.map((f) => (f.id === activeFlow.id ? { ...f, actual: val } : f))
                  );
                }}
              />
            </Field>
            <p className="font-mono">
              Chênh lệch: {vnd(Number(activeFlow.actual) - Number(activeFlow.expected))}
            </p>
            <Button onClick={() => setActiveFlowId(null)}>Hoàn tất đối chiếu</Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
