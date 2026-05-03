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

  // 1. Pre-process: Clean up text and normalize
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const cleanText = lines.join(' ');

  // 2. Identify potential transaction blocks
  // PhonePe table format usually starts with a Date: "Apr 04, 2026"
  const dateRegex = /(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+202\d)/gi;
  const rawBlocks = cleanText.split(dateRegex).filter(b => b.trim().length > 20);

  for (const block of rawBlocks) {
    let type: "income" | "expense" = "expense";
    let amount = 0;
    let note = "";
    let dateStr = "";

    const dateMatch = block.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+202\d/i);
    if (dateMatch) dateStr = dateMatch[0];

    if (block.match(/Credit|Received|Refund/i)) type = "income";

    const amountMatch = block.match(/(?:INR|₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const merchantMatch = block.match(/(?:Paid to|Received from|Sent to|Credit from|Transfer to|Payment to|From)\s+(.*?)(?=Transaction|ID\s*:|UTR|Debit|Credit|INR|₹|Rs|$)/i);
    if (merchantMatch) {
      note = merchantMatch[1].trim();
    } else {
      const fallbackMatch = block.replace(dateStr, '').match(/(?:Paid to|Received from|Sent to|Credit from|Transfer to|Payment to|From)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
      if (fallbackMatch) note = fallbackMatch[1].trim();
    }

    note = note.replace(/\*+/g, '').replace(/Transaction/gi, '').trim();
    if (note.length > 40) note = note.substring(0, 40) + "...";

    if (amount > 0 && amount < 1000000) {
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
        note: note || (type === "income" ? "Received" : "Spent"),
        category: type === "income" ? "Income" : detectCategory(note),
        date: finalDate
      });
    }
  }

  // 3. Last Ditch Fallback: Line by line regex if blocks failed
  if (transactions.length === 0) {
    for (const line of lines) {
      const amtMatch = line.match(/(?:INR|₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (amtMatch) {
        const val = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (val > 0) {
          const isInc = line.toLowerCase().includes("credit") || line.toLowerCase().includes("received");
          transactions.push({
            type: isInc ? "income" : "expense",
            amount: val,
            note: isInc ? "Income" : "Expense",
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
