import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/constants";
import type { LucideIcon } from "lucide-react";

type Variant = "income" | "expense" | "savings" | "balance";

const styles: Record<Variant, string> = {
  balance: "gradient-primary text-primary-foreground shadow-elegant",
  income: "bg-card border",
  expense: "bg-card border",
  savings: "bg-card border",
};

const iconBg: Record<Variant, string> = {
  balance: "bg-white/20 text-primary-foreground",
  income: "bg-income/10 text-income",
  expense: "bg-expense/10 text-expense",
  savings: "bg-savings/10 text-savings",
};

export function StatCard({
  label, value, icon: Icon, variant, hint,
}: {
  label: string; value: number; icon: LucideIcon; variant: Variant; hint?: string;
}) {
  return (
    <div className={cn("rounded-2xl p-5 transition-smooth hover:-translate-y-0.5 animate-scale-in", styles[variant])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-sm font-medium opacity-80", variant === "balance" ? "text-primary-foreground/90" : "text-muted-foreground")}>{label}</div>
          <div className="font-display text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight truncate">{formatINR(value)}</div>
          {hint && <div className={cn("text-xs mt-1.5", variant === "balance" ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</div>}
        </div>
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", iconBg[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
