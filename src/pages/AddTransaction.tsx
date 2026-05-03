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

  const removeScannedItem = (index: number) => {
    setScannedResults(prev => prev.filter((_, i) => i !== index));
  };

  const updateScannedItem = (index: number, updates: Partial<ScannedData>) => {
    setScannedResults(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
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
            <p className="text-xs text-muted-foreground">Upload a PhonePe history image to add all at once</p>
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
        <div className="rounded-2xl border bg-card/60 backdrop-blur-xl p-6 shadow-elegant animate-in zoom-in-95 duration-500 border-white/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 gradient-primary opacity-50" />
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Scan className="h-5 w-5 text-primary" /> Review {scannedResults.length} Items
            </h2>
            <Button variant="outline" size="sm" onClick={() => setScannedResults([])} className="h-8 text-xs">
              Clear All
            </Button>
          </div>

          <div className="space-y-3 mb-6">
            {scannedResults.map((res, idx) => (
              <div 
                key={idx} 
                className="group p-3 rounded-xl border bg-background/50 hover:bg-background/80 transition-smooth flex flex-col gap-2 animate-in slide-in-from-right-4 duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text"
                      value={res.note}
                      onChange={(e) => updateScannedItem(idx, { note: e.target.value })}
                      className="bg-transparent border-none p-0 font-medium text-sm w-full focus:ring-0 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                        {res.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground italic">
                        {res.date}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => updateScannedItem(idx, { type: res.type === 'income' ? 'expense' : 'income' })}
                        className={`text-xs font-bold px-2 py-1 rounded-md transition-colors ${
                          res.type === 'income' 
                            ? 'bg-income/10 text-income' 
                            : 'bg-expense/10 text-expense'
                        }`}
                      >
                        {res.type === 'income' ? '+' : '-'}₹
                      </button>
                      <input 
                        type="number"
                        value={res.amount}
                        onChange={(e) => updateScannedItem(idx, { amount: parseFloat(e.target.value) || 0 })}
                        className={`bg-transparent border-none p-0 font-mono font-bold text-base w-16 text-right focus:ring-0 focus:outline-none ${
                          res.type === 'income' ? 'text-income' : 'text-expense'
                        }`}
                      />
                    </div>
                    <button 
                      onClick={() => removeScannedItem(idx)}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    >
                      <Loader2 className="h-3 w-3 rotate-45" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center px-4 py-3 bg-muted/30 rounded-xl mb-6 border border-white/10">
            <div className="text-xs text-muted-foreground">
              Total: <span className="text-foreground font-bold">{scannedResults.length} items</span>
            </div>
            <div className="flex gap-4 text-sm font-bold">
              <span className="text-income">
                +₹{scannedResults.filter(r => r.type === 'income').reduce((acc, curr) => acc + (curr.amount || 0), 0)}
              </span>
              <span className="text-expense">
                -₹{scannedResults.filter(r => r.type === 'expense').reduce((acc, curr) => acc + (curr.amount || 0), 0)}
              </span>
            </div>
          </div>

          <Button 
            onClick={handleBulkAdd} 
            className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-bold text-lg shadow-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Add All Transactions
          </Button>
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
