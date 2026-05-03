import { createWorker } from 'tesseract.js';

export type ScannedData = {
  type: "income" | "expense";
  amount?: number;
  date?: string;
  category?: string;
  note?: string;
};

export async function scanReceipt(file: File): Promise<ScannedData[]> {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();

  console.log("Scanned Text:", text);

  return parseMultipleTransactions(text);
}

function parseMultipleTransactions(text: string): ScannedData[] {
  const transactions: ScannedData[] = [];
  if (!text) return [];

  // Remove lines that are ONLY bank metadata, but keep lines with amounts
  const lines = text.split('\n').filter(l => {
    const trimmed = l.trim();
    if (trimmed.match(/(?:INR|₹|Rs)\s*[\d,]+\.\d{2}/i)) return true; // Keep amounts
    return !trimmed.match(/UTR No|Debited from|Credited to|Page \d+|Debited \d+/i);
  });

  // Rejoin and split by Date markers
  const cleanText = lines.join('\n');
  const blocks = cleanText.split(/(?=Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  
  for (const block of blocks) {
    const blockLines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (blockLines.length === 0) continue;

    let dateStr = "";
    let note = "";
    let amount = 0;
    let type: "income" | "expense" = "expense";

    // First pass: find basic info
    for (const line of blockLines) {
      // Date detection
      const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+202\d/i);
      if (dateMatch) dateStr = dateMatch[0];

      // Amount detection (Strict decimal)
      const amountMatch = line.match(/(?:INR|₹|Rs)\s*([\d,]+\.\d{2})/i);
      if (amountMatch) {
        const val = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (val !== 2024 && val !== 2025 && val !== 2026) amount = val;
      }

      // Type detection
      if (line.toLowerCase().includes("debit")) type = "expense";
      if (line.toLowerCase().includes("credit") || line.toLowerCase().includes("received")) type = "income";
    }

    // Second pass: find Note/Merchant
    for (const line of blockLines) {
      const noteMatch = line.match(/(?:Paid to|Received from|Sent to|Credit from|From)\s+(.*?)(?=Debit|Credit|INR|Transaction|10:|0\d:|1\d:|$)/i);
      if (noteMatch) {
        note = noteMatch[1].trim();
        if (line.toLowerCase().includes("received") || line.toLowerCase().includes("from")) type = "income";
        break;
      }
    }

    // Fallback for note if still empty
    if (!note && blockLines.length > 1) {
      note = blockLines.find(l => l.length > 5 && !l.match(/202\d|INR|₹|Rs/i)) || blockLines[0];
    }

    if (amount > 0 && note && note.length > 1 && !note.match(/Amount|Type|Details/i)) {
      let finalDate = new Date().toISOString().split('T')[0];
      if (dateStr) {
        try {
          const d = new Date(dateStr.replace(',', ''));
          if (!isNaN(d.getTime())) finalDate = d.toISOString().split('T')[0];
        } catch (e) {}
      }

      transactions.push({
        type,
        amount,
        note: note.split("Transaction")[0].trim().replace(/\*+/g, '').trim(),
        category: type === "income" ? "Income" : detectCategory(note),
        date: finalDate
      });
    }
  }

  // Final Safety Check: If no blocks worked, try line-by-line fallback
  if (transactions.length === 0) {
    for (const line of text.split('\n')) {
      const amtMatch = line.match(/(?:INR|₹|Rs)\s*([\d,]+\.\d{2})/i);
      if (amtMatch) {
        const val = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (val > 0 && val !== 2026) {
          const isInc = line.toLowerCase().includes("received") || line.toLowerCase().includes("credit");
          transactions.push({
            type: isInc ? "income" : "expense",
            amount: val,
            note: isInc ? "Income Received" : "Expense",
            category: isInc ? "Income" : "Other",
            date: new Date().toISOString().split('T')[0]
          });
        }
      }
    }
  }

  return transactions;
}

function detectType(text: string): "income" | "expense" {
  const incomeKeywords = ["received", "earned", "salary", "credit", "refund", "inward", "from"];
  const lower = text.toLowerCase();
  if (incomeKeywords.some(k => lower.includes(k))) return "income";
  return "expense";
}

function detectCategory(text: string): string {
  const categories = {
    Food: ["restaurant", "hotel", "cafe", "food", "burger", "pizza", "coffee", "lunch", "dinner", "grocery", "mart", "swiggy", "zomato"],
    Rent: ["rent", "lease", "apartment"],
    Travel: ["uber", "ola", "petrol", "fuel", "gas", "taxi", "train", "flight", "indigo", "air", "irctc"],
    Healthcare: ["pharmacy", "medical", "hospital", "doctor", "clinic", "medplus", "apollo"],
    Entertainment: ["movie", "cinema", "theatre", "netflix", "spotify", "game", "bookmyshow"],
    Utilities: ["electricity", "water", "bill", "recharge", "mobile", "internet", "jio", "airtel", "vi", "bsnl"],
  };

  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return "Other";
}

function parseReceiptText(text: string): ScannedData {
  const data: ScannedData = {};
  const amountRegex = /(?:total|amount|net|payable|sum|₹|rs|inr)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})/gi;
  const match = amountRegex.exec(text);
  if (match) {
    data.amount = parseFloat(match[1].replace(/,/g, ''));
  }
  
  // Final check: if no amount found, try to find any number with a decimal
  if (!data.amount) {
    const decimalMatch = text.match(/(\d+[\.,]\d{2})/);
    if (decimalMatch) {
      data.amount = parseFloat(decimalMatch[1].replace(',', '.'));
    }
  }

  return data;
}

// Export the raw text for debugging
export let lastScannedText = "";
export async function getScannedText(file: File) {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  lastScannedText = text;
  return text;
}
