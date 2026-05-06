import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { CATEGORY_COLORS, formatINR, type Category } from "@/lib/constants";
import type { Transaction } from "@/hooks/useTransactions";

export function CategoryPie({ data }: { data: Transaction[] }) {
  const totals = new Map<string, number>();
  data.filter((t) => t.type === "expense").forEach((t) => {
    totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount));
  });
  const chartData = Array.from(totals.entries()).map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No expenses yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {chartData.map((d) => (
            <Cell key={d.name} fill={CATEGORY_COLORS[d.name as Category] ?? "hsl(var(--muted))"} stroke="hsl(var(--background))" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
          formatter={(v: number) => formatINR(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data, year }: { data: Transaction[]; year: number }) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const chartData = months.map((m, i) => ({ month: m, income: 0, expense: 0 }));
  data.forEach((t) => {
    const d = new Date(t.date);
    if (d.getFullYear() !== year) return;
    const idx = d.getMonth();
    if (t.type === "income") chartData[idx].income += Number(t.amount);
    else chartData[idx].expense += Number(t.amount);
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
          formatter={(v: number) => formatINR(v)}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" fill="hsl(var(--income))" radius={[6,6,0,0]} />
        <Bar dataKey="expense" fill="hsl(var(--expense))" radius={[6,6,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrends({ data, year }: { data: Transaction[]; year: number }) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const chartData = months.map((m, i) => ({ month: m, income: 0, expense: 0 }));
  data.forEach((t) => {
    const d = new Date(t.date);
    if (d.getFullYear() !== year) return;
    const idx = d.getMonth();
    if (t.type === "income") chartData[idx].income += Number(t.amount);
    else chartData[idx].expense += Number(t.amount);
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--income))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--income))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--expense))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--expense))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
          formatter={(v: number) => formatINR(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
        <Area
          type="monotone"
          dataKey="income"
          stroke="hsl(var(--income))"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorIncome)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="hsl(var(--expense))"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorExpense)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
