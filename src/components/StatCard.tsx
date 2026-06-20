import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/constants";
import type { LucideIcon } from "lucide-react";

type Variant = "income" | "expense" | "savings" | "balance";

const styles: Record<Variant | "negative", string> = {
  balance: "gradient-primary text-primary-foreground shadow-elegant",
  negative: "gradient-expense text-destructive-foreground shadow-elegant",
  income: "bg-card border",
  expense: "bg-card border",
  savings: "bg-card border",
};

const iconBg: Record<Variant | "negative", string> = {
  balance: "bg-white/20 text-primary-foreground",
  negative: "bg-white/20 text-primary-foreground",
  income: "bg-income/10 text-income",
  expense: "bg-expense/10 text-expense",
  savings: "bg-savings/10 text-savings",
};

export function StatCard({
  label, value, icon: Icon, variant, hint,
}: {
  label: string; value: number; icon: LucideIcon; variant: Variant; hint?: string;
}) {
  const isNegativeBalance = variant === "balance" && value < 0;
  const currentVariant = isNegativeBalance ? "negative" : variant;

  return (
    <div className={cn("rounded-lg p-2 transition-smooth hover:-translate-y-0.5 animate-scale-in", styles[currentVariant])}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className={cn("text-[9px] font-medium opacity-80", (variant === "balance" || isNegativeBalance) ? "text-primary-foreground/90" : "text-muted-foreground")}>{label}</div>
          <div className="font-bold text-sm mt-0.5 tracking-tight truncate">{formatINR(value)}</div>
          {hint && <div className={cn("text-[8px] mt-0.5", (variant === "balance" || isNegativeBalance) ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</div>}
        </div>
        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", iconBg[currentVariant])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
