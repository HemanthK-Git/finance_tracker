import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactions, useUpsertTransaction } from "@/hooks/useTransactions";
import { ArrowLeft, Scan, FileSpreadsheet, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseMultipleTransactions, formatDate, detectCategory, type ScannedData } from "@/lib/ocr";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function AddTransaction() {
  const [params] = useSearchParams();
  const editId = params.get("id");
  const { data: transactions = [] } = useTransactions();
  const initial = editId ? transactions.find((t) => t.id === editId) ?? null : null;
  const navigate = useNavigate();
  const upsert = useUpsertTransaction();

  const [scanning, setScanning] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedData[]>([]);
  const [debugText, setDebugText] = useState<string>("");

  const handleBulkAdd = async () => {
    setScanning(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      const addedEntries: Array<{ amount: number; type: string; date: string; time?: string | null; note: string | null }> = [];

      for (const res of scannedResults) {
        let isDuplicate = false;

        for (const t of [...(transactions || []), ...addedEntries]) {
          // 1. Primary Check: If both have Transaction IDs, they MUST match exactly to be a duplicate
          if (res.transactionId && t.note?.includes(res.transactionId)) {
            isDuplicate = true;
            break;
          }
          
          // If we have a Transaction ID in the new result, but it doesn't match the one in 't', 
          // then 't' is NOT a duplicate of 'res' (even if everything else matches)
          if (res.transactionId && t.note?.match(/ID:\s*([A-Z0-9]+)/)?.[1] && !t.note.includes(res.transactionId)) {
            continue;
          }

          // 2. Fallback: Detailed field match (only if no ID or ID match wasn't conclusive)
          const amountMatch = t.amount === (res.amount || 0);
          const dateMatch = t.date === (res.date || new Date().toISOString().split('T')[0]);
          const typeMatch = t.type === res.type;
          const timeMatch = t.time === res.time || !t.time || !res.time;
          
          // Strict Note Check
          const noteMatch = (t.note || "").toLowerCase().trim().includes((res.note || "").toLowerCase().trim());

          if (amountMatch && dateMatch && typeMatch && timeMatch && noteMatch) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          skippedCount++;
          continue;
        }

        await upsert.mutateAsync({
          input: {
            type: res.type,
            amount: res.amount || 0,
            category: res.category || "Other",
            date: res.date || new Date().toISOString().split('T')[0],
            time: res.time,
            note: `${res.note} ${res.transactionId ? `(ID: ${res.transactionId})` : ''} [${res.source || 'Imported'}]`.trim(),
          }
        });

        addedEntries.push({
          amount: res.amount || 0,
          type: res.type,
          date: res.date || new Date().toISOString().split('T')[0],
          time: res.time,
          note: `${res.note} ${res.transactionId ? `(ID: ${res.transactionId})` : ''} [${res.source || 'Imported'}]`.trim()
        });
        addedCount++;
      }

      if (skippedCount > 0) {
        toast.success(`Added ${addedCount} new items. Skipped ${skippedCount} duplicates.`);
      } else {
        toast.success(`Successfully added all ${addedCount} items!`);
      }
      navigate("/history");
    } catch (error) {
      toast.error("Failed to add some transactions.");
    } finally {
      setScanning(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);

    const processSheet = (wb: XLSX.WorkBook) => {
      try {
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          toast.error("The sheet seems to be empty.");
          setScanning(false);
          return;
        }

        const results: ScannedData[] = rows.map((row: Record<string, unknown>) => {
          const findVal = (keys: string[]): string | null => {
            const key = Object.keys(row).find(k => keys.some(s => k.toLowerCase().includes(s)));
            const val = key ? row[key] : undefined;
            return val !== null && val !== undefined ? String(val) : null;
          };

          const amountRaw = findVal(['amount', 'inr', 'value', 'total', 'debit', 'credit']);
          const amount = Math.abs(parseFloat(String(amountRaw || 0).replace(/[^\d.-]/g, '')));
          
          const note = String(findVal(['person', 'particulars', 'description', 'details', 'note', 'payee', 'merchant', 'sent', 'received']) || "Excel Transaction").trim();
          const ref = String(findVal(['transaction id', 'ref', 'utr', 'id']) || "");
          
          const dateVal = findVal(['date']);
          const yearPart = String(findVal(['year']) || "");
          
          let date = "";
          if (typeof dateVal === 'number') {
            const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
            date = d.toISOString().split('T')[0];
          } else {
            const datePart = String(dateVal || "");
            const fullDateStr = datePart.length > 8 ? datePart : `${datePart} ${yearPart}`.trim();
            date = formatDate(fullDateStr);
          }

          const timeRaw = String(findVal(['time']) || "").trim();
          const timeMatch = timeRaw.match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/i);
          const time = timeMatch ? timeMatch[0] : "--:--";

          let type: "income" | "expense" = "expense";
          const typeHeader = String(findVal(['type', 'direction', 'dr/cr', 'debit/credit']) || "").toLowerCase();
          const noteLow = note.toLowerCase();
          
          if (typeHeader.includes('credit') || typeHeader.includes('cr') || typeHeader.includes('in') || noteLow.includes('received') || noteLow.includes('credited')) {
            type = "income";
          } else if (typeHeader.includes('debit') || typeHeader.includes('dr') || typeHeader.includes('out')) {
            type = "expense";
          }

          const categoryRaw = findVal(['category', 'categories']);
          const category = categoryRaw && categoryRaw.trim()
            ? categoryRaw.trim()
            : (type === "income" ? "Income" : detectCategory(note));

          return {
            amount,
            type,
            note,
            date,
            time: time === "AM" || time === "PM" ? "--:--" : time,
            category,
            transactionId: ref.trim(),
            source: file.name.substring(0, 15)
          };
        });

        const existingTx = transactions || [];
        const uniqueResults = results.filter((res, idx) => {
          const dupInDb = existingTx.some(t => {
            if (res.transactionId && t.note?.includes(res.transactionId)) return true;
            if (res.transactionId && t.note?.includes("ID: ") && !t.note.includes(res.transactionId)) return false;
            return t.amount === (res.amount || 0) &&
              t.type === res.type &&
              t.date === (res.date || "") &&
              t.time === res.time &&
              (t.note || "").toLowerCase().includes((res.note || "").toLowerCase().trim());
          });
          if (dupInDb) return false;
          const dupInBatch = results.some((other, oi) =>
            oi !== idx &&
            other.amount === res.amount &&
            other.type === res.type &&
            other.date === res.date &&
            other.time === res.time &&
            (other.note || "").toLowerCase().trim() === (res.note || "").toLowerCase().trim()
          );
          return !dupInBatch;
        });

        const skippedCount = results.length - uniqueResults.length;
        setScannedResults(uniqueResults);
        setScanning(false);
        toast.success(`Loaded ${uniqueResults.length} rows${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ""} from Excel!`);
      } catch (error) {
        toast.error("Failed to parse file.");
        setScanning(false);
      }
    };

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Failed to read file.");
      setScanning(false);
    };

    if (file.name.endsWith('.csv')) {
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: "string" });
        processSheet(wb);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        processSheet(wb);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>


      {!editId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Excel Upload */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-elegant border-dashed relative group hover:bg-accent/5 transition-smooth flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight">Excel / CSV Document</h3>
                  <p className="text-[9px] text-muted-foreground">Upload statement history</p>
                </div>
              </div>
              <div className="border-2 border-dashed border-accent/30 rounded-lg p-5 flex flex-col items-center justify-center text-center gap-1 group-hover:border-green-500/30 transition-colors">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Click or Drag File</div>
                <p className="text-[8px] text-muted-foreground">Supports .xlsx, .xls, .csv</p>
              </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {/* RIGHT: Smart Text Import */}
          <div className="rounded-xl border bg-card p-4 shadow-elegant space-y-3 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ClipboardPaste className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight">Smart Text Import</h3>
                  <p className="text-[9px] text-muted-foreground">Paste history text from bank</p>
                </div>
              </div>
              {scannedResults.length > 0 && (
                <div className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {scannedResults.length} Items
                </div>
              )}
            </div>

            <div className="relative group">
              <textarea
                placeholder="Paste here... (e.g. Apr 04, Paid to Munish, INR 10.00)"
                className="w-full h-24 p-3 text-[11px] font-mono rounded-lg border bg-accent/5 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none border-dashed group-hover:border-primary/50"
                id="manual-text-import"
                onChange={(e) => {
                  const text = e.target.value;
                  if (text.length > 20) {
                    const results = parseMultipleTransactions(text);
                    setScannedResults(results);
                  }
                }}
              />
              <div className="absolute bottom-3 right-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[9px] bg-background/80"
                  onClick={() => {
                    const el = document.getElementById('manual-text-import') as HTMLTextAreaElement;
                    if (el) el.value = '';
                    setScannedResults([]);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scannedResults.length > 1 && (
        <div className="rounded-xl border bg-card p-4 shadow-elegant animate-in slide-in-from-top-4 duration-500">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Scan className="h-4 w-4 text-primary" /> Review {scannedResults.length} Transactions
          </h2>
          <div className="overflow-x-auto -mx-4 px-4 mb-4">
            <table className="w-full text-left border-collapse border-spacing-0">
              <thead>
                <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-accent/20">
                  <th className="py-1.5 pr-3 font-bold">Date / Time</th>
                  <th className="py-1.5 pr-3 font-bold">Details</th>
                  <th className="py-1.5 pr-3 font-bold">Category</th>
                  <th className="py-1.5 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {scannedResults.map((res, idx) => {
                  const dateObj = res.date ? new Date(res.date) : new Date();
                  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                  return (
                    <tr key={`${res.note}-${res.amount}-${res.date}-${idx}`} className="group transition-colors hover:bg-accent/5">
                      <td className="py-2 pr-3 align-top">
                        <div className="text-xs font-medium whitespace-nowrap">{formattedDate}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{res.time || "--:--"}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-xs font-semibold group-hover:text-primary transition-colors line-clamp-1">{res.note}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className={`text-[9px] font-bold uppercase tracking-tighter ${res.type === 'income' ? 'text-income' : 'text-expense'}`}>
                              {res.type}
                            </div>
                            {res.transactionId && (
                              <span className="text-[8px] bg-muted text-muted-foreground px-1 py-0.5 rounded font-mono truncate max-w-[120px]">
                                ID: {res.transactionId}
                              </span>
                            )}
                            {res.source && (
                              <span className="text-[8px] bg-primary/5 text-primary px-1 py-0.5 rounded border border-primary/10 font-medium">
                                {res.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="text-[9px] bg-primary/5 text-primary px-1.5 py-0.5 rounded-full border border-primary/10 font-medium whitespace-nowrap">
                          {res.category || "Other"}
                        </span>
                      </td>
                      <td className={`py-2 align-top text-right font-mono font-bold text-xs ${res.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {res.type === 'income' ? '+' : '-'}₹{res.amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleBulkAdd} className="flex-1 gradient-primary text-primary-foreground h-9 text-xs shadow-glow">
              Add New Transactions
            </Button>
            <Button variant="outline" onClick={() => setScannedResults([])} className="h-9 px-4 text-xs">
              Clear
            </Button>
          </div>
        </div>
      )}

      {debugText && (
        <div className="p-3 bg-muted rounded-xl text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto border">
          <p className="font-bold mb-1 uppercase tracking-widest text-[8px]">Scanner Intelligence Output:</p>
          {debugText}
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <h1 className="font-bold text-base mb-0.5">{editId ? "Edit transaction" : "Add transaction"}</h1>
        <p className="text-muted-foreground text-xs mb-4">{editId ? "Update the details below." : "Record a new income or expense."}</p>
        <TransactionForm
          initial={initial}
          scannedData={scannedResults.length === 1 ? scannedResults[0] : null}
          submitting={upsert.isPending}
          submitLabel={editId ? "Update Transaction" : "Add Transaction"}
          onSubmit={(input) =>
            upsert.mutate(
              { id: editId ?? undefined, input },
              { onSuccess: () => navigate("/history") }
            )
          }
        />
      </div>
    </div>
  );
}
