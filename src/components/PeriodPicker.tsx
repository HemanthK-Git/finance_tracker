import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Period = { mode: "month" | "year"; year: number; month: number };

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={value.mode} onValueChange={(v) => onChange({ ...value, mode: v as "month" | "year" })}>
        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Monthly</SelectItem>
          <SelectItem value="year">Yearly</SelectItem>
        </SelectContent>
      </Select>
      {value.mode === "month" && (
        <Select value={String(value.month)} onValueChange={(v) => onChange({ ...value, month: Number(v) })}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={String(value.year)} onValueChange={(v) => onChange({ ...value, year: Number(v) })}>
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
