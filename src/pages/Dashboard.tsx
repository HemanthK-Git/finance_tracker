import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Inbox } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker, type Period } from "@/components/PeriodPicker";
import { CategoryPie, MonthlyTrends } from "@/components/Charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_COLORS, formatINR, type Category } from "@/lib/constants";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: txns = [], isLoading } = useTransactions();
  const now = new Date();
  const [period, setPeriod] = useState<Period>({ 
    mode: "month", 
    year: now.getFullYear(), 
    month: now.getMonth(),
    day: now.getDate() 
  });

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== period.year) return false;
      if (period.mode === "year") return true;
      if (d.getMonth() !== period.month) return false;
      if (period.mode === "month") return true;
      if (d.getDate() !== period.day) return false;
      return true;
    });
  }, [txns, period]);

  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  const totalBalance = useMemo(() => {
    return txns.reduce((acc, t) => {
      const d = new Date(t.date);
      const isPastOrCurrent = d.getFullYear() < period.year || 
        (d.getFullYear() === period.year && (
          period.mode === "year" || 
          d.getMonth() <= period.month
        ));
      
      if (!isPastOrCurrent) return acc;
      const amt = Number(t.amount);
      return t.type === "income" ? acc + amt : acc - amt;
    }, 0);
  }, [txns, period]);

  const recent = txns.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm">Dashboard</h1>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">Track your financial pulse</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Button asChild className="gradient-primary text-primary-foreground shadow-elegant h-7 text-[10px] px-2">
            <Link to="/add"><Plus className="h-3 w-3 mr-0.5" /> Add</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard 
            label="Balance" 
            value={totalBalance} 
            icon={Wallet} 
            variant="balance" 
            hint={`End of ${period.mode === "month" ? format(new Date(period.year, period.month), "MMM") : period.year}`} 
          />
          <StatCard label="Income" value={income} icon={TrendingUp} variant="income" />
          <StatCard label="Expenses" value={expense} icon={TrendingDown} variant="expense" />
          <StatCard label="Savings" value={savings} icon={PiggyBank} variant="savings" hint={income > 0 ? `${savingsRate}% of income` : "Add income to track"} />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="md:col-span-1 lg:col-span-2 rounded-lg border bg-card p-2 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="font-semibold text-[10px]">Spending by category</h2>
            <span className="text-[8px] text-muted-foreground">{period.mode === "month" ? format(new Date(period.year, period.month), "MMM yyyy") : period.year}</span>
          </div>
          {isLoading ? <Skeleton className="h-[150px] rounded-lg" /> : <CategoryPie data={filtered} />}
        </div>

        <div className="md:col-span-1 lg:col-span-3 rounded-lg border bg-card p-2 shadow-soft">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="font-semibold text-[10px]">Monthly trends</h2>
            <span className="text-[8px] text-muted-foreground">Income vs expenses · {period.year}</span>
          </div>
          {isLoading ? <Skeleton className="h-[150px] rounded-lg" /> : <MonthlyTrends data={txns} year={period.year} />}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-2 shadow-soft">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="font-semibold text-[10px]">Recent transactions</h2>
          <Button asChild variant="ghost" size="sm" className="h-5 text-[9px] px-1"><Link to="/history">View all</Link></Button>
        </div>
        {isLoading ? (
          <div className="space-y-1">{[0,1,2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
        ) : recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-1.5 py-1 animate-slide-in">
                <div
                  className="h-5 w-5 rounded flex items-center justify-center text-[7px] font-semibold shrink-0"
                  style={{ background: `${CATEGORY_COLORS[t.category as Category] ?? "hsl(var(--muted))"}20`, color: CATEGORY_COLORS[t.category as Category] }}
                >
                  {t.category[0]}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span className="text-[10px] font-medium truncate max-w-[180px]">{t.note || t.category}</span>
                  <span className="text-[8px] text-muted-foreground shrink-0">{t.category}</span>
                </div>
                <div className={`font-semibold text-[10px] tabular-nums shrink-0 ${t.type === "income" ? "text-income" : "text-expense"}`}>
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
    <div className="text-center py-6">
      <div className="mx-auto h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-2">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-xs">No transactions yet</h3>
      <p className="text-[10px] text-muted-foreground mt-0.5 mb-3">Start by adding your first income or expense.</p>
      <Button asChild className="gradient-primary text-primary-foreground h-7 text-[10px]"><Link to="/add"><Plus className="h-3.5 w-3.5 mr-1" /> Add transaction</Link></Button>
    </div>
  );
}
