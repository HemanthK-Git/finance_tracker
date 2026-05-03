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
  
  // Split into blocks based on common separator patterns in statements
  const blocks = text.split(/\n\s*\n|(?=Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    let dateStr = "";
    let note = "";
    let amount = 0;
    let type: "income" | "expense" = "expense";

    for (const line of lines) {
      // 1. Find Date (e.g. Apr 08, 2026)
      const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i);
      if (dateMatch) dateStr = dateMatch[0];

      // 2. Find Amount (e.g. INR 20.00 or INR 15)
      const amountMatch = line.match(/(?:INR|₹|Rs|USD|\$)\s*([\d,]+\.?\d{0,2})/i);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      }

      // 3. Detect Type (Debit/Credit keywords)
      if (line.toLowerCase().includes("debit")) type = "expense";
      if (line.toLowerCase().includes("credit") || line.toLowerCase().includes("received")) type = "income";

      // 4. Detect Note/Merchant
      if (line.match(/^(Paid to|Received from)/i)) {
        note = line.replace(/^(Paid to|Received from)\s+/i, '').trim();
      } else if (line.match(/^[A-Z\s]{4,30}$/) && !note && !line.match(/Debit|Credit|INR|Transaction/i)) {
        // Backup: lines with all caps are often merchant names
        note = line.trim();
      }
    }

    if (amount > 0 && note && note.length > 2) {
      // Standardize date
      let finalDate = new Date().toISOString().split('T')[0];
      if (dateStr) {
        try {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            finalDate = parsedDate.toISOString().split('T')[0];
          }
        } catch (e) {}
      }

      transactions.push({
        type,
        amount,
        note: note.split("Transaction ID")[0].trim(), // Clean up trailing IDs
        category: detectCategory(note),
        date: finalDate
      });
    }
  }

  // Backup: If blocks didn't find anything, try the old line-by-line regex
  if (transactions.length === 0) {
    const linePattern = /(.*?)(?:₹|rs|inr|usd|\$|\s)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})(?!\d)/gi;
    for (const line of text.split('\n')) {
      const match = linePattern.exec(line);
      if (match) {
        let n = match[1].trim();
        let a = parseFloat(match[2].replace(/,/g, ''));
        if (a > 0 && n.length > 2) {
          const ignore = ["ago", "yesterday", "may", "june", "july", "2026", "2025", "2024", "sent from", "paid to", "utr", "id :"];
          if (ignore.some(k => n.toLowerCase().includes(k))) continue;
          transactions.push({
            type: detectType(n),
            amount: a,
            note: n.replace(/^(Paid to|Received from)\s+/i, '').trim(),
            category: detectCategory(n),
            date: new Date().toISOString().split('T')[0]
          });
        }
      }
      linePattern.lastIndex = 0;
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
