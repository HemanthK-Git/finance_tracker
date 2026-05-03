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

  // Extract ALL possible dates, notes, and amounts from the entire text
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+202\d/gi;
  const amountPattern = /(?:INR|₹|Rs)\s*([\d,]+\.\d{2})/gi;
  const notePattern = /(?:Paid to|Received from|Sent to|Credit from|From)\s+(.*?)(?=Debit|Credit|INR|Transaction|UTR|ID\s*:|\d{2}:\d{2}|$)/gi;

  const allDates = text.match(datePattern) || [];
  const allAmounts: number[] = [];
  let m;
  while ((m = amountPattern.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val !== 2024 && val !== 2025 && val !== 2026) allAmounts.push(val);
  }
  
  const allNotes: {text: string, type: "income" | "expense"}[] = [];
  while ((m = notePattern.exec(text)) !== null) {
    const fullLine = m[0].toLowerCase();
    const isInc = fullLine.includes("received") || fullLine.includes("credit") || fullLine.includes("from");
    allNotes.push({
      text: m[1].trim().replace(/\s+\d{1,2}:\d{2}.*$/i, '').replace(/\*+/g, '').trim(),
      type: isInc ? "income" : "expense"
    });
  }

  // ZIP LOGIC: If we have a clear set of matches, pair them up
  // We prioritize the count that is most frequent (usually names or amounts)
  const count = Math.max(allDates.length, allAmounts.length, allNotes.length);
  
  for (let i = 0; i < count; i++) {
    const amount = allAmounts[i];
    const noteObj = allNotes[i];
    const dateStr = allDates[i];

    if (amount && (noteObj || dateStr)) {
      let finalDate = new Date().toISOString().split('T')[0];
      if (dateStr) {
        try {
          const d = new Date(dateStr.replace(',', ''));
          if (!isNaN(d.getTime())) finalDate = d.toISOString().split('T')[0];
        } catch (e) {}
      }

      transactions.push({
        type: noteObj?.type || "expense",
        amount,
        note: noteObj?.text || "Transaction",
        category: noteObj?.type === "income" ? "Income" : detectCategory(noteObj?.text || ""),
        date: finalDate
      });
    }
  }

  // Fallback: If zipping failed to produce results, try the old line-by-line
  if (transactions.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
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
