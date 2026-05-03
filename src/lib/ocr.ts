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
  const lines = text.split('\n');
  const transactions: ScannedData[] = [];
  
  // Look for lines that have a price-like number at the end
  // Patterns like: "NAME ... ₹20" or "NAME ... 20.00"
  // We look for name strings followed by a currency symbol OR just a space then a number
  const linePattern = /(.*?)(?:₹|rs|inr|usd|\$|\s)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})(?!\d)/gi;
  
  for (const line of lines) {
    const match = linePattern.exec(line);
    if (match) {
      let note = match[1].trim();
      let amountStr = match[2].replace(/,/g, '');
      
      // Fix common OCR error: '₹' read as '3', '2', 'z', or 's' right before the number
      // If the note ends with a single digit/letter and then the amount starts, 
      // it might be a misread symbol.
      if (note.match(/[zZsS23]$/)) {
        note = note.slice(0, -1).trim();
      }

      const amount = parseFloat(amountStr);
      
      // Fix cases where ₹ was read as 3 or 2 and joined to the number (e.g. 36.99 -> 6.99)
      let finalAmount = amount;
      if (amountStr.length >= 4 && (amountStr.startsWith('3') || amountStr.startsWith('2'))) {
        // If it's something like 36.99 and we suspect 3 is the symbol
        // We only do this if it helps match a more 'realistic' small payment
        if (amount > 30 && amount < 40 && amountStr.includes('.')) {
          finalAmount = parseFloat(amountStr.slice(1));
        }
      }

      if (!isNaN(finalAmount) && finalAmount > 0 && note.length > 2) {
        const rawNote = note;
        // Clean up noise from the start of the note (like "2" from "22 hours ago")
        note = note.replace(/^\d+\s+/, '').replace(/^Paid to\s+/i, '').replace(/^Received from\s+/i, '');

        // Ignore noise keywords
        const ignore = ["ago", "yesterday", "may", "june", "july", "2026", "2025", "2024", "sent from", "paid to"];
        if (ignore.some(k => note.toLowerCase().includes(k))) continue;

        transactions.push({
          type: detectType(rawNote),
          amount: finalAmount,
          note: note || "Scanned Transaction",
          category: detectCategory(note),
          date: new Date().toISOString().split('T')[0] // Default to today for history lists
        });
      }
    }
    linePattern.lastIndex = 0; // Reset for next line
  }

  // Fallback: If no lines matched, try the old single-receipt logic
  if (transactions.length === 0) {
    const data = parseReceiptText(text);
    if (data.amount) transactions.push(data);
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
