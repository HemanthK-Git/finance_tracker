import { createWorker } from 'tesseract.js';

export type ScannedData = {
  amount?: number;
  date?: string;
  category?: string;
};

export async function scanReceipt(file: File): Promise<ScannedData> {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();

  console.log("Scanned Text:", text);

  return parseReceiptText(text);
}

function parseReceiptText(text: string): ScannedData {
  const data: ScannedData = {};

  // Regex to find amounts (Total, Grand Total, etc.)
  // Looks for numbers after keywords like Total, Amount, Payable
  const amountRegex = /(?:total|amount|net|payable|sum|₹|\$)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})/gi;
  let match;
  let maxAmount = 0;

  while ((match = amountRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val) && val > maxAmount) {
      maxAmount = val;
    }
  }
  
  if (maxAmount > 0) {
    data.amount = maxAmount;
  }

  // Regex to find dates (YYYY-MM-DD, DD/MM/YYYY, etc.)
  const dateRegex = /(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{2,4})|(\d{4})[\/\-\. ](\d{1,2})[\/\-\. ](\d{1,2})/g;
  const dateMatch = dateRegex.exec(text);
  if (dateMatch) {
    // Basic attempt to format it as YYYY-MM-DD
    // For simplicity, we just use the current date if parsing is too complex, 
    // but here we try a basic one
    try {
      const d = new Date(dateMatch[0]);
      if (!isNaN(d.getTime())) {
        data.date = d.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn("Date parsing failed", e);
    }
  }

  // Simple keyword based category detection
  const categories = {
    Food: ["restaurant", "hotel", "cafe", "food", "burger", "pizza", "coffee", "lunch", "dinner", "grocery", "mart"],
    Rent: ["rent", "lease", "apartment"],
    Travel: ["uber", "ola", "petrol", "fuel", "gas", "taxi", "train", "flight", "indigo", "air"],
    Healthcare: ["pharmacy", "medical", "hospital", "doctor", "clinic"],
    Entertainment: ["movie", "cinema", "theatre", "netflix", "spotify", "game"],
    Utilities: ["electricity", "water", "bill", "recharge", "mobile", "internet", "jio", "airtel"],
  };

  const lowerText = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lowerText.includes(k))) {
      data.category = cat;
      break;
    }
  }

  return data;
}
