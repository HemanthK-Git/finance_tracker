import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactions, useUpsertTransaction } from "@/hooks/useTransactions";
import { ArrowLeft, Scan, Loader2, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanReceipt, parseMultipleTransactions, type ScannedData } from "@/lib/ocr";
import { toast } from "sonner";

export default function AddTransaction() {
  const [params] = useSearchParams();
  const editId = params.get("id");
  const { data: txns = [] } = useTransactions();
  const initial = editId ? txns.find((t) => t.id === editId) ?? null : null;
  const navigate = useNavigate();
  const upsert = useUpsertTransaction();
  
  const [scanning, setScanning] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedData[]>([]);
  const [debugText, setDebugText] = useState<string>("");

  const { data: transactions = [] } = useTransactions();

  const handleBulkAdd = async () => {
    setScanning(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      for (const res of scannedResults) {
        // Check for duplicates (same amount, note, and date)
        const isDuplicate = transactions?.some(t => 
          (res.transactionId && t.note?.includes(res.transactionId)) ||
          (t.amount === (res.amount || 0) && 
           t.note?.toLowerCase().trim().includes((res.note || "").toLowerCase().trim()) && 
           t.date === (res.date || new Date().toISOString().split('T')[0]))
        );

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
            note: `${res.note} ${res.transactionId ? `(ID: ${res.transactionId})` : ''} [${res.source || 'Imported'}]`.trim(),
          }
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

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>


      {!editId && (
        <div className="rounded-2xl border bg-card p-6 shadow-elegant space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <FileImage className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Smart Text Import</h3>
                <p className="text-[10px] text-muted-foreground">Paste history text from your bank</p>
              </div>
            </div>
            {scannedResults.length > 0 && (
              <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full animate-bounce">
                {scannedResults.length} Items Found
              </div>
            )}
          </div>

          <div className="relative group">
            <textarea
              placeholder="Paste your bank statement text here... (e.g. Apr 04, Paid to Pankaj, INR 20.00)"
              className="w-full h-40 p-4 text-xs font-mono rounded-xl border bg-accent/5 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none border-dashed group-hover:border-primary/50"
              id="manual-text-import"
              onChange={(e) => {
                const text = e.target.value;
                if (text.length > 30) {
                  const results = parseMultipleTransactions(text);
                  setScannedResults(results);
                  if (results.length > 0) {
                    setDebugText(`Smart parser identified ${results.length} transactions from your text.`);
                  }
                }
              }}
            />
            <div className="absolute bottom-3 right-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] bg-background/80 backdrop-blur-sm"
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
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-lg">
            <Scan className="h-3 w-3" />
            <span>AI will automatically detect Dates, Amounts, and Names from your pasted text.</span>
          </div>
        </div>
      )}

      {scannedResults.length > 1 && (
        <div className="rounded-2xl border bg-card p-5 shadow-elegant animate-in slide-in-from-top-4 duration-500">
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" /> Review {scannedResults.length} Transactions
          </h2>
          <div className="overflow-x-auto -mx-5 px-5 mb-6">
            <table className="w-full text-left border-collapse border-spacing-0">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-accent/20">
                  <th className="py-3 pr-4 font-bold">Date / Time</th>
                  <th className="py-3 pr-4 font-bold">Transaction Details</th>
                  <th className="py-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {scannedResults.map((res, idx) => {
                  const dateObj = res.date ? new Date(res.date) : new Date();
                  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  
                  // Check if this specific item is a duplicate
                  const isDuplicate = transactions?.some(t => 
                    (res.transactionId && t.note?.includes(res.transactionId)) ||
                    (t.amount === (res.amount || 0) && 
                     t.note?.toLowerCase().trim() === (res.note || "").toLowerCase().trim() && 
                     t.date === (res.date || new Date().toISOString().split('T')[0]))
                  );
                  
                  return (
                    <tr key={idx} className={`group transition-colors ${isDuplicate ? 'bg-orange-500/5' : 'hover:bg-accent/5'}`}>
                      <td className="py-3 pr-4 align-top">
                        <div className="text-sm font-medium whitespace-nowrap">{formattedDate}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{res.time || "--:--"}</div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-2">{res.note}</div>
                          <div className="flex items-center gap-2">
                            <div className={`text-[10px] font-bold uppercase tracking-tighter ${res.type === 'income' ? 'text-income' : 'text-expense'}`}>
                              {res.type}
                            </div>
                            {res.source && (
                              <span className="text-[9px] bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10 font-medium">
                                {res.source}
                              </span>
                            )}
                            {isDuplicate && (
                              <span className="text-[9px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded font-bold border border-orange-500/20 animate-pulse">
                                ⚠️ ALREADY IN HISTORY
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 align-top text-right font-mono font-bold text-sm ${res.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {res.type === 'income' ? '+' : '-'}₹{res.amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3">
            {scannedResults.some(res => transactions?.some(t => 
              (res.transactionId && t.note?.includes(res.transactionId)) ||
              (t.amount === (res.amount || 0) && t.note === res.note && t.date === res.date)
            )) && (
              <p className="text-[10px] text-orange-600 font-medium text-center bg-orange-50 p-2 rounded-lg border border-orange-100">
                Some transactions above are already in your database and will be skipped.
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleBulkAdd} className="flex-1 gradient-primary text-primary-foreground h-12 shadow-glow">
                Add New Transactions
              </Button>
              <Button variant="outline" onClick={() => setScannedResults([])} className="h-12 px-6">
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {debugText && (
        <div className="p-3 bg-muted rounded-xl text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto border">
          <p className="font-bold mb-1 uppercase tracking-widest text-[8px]">Scanner Intelligence Output:</p>
          {debugText}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-soft">
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">{editId ? "Edit transaction" : "Add transaction"}</h1>
        <p className="text-muted-foreground text-sm mb-6">{editId ? "Update the details below." : "Record a new income or expense."}</p>
        <TransactionForm
          key={scannedResults.length === 1 ? Date.now() : "initial"} 
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
