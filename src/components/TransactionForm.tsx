import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionInput } from "@/hooks/useTransactions";
import { type ScannedData } from "@/lib/ocr";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000_000),
  category: z.string().min(1, "Pick a category"),
  date: z.date({ required_error: "Pick a date" }),
  note: z.string().max(200).optional(),
});

export type FormValues = z.infer<typeof schema>;

export function TransactionForm({
  initial, scannedData, onSubmit, submitting, submitLabel = "Save Transaction",
}: {
  initial?: Transaction | null;
  scannedData?: ScannedData | null;
  onSubmit: (input: TransactionInput) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      amount: scannedData?.amount ?? undefined as any,
      category: scannedData?.category ?? "Food",
      date: scannedData?.date ? new Date(scannedData.date) : new Date(),
      note: scannedData ? "Scanned from receipt" : "",
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        type: initial.type,
        amount: Number(initial.amount),
        category: initial.category,
        date: new Date(initial.date),
        note: initial.note ?? "",
      });
    }
  }, [initial]);

  useEffect(() => {
    if (scannedData) {
      form.reset({
        type: "expense",
        amount: scannedData.amount as any,
        category: scannedData.category || "Food",
        date: scannedData.date ? new Date(scannedData.date) : new Date(),
        note: "Scanned from receipt",
      });
    }
  }, [scannedData]);

  const type = form.watch("type");

  const submit = form.handleSubmit((v) => {
    onSubmit({
      type: v.type,
      amount: Number(v.amount),
      category: v.category,
      date: format(v.date, "yyyy-MM-dd"),
      note: v.note?.trim() || null,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label className="mb-2 block">Type</Label>
        <ToggleGroup
          type="single"
          value={type}
          onValueChange={(v) => v && form.setValue("type", v as any)}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem
            value="income"
            className="h-12 rounded-xl border data-[state=on]:bg-income data-[state=on]:text-primary-foreground data-[state=on]:border-income"
          >
            Income
          </ToggleGroupItem>
          <ToggleGroupItem
            value="expense"
            className="h-12 rounded-xl border data-[state=on]:bg-expense data-[state=on]:text-destructive-foreground data-[state=on]:border-expense"
          >
            Expense
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount" className="mb-2 block">Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="h-12 text-lg font-display"
            {...form.register("amount")}
          />
          {form.formState.errors.amount && (
            <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Category</Label>
          <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn("h-12 w-full justify-start text-left font-normal", !form.watch("date") && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("date") ? format(form.watch("date"), "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.watch("date")}
              onSelect={(d) => d && form.setValue("date", d)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="note" className="mb-2 block">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea id="note" rows={3} placeholder="What was it for?" {...form.register("note")} />
      </div>

      <Button type="submit" disabled={submitting} className="h-12 w-full font-semibold gradient-primary text-primary-foreground hover:opacity-95 shadow-elegant">
        {submitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
