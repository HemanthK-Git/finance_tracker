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

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let stickyDate = new Date().toISOString().split('T')[0];
  let currentNote = "";
  let currentType: "income" | "expense" = "expense";

  for (const line of lines) {
    const lower = line.toLowerCase();

    // 1. Update Sticky Date
    const dateMatch = line.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}.*?202\d/i);
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[0].replace(',', ''));
        if (!isNaN(d.getTime())) stickyDate = d.toISOString().split('T')[0];
      } catch (e) {}
    }

    // 2. Update Type
    if (lower.includes("debit")) currentType = "expense";
    if (lower.includes("credit") || lower.includes("received")) currentType = "income";

    // 3. Update Sticky Note (Merchant Name)
    const noteMatch = line.match(/(?:Paid|Received|Sent|Credit|From)\s*(?:to|from|to)?\s*(.*?)(?=Debit|Credit|INR|Transaction|UTR|ID\s*:|\d{2}:\d{2}|$)/i);
    if (noteMatch) {
      currentNote = noteMatch[1].trim().replace(/\*+/g, '').trim();
    }

    // 4. Find Amount and COMMIT the transaction
    const amtMatch = line.match(/(?:INR|₹|Rs|inr|rs)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})/i);
    if (amtMatch) {
      const val = parseFloat(amtMatch[1].replace(/,/g, ''));
      if (val > 0 && val !== 2024 && val !== 2025 && val !== 2026) {
        // We found a price! Create a transaction with whatever info we have "stuck"
        transactions.push({
          type: lower.includes("received") || lower.includes("credit") ? "income" : currentType,
          amount: val,
          note: currentNote || "Transaction",
          category: currentType === "income" ? "Income" : detectCategory(currentNote),
          date: stickyDate
        });
        
        // Reset the note so we don't reuse it for the next price unless a new one is found
        currentNote = "";
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
