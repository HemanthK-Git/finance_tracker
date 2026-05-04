import { createWorker } from 'tesseract.js';

export type ScannedData = {
  type: "income" | "expense";
  amount?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm format
  category?: string;
  note?: string;
};

export async function scanReceipt(file: File): Promise<ScannedData[]> {
  const processedImage = await preprocessImage(file);
  const worker = await createWorker('eng');
  
  // Improve Tesseract accuracy for financial documents
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:₹-() ',
  });

  const { data: { text } } = await worker.recognize(processedImage);
  await worker.terminate();

  console.log("Cleaned Scanned Text:", text);
  return parseMultipleTransactions(text);
}

/**
 * Preprocesses image to increase contrast and sharpness for better OCR
 */
async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Scale up slightly for better small text recognition
        canvas.width = img.width * 1.5;
        canvas.height = img.height * 1.5;
        
        ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/png', 1.0));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function parseMultipleTransactions(text: string): ScannedData[] {
  if (!text) return [];

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results: ScannedData[] = [];
  
  // 1. Identify all "Amount" candidates as anchors
  const amountAnchors: { val: number; lineIdx: number; raw: string }[] = [];
  const amtRegex = /(?:INR|₹|Rs|inr|rs)\s*[:\-\s]*\s*([\d,]+\.?\d{0,2})/gi;

  lines.forEach((line, idx) => {
    let match;
    while ((match = amtRegex.exec(line)) !== null) {
      let valStr = match[1];
      // Smart Decimal Fix: "20,00" -> "20.00"
      if (valStr.includes(',') && valStr.split(',')[1].length === 2 && !valStr.includes('.')) {
        valStr = valStr.replace(',', '.');
      } else {
        valStr = valStr.replace(/,/g, '');
      }
      const val = parseFloat(valStr);
      if (val > 0 && val < 1000000) {
        amountAnchors.push({ val, lineIdx: idx, raw: line });
      }
    }
  });

  // 2. For each amount, find nearest Date, Time, and Note
  amountAnchors.forEach((anchor) => {
    const date = findNearby(lines, anchor.lineIdx, /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+(?:20\d{2})?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/i);
    const time = findNearby(lines, anchor.lineIdx, /\d{1,2}:\d{2}\s*(?:AM|PM)?/i);
    const note = findNearbyNote(lines, anchor.lineIdx);
    
    // Determine type (Income if "received", "credited", "from")
    const context = (lines[anchor.lineIdx] + " " + (lines[anchor.lineIdx-1] || "")).toLowerCase();
    const type = (context.includes("received") || context.includes("credit") || context.includes("from")) ? "income" : "expense";

    results.push({
      type,
      amount: anchor.val,
      date: formatDate(date),
      time: formatTime(time),
      note: cleanNote(note),
      category: type === "income" ? "Income" : detectCategory(note)
    });
  });

  // Deduplicate: If same amount/note/date found twice (OCR noise)
  return results.filter((v, i, a) => 
    a.findIndex(t => t.amount === v.amount && t.note === v.note && t.date === v.date) === i
  );
}

function findNearby(lines: string[], startIdx: number, regex: RegExp): string {
  // Search up to 4 lines above and 1 line below the amount
  for (let offset of [0, -1, -2, -3, -4, 1]) {
    const idx = startIdx + offset;
    if (idx >= 0 && idx < lines.length) {
      const match = lines[idx].match(regex);
      if (match) return match[0];
    }
  }
  return "";
}

function findNearbyNote(lines: string[], startIdx: number): string {
  // Usually the merchant/person is 1-2 lines above the amount or on the same line
  for (let offset of [-1, -2, 0, -3, -4]) {
    const idx = startIdx + offset;
    if (idx >= 0 && idx < lines.length) {
      const line = lines[idx];
      // Skip lines that are just dates, times, or IDs
      if (line.match(/\d{1,2}:\d{2}/) || line.match(/Transaction|ID|UTR|Ref|INR|₹|Rs/i) || line.match(/^\d+$/)) continue;
      
      const clean = line.replace(/(?:Paid|Received|Sent|Transfer|to|from)\s+/gi, '').trim();
      if (clean.length > 2) return clean;
    }
  }
  return "Transaction";
}

function formatDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(raw.replace(/st|nd|rd|th/i, ''));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch(e) {}
  return new Date().toISOString().split('T')[0];
}

function formatTime(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "";
  let [_, hours, mins, ampm] = match;
  let h = parseInt(hours);
  if (ampm?.toUpperCase() === "PM" && h < 12) h += 12;
  if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${mins}`;
}

function cleanNote(note: string): string {
  return note
    .replace(/[)("“'‘*]/g, '')
    .replace(/\b(Transaction|ID|UTR|No|Ref|Debited|Credited|Success|Debit|Credit)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || "Transaction";
}

function detectCategory(text: string): string {
  const categories = {
    Food: ["restaurant", "hotel", "cafe", "food", "burger", "pizza", "coffee", "lunch", "dinner", "grocery", "mart", "swiggy", "zomato", "vending"],
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

export let lastScannedText = "";
export async function getScannedText(file: File) {
  const processedImage = await preprocessImage(file);
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(processedImage);
  await worker.terminate();
  lastScannedText = text;
  return text;
}
