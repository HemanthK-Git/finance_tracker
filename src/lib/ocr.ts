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
  
  // Clean up the text: remove noisy ID lines to avoid confusion
  const cleanText = text.split('\n')
    .filter(line => !line.match(/Transaction ID|UTR No|Debited from|Credited to|Page \d+/i))
    .join('\n');

  // Split by the horizontal lines (often seen as dashes or long spaces) or by Dates
  const blocks = cleanText.split(/(?=Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    let dateStr = "";
    let note = "";
    let amount = 0;
    let type: "income" | "expense" = "expense";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. Find Date (e.g. Apr 04, 2026)
      const dateMatch = trimmed.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+202\d/i);
      if (dateMatch) {
        dateStr = dateMatch[0];
      }

      // 2. Find Amount (Ignore 2024, 2025, 2026)
      const amountMatch = trimmed.match(/(?:INR|₹|Rs)\s*([\d,]+\.\d{2})/i);
      if (amountMatch) {
        const val = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (val !== 2024 && val !== 2025 && val !== 2026) {
          amount = val;
        }
      }

      // 3. Detect Type
      if (trimmed.toLowerCase().includes("debit")) type = "expense";
      if (trimmed.toLowerCase().includes("credit") || trimmed.toLowerCase().includes("received")) type = "income";

      // 4. Detect Note (Paid to / Received from / Merchant Name)
      const noteMatch = trimmed.match(/(?:Paid to|Received from|Sent to)\s+(.*?)(?=Debit|Credit|INR|Transaction|$)/i);
      if (noteMatch) {
        note = noteMatch[1].trim();
      } else if (!note && trimmed.length > 4 && !trimmed.match(/Debit|Credit|INR|202\d|Date|Transaction/i)) {
        note = trimmed;
      }
    }

    // Special check for "Received from" if note is still empty
    if (!note && block.toLowerCase().includes("received from")) {
      const match = block.match(/Received from\s+(.*?)(?=Credit|INR|$)/i);
      if (match) note = "Received from " + match[1].trim();
    }

    if (amount > 0 && note && note.length > 2 && !note.match(/Amount|Type|Details/i)) {
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
        note: note.split("Transaction")[0].trim(),
        category: detectCategory(note),
        date: finalDate
      });
    }
  }

  // Backup simple parser if blocks failed
  if (transactions.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const amountMatch = line.match(/(?:INR|₹|Rs)\s*([\d,]+\.\d{2})/i);
      const noteMatch = line.match(/(?:Paid to|Received from)\s+(.*?)(?=Transaction|Debit|Credit|INR|$)/i);
      
      if (amountMatch && noteMatch) {
        transactions.push({
          type: line.toLowerCase().includes("received") || line.toLowerCase().includes("credit") ? "income" : "expense",
          amount: parseFloat(amountMatch[1].replace(/,/g, '')),
          note: noteMatch[1].trim(),
          category: detectCategory(noteMatch[1]),
          date: new Date().toISOString().split('T')[0]
        });
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
