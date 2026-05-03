import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactions, useUpsertTransaction } from "@/hooks/useTransactions";
import { ArrowLeft, Scan, Loader2, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanReceipt, type ScannedData } from "@/lib/ocr";
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

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setDebugText("Scanning list...");
    try {
      const results = await scanReceipt(file);
      setScannedResults(results);
      
      if (results.length > 1) {
        toast.success(`Found ${results.length} transactions!`);
      } else if (results.length === 1) {
        toast.success("Found 1 transaction.");
      } else {
        toast.info("Could not find any clear transactions.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to scan.");
    } finally {
      setScanning(false);
    }
  };

  const { data: transactions = [] } = useTransactions();

  const handleBulkAdd = async () => {
    setScanning(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      for (const res of scannedResults) {
        // Check for duplicates (same amount, note, and date)
        const isDuplicate = transactions?.some(t => 
          t.amount === (res.amount || 0) && 
          t.note?.toLowerCase().trim() === (res.note || "").toLowerCase().trim() && 
          t.date === (res.date || new Date().toISOString().split('T')[0])
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
            note: res.note || "Bulk Scanned",
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
        <div className="rounded-2xl border bg-accent/30 p-5 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden group hover:bg-accent/40 transition-smooth border-dashed border-accent">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Scan className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="font-semibold text-sm">Bulk AI Scanner</h2>
            <p className="text-xs text-muted-foreground">Upload a history list to add everything at once</p>
          </div>
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            onChange={handleScan} 
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={scanning}
          />
        </div>
      )}

      {scannedResults.length > 1 && (
        <div className="rounded-2xl border bg-card p-5 shadow-elegant animate-in slide-in-from-top-4 duration-500">
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Scan className="h-5 w-5 text-primary" /> Review {scannedResults.length} Transactions
          </h2>
          <ul className="divide-y mb-6">
            {scannedResults.map((res, idx) => (
              <li key={idx} className="py-3 flex justify-between items-center text-sm">
                <span className="font-medium truncate max-w-[180px]">{res.note}</span>
                <span className={`font-mono font-bold ${res.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {res.type === 'income' ? '+' : '-'}₹{res.amount}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button onClick={handleBulkAdd} className="flex-1 gradient-primary text-primary-foreground h-12 shadow-glow">
              Add All {scannedResults.length} Transactions
            </Button>
            <Button variant="outline" onClick={() => setScannedResults([])} className="h-12 px-6">
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
