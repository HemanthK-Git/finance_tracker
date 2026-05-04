import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactions, useUpsertTransaction } from "@/hooks/useTransactions";
import { ArrowLeft, Scan, Loader2, FileImage, FileSpreadsheet, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanReceipt, parseMultipleTransactions, formatDate, type ScannedData } from "@/lib/ocr";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react";

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
          (res.transactionId && t.note?.includes(res.transactionId) && t.type === res.type && (t.time === res.time || !t.time)) ||
          (t.amount === (res.amount || 0) && 
           t.type === res.type &&
           t.time === res.time &&
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

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error("The Excel sheet seems to be empty.");
          return;
        }

        const results: ScannedData[] = data.map((row: any) => {
          // Intelligent column mapping
          const findVal = (keys: string[]) => {
            const key = Object.keys(row).find(k => keys.some(s => k.toLowerCase().includes(s)));
            return key ? row[key] : null;
          };

          const amount = Math.abs(parseFloat(String(findVal(['amount', 'value', 'total', 'debit', 'credit', 'inr']) || 0).replace(/[^\d.-]/g, '')));
          const note = String(findVal(['person', 'particulars', 'description', 'details', 'note', 'payee', 'merchant', 'sent', 'received']) || "Excel Transaction").trim();
          const dateRaw = String(findVal(['date', 'time', 'day', 'year']) || "");
          const ref = String(findVal(['transaction id', 'ref', 'utr', 'id']) || "");
          
          // Use our robust date/time parsers
          const date = formatDate(dateRaw);
          
          // Determine type: Explicitly check for Debit/Credit column
          let type: "income" | "expense" = "expense";
          const typeVal = String(findVal(['type', 'direction', 'dr/cr', 'debit/credit']) || "").toLowerCase();
          const noteLow = note.toLowerCase();
          
          if (typeVal.includes('credit') || typeVal.includes('cr') || typeVal.includes('in') || noteLow.includes('received') || noteLow.includes('credited')) {
            type = "income";
          } else if (typeVal.includes('debit') || typeVal.includes('dr') || typeVal.includes('out')) {
            type = "expense";
          }

          return {
            amount,
            type,
            note,
            date,
            time: dateRaw.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i)?.[0] || "--:--",
            transactionId: ref.trim(),
            source: file.name.substring(0, 15)
          };
        });

        setScannedResults(results);
        toast.success(`Loaded ${results.length} rows from Excel!`);
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      toast.error("Failed to read Excel file.");
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
      {!editId && (
        <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-elegant border-dashed relative group hover:bg-accent/5 transition-colors overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Excel / CSV Document</h3>
                <p className="text-[10px] text-muted-foreground">Upload your bank statement (.xlsx, .csv)</p>
              </div>
            </div>
            <div className="bg-green-500/5 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full">
              Bulk Import Ready
            </div>
          </div>
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleExcelUpload} 
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      )}

      {!editId && (
        <div className="rounded-2xl border bg-card p-6 shadow-elegant space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <ClipboardPaste className="h-4 w-4" />
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
                  
                  // Check if this specific item is a duplicate (Match ID + Type + Time)
                  const isDuplicate = transactions?.some(t => 
                    (res.transactionId && t.note?.includes(res.transactionId) && t.type === res.type && (t.time === res.time || !t.time)) ||
                    (t.amount === (res.amount || 0) && 
                     t.type === res.type &&
                     t.time === res.time &&
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
                            {res.transactionId && (
                              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                                ID: {res.transactionId}
                              </span>
                            )}
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
