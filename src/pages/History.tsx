import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Pencil, Trash2, ArrowUpDown, Plus, Inbox, X } from "lucide-react";
import { useTransactions, useDeleteTransaction } from "@/hooks/useTransactions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CATEGORIES, CATEGORY_COLORS, formatINR, type Category } from "@/lib/constants";
import { format } from "date-fns";

type SortKey = "date" | "amount";

export default function History() {
  const { data: txns = [], isLoading } = useTransactions();
  const del = useDeleteTransaction();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = useMemo(() => {
    let r = txns.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (cat !== "all" && t.category !== cat) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(t.note ?? "").toLowerCase().includes(s) && !t.category.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      let cmp = 0;
      if (sort === "date") cmp = a.date.localeCompare(b.date);
      else cmp = Number(a.amount) - Number(b.amount);
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [txns, q, type, cat, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(k); setDir("desc"); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(id => del.mutateAsync(id))
      );
      const failed = results.filter(r => r.status === "rejected");
      if (failed.length > 0) {
        toast.error(`${failed.length} deletion(s) failed.`);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Transaction history</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} of {txns.length} transactions</p>
        </div>
        <Button asChild className="gradient-primary text-primary-foreground shadow-elegant">
          <Link to="/add"><Plus className="h-4 w-4 mr-1" /> Add</Link>
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-soft space-y-4">
        <div className="grid sm:grid-cols-12 gap-3">
          <div className="relative sm:col-span-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note or category..." className="pl-9 h-11" />
          </div>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="h-11 sm:col-span-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-11 sm:col-span-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold">No transactions found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting filters or add a new transaction.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <th className="py-3 px-2 w-10">
                      <Checkbox 
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-3 px-2">
                      <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Date <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Note</th>
                    <th className="py-3 px-2">Type</th>
                    <th className="py-3 px-2 text-right">
                      <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Amount <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-3 px-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className={`border-b last:border-0 transition-smooth ${selectedIds.has(t.id) ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <td className="py-3 px-2">
                        <Checkbox 
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">{format(new Date(t.date), "MMM d, yyyy")}</td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[t.category as Category] }} />
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-2 max-w-[260px] truncate text-muted-foreground">{t.note || "—"}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={t.type === "income" ? "border-income/40 text-income" : "border-expense/40 text-expense"}>
                          {t.type}
                        </Badge>
                      </td>
                      <td className={`py-3 px-2 text-right font-display font-semibold tabular-nums ${t.type === "income" ? "text-income" : "text-expense"}`}>
                        {t.type === "income" ? "+" : "−"}{formatINR(Number(t.amount))}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <Link to={`/add?id=${t.id}`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="lg:hidden divide-y">
              {filtered.map((t) => (
                <li key={t.id} className={`py-3 flex items-center gap-3 px-1 transition-colors ${selectedIds.has(t.id) ? 'bg-primary/5 rounded-xl' : ''}`}>
                  <Checkbox 
                    checked={selectedIds.has(t.id)}
                    onCheckedChange={() => toggleSelect(t.id)}
                    className="h-5 w-5"
                  />
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: `${CATEGORY_COLORS[t.category as Category]}20`, color: CATEGORY_COLORS[t.category as Category] }}
                  >
                    {t.category[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.note || t.category}</div>
                    <div className="text-xs text-muted-foreground">{t.category} · {format(new Date(t.date), "MMM d")}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display font-semibold tabular-nums ${t.type === "income" ? "text-income" : "text-expense"}`}>
                      {t.type === "income" ? "+" : "−"}{formatINR(Number(t.amount))}
                    </div>
                    <div className="flex justify-end mt-1">
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link to={`/add?id=${t.id}`}><Pencil className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setToDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <AlertDialog open={!!toDelete || (selectedIds.size > 0 && bulkDeleting)} onOpenChange={(o) => { if (!o) { setToDelete(null); setBulkDeleting(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete ? "Delete this transaction?" : `Delete ${selectedIds.size} transactions?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected records will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={toDelete ? () => { del.mutate(toDelete); setToDelete(null); } : handleBulkDelete}
            >
              {del.isPending || bulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-foreground text-background px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl bg-opacity-90">
            <div className="flex items-center gap-3 border-r border-white/20 pr-6">
              <div className="bg-primary h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold">
                {selectedIds.size}
              </div>
              <span className="text-sm font-medium">Selected</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs hover:bg-white/10 text-white"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-3.5 w-3.5 mr-1.5" /> Clear
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-9 px-4 rounded-xl shadow-glow-destructive"
                onClick={() => setBulkDeleting(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
