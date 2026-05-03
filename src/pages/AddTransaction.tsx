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
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const data = await scanReceipt(file);
      setScannedData(data);
      toast.success("Receipt scanned successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to scan receipt. Please try manual entry.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
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
            <h2 className="font-semibold text-sm">AI Receipt Scanner</h2>
            <p className="text-xs text-muted-foreground">Upload a photo to auto-fill details</p>
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

      <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-soft">
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">{editId ? "Edit transaction" : "Add transaction"}</h1>
        <p className="text-muted-foreground text-sm mb-6">{editId ? "Update the details below." : "Record a new income or expense."}</p>
        <TransactionForm
          key={scannedData ? Date.now() : "initial"} // Ensure fresh form on every scan
          initial={initial}
          scannedData={scannedData}
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
