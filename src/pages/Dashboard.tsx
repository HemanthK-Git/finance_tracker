import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Inbox } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker, type Period } from "@/components/PeriodPicker";
import { CategoryPie, MonthlyBars } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_COLORS, formatINR, type Category } from "@/lib/constants";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: txns = [], isLoading } = useTransactions();
  const now = new Date();
  const [period, setPeriod] = useState<Period>({ mode: "month", year: now.getFullYear(), month: now.getMonth() });

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== period.year) return false;
      if (period.mode === "month" && d.getMonth() !== period.month) return false;
      return true;
    });
  }, [txns, period]);

  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const recent = txns.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your financial pulse at a glance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Button asChild className="gradient-primary text-primary-foreground shadow-elegant ml-auto lg:ml-0">
            <Link to="/add"><Plus className="h-4 w-4 mr-1" /> Add</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Balance" value={savings} icon={Wallet} variant="balance" hint={`${period.mode === "month" ? "This month" : "This year"}`} />
          <StatCard label="Income" value={income} icon={TrendingUp} variant="income" />
          <StatCard label="Expenses" value={expense} icon={TrendingDown} variant="expense" />
          <StatCard label="Savings" value={savings} icon={PiggyBank} variant="savings" hint={income > 0 ? `${savingsRate}% of income` : "Add income to track"} />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="md:col-span-1 lg:col-span-2 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-display font-semibold text-lg">Spending by category</h2>
          <p className="text-xs text-muted-foreground mb-3">{period.mode === "month" ? format(new Date(period.year, period.month), "MMMM yyyy") : period.year}</p>
          {isLoading ? <Skeleton className="h-[280px] rounded-xl" /> : <CategoryPie data={filtered} />}
        </div>

        <div className="md:col-span-1 lg:col-span-3 rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-display font-semibold text-lg">Monthly trends</h2>
          <p className="text-xs text-muted-foreground mb-3">Income vs expenses · {period.year}</p>
          {isLoading ? <Skeleton className="h-[280px] rounded-xl" /> : <MonthlyBars data={txns} year={period.year} />}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Recent transactions</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/history">View all</Link></Button>
        </div>
        {isLoading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3 animate-slide-in">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: `${CATEGORY_COLORS[t.category as Category] ?? "hsl(var(--muted))"}20`, color: CATEGORY_COLORS[t.category as Category] }}
                >
                  {t.category[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.note || t.category}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {format(new Date(t.date), "MMM d, yyyy")}</div>
                </div>
                <div className={`font-display font-semibold tabular-nums ${t.type === "income" ? "text-income" : "text-expense"}`}>
                  {t.type === "income" ? "+" : "−"}{formatINR(Number(t.amount))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display font-semibold">No transactions yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Start by adding your first income or expense.</p>
      <Button asChild className="gradient-primary text-primary-foreground"><Link to="/add"><Plus className="h-4 w-4 mr-1" /> Add transaction</Link></Button>
    </div>
  );
}
