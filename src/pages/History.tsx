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
    <div className="max-w-7xl mx-auto space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm">History</h1>
          <span className="text-[10px] text-muted-foreground">{filtered.length} of {txns.length}</span>
        </div>
        <Button asChild className="gradient-primary text-primary-foreground shadow-elegant h-7 text-[10px] px-2">
          <Link to="/add"><Plus className="h-3.5 w-3.5 mr-0.5" /> Add</Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-soft space-y-3">
        <div className="grid sm:grid-cols-12 gap-2">
          <div className="relative sm:col-span-6">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note or category..." className="pl-8 h-8 text-xs" />
          </div>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="h-8 text-xs sm:col-span-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-8 text-xs sm:col-span-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-1.5">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xs">No transactions found</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Try adjusting filters or add a new transaction.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="py-1.5 px-1.5 w-8">
                      <Checkbox 
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-1.5 px-1.5">
                      <button onClick={() => toggleSort("date")} className="inline-flex items-center gap-0.5 hover:text-foreground">
                        Date <ArrowUpDown className="h-2.5 w-2.5" />
                      </button>
                    </th>
                    <th className="py-1.5 px-1.5">Category</th>
                    <th className="py-1.5 px-1.5">Note</th>
                    <th className="py-1.5 px-1.5">Type</th>
                    <th className="py-1.5 px-1.5 text-right">
                      <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-0.5 hover:text-foreground">
                        Amount <ArrowUpDown className="h-2.5 w-2.5" />
                      </button>
                    </th>
                    <th className="py-1.5 px-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className={`border-b last:border-0 transition-smooth ${selectedIds.has(t.id) ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <td className="py-1.5 px-1.5">
                        <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                      </td>
                      <td className="py-1.5 px-1.5 whitespace-nowrap text-[10px]">{format(new Date(t.date), "MMM d, yyyy")}</td>
                      <td className="py-1.5 px-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px]">
                          <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[t.category as Category] }} />
                          {t.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-1.5 max-w-[200px] truncate text-muted-foreground text-[10px]">{t.note || "—"}</td>
                      <td className="py-1.5 px-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border ${t.type === "income" ? "border-income/40 text-income" : "border-expense/40 text-expense"}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className={`py-1.5 px-1.5 text-right font-semibold text-[10px] tabular-nums ${t.type === "income" ? "text-income" : "text-expense"}`}>
                        {t.type === "income" ? "+" : "−"}{formatINR(Number(t.amount))}
                      </td>
                      <td className="py-1.5 px-1.5">
                        <div className="flex justify-end gap-0.5">
                          <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                            <Link to={`/add?id=${t.id}`}><Pencil className="h-3 w-3" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setToDelete(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="lg:hidden divide-y">
              {filtered.map((t) => (
                <li key={t.id} className={`py-1.5 flex items-center gap-1.5 px-0.5 transition-colors ${selectedIds.has(t.id) ? 'bg-primary/5 rounded-lg' : ''}`}>
                  <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} className="h-4 w-4" />
                  <div
                    className="h-6 w-6 rounded-lg flex items-center justify-center text-[8px] font-semibold shrink-0"
                    style={{ background: `${CATEGORY_COLORS[t.category as Category]}20`, color: CATEGORY_COLORS[t.category as Category] }}
                  >
                    {t.category[0]}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1">
                    <span className="text-[10px] font-medium truncate max-w-[120px]">{t.note || t.category}</span>
                    <span className="text-[8px] text-muted-foreground shrink-0">{t.category}</span>
                  </div>
                  <div className="font-semibold text-[10px] tabular-nums shrink-0 mr-1">
                    <span className={t.type === "income" ? "text-income" : "text-expense"}>{t.type === "income" ? "+" : "−"}{formatINR(Number(t.amount))}</span>
                  </div>
                  <Button asChild variant="ghost" size="icon" className="h-5 w-5">
                    <Link to={`/add?id=${t.id}`}><Pencil className="h-3 w-3" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setToDelete(t.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <AlertDialog open={!!toDelete || (selectedIds.size > 0 && bulkDeleting)} onOpenChange={(o) => { if (!o) { setToDelete(null); setBulkDeleting(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              {toDelete ? "Delete this transaction?" : `Delete ${selectedIds.size} transactions?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-7 text-xs"
              onClick={toDelete ? () => { del.mutate(toDelete); setToDelete(null); } : handleBulkDelete}
            >
              {del.isPending || bulkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-foreground text-background px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-xl bg-opacity-90">
            <div className="flex items-center gap-2 border-r border-white/20 pr-4">
              <div className="bg-primary h-5 w-5 rounded-md flex items-center justify-center text-[8px] font-bold">{selectedIds.size}</div>
              <span className="text-xs font-medium">Selected</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] hover:bg-white/10 text-white px-2" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
              <Button variant="destructive" size="sm" className="h-7 px-3 rounded-lg text-xs" onClick={() => setBulkDeleting(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
