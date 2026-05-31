import { createWorker } from 'tesseract.js';

export type ScannedData = {
  type: "income" | "expense";
  amount?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm format
  category?: string;
  note?: string;
  transactionId?: string;
  source?: string;
};

export async function scanReceipt(file: File): Promise<ScannedData[]> {
  const processedImage = await preprocessImage(file);
  const worker = await createWorker('eng');
  
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
        
        // Scale up significantly for better small text (dots/decimals)
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        
        ctx.filter = 'grayscale(100%) contrast(200%) brightness(100%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/png', 1.0));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function parseMultipleTransactions(text: string): ScannedData[] {
  if (!text) return [];

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const results: ScannedData[] = [];
  
  // 1. Identify all "Amount" candidates as anchors
  const amountAnchors: { val: number; lineIdx: number; raw: string }[] = [];
  // Regex updated to allow spaces around decimals (Tesseract often adds them)
  const amtRegex = /(?:INR|₹|Rs|inr|rs|1NR|1nr)\s*[:\-\s]*\s*([\d,]+\s*[\.\,]\s*\d{2}|[\d,]+\s*[\.\,]\s*\d{1}|[\d,]+)/gi;

  lines.forEach((line, idx) => {
    let match;
    while ((match = amtRegex.exec(line)) !== null) {
      let valStr = match[1].replace(/\s+/g, '').replace(',', '.');
      
      // Smart Decimal Fix: If we see 2000 but it's PhonePe format, it's often 20.00
      // However, we only fix it if there's a dot/comma that was read as a space
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
    const transactionId = findNearby(lines, anchor.lineIdx, /(?:Transaction ID|ID)\s*[:\-]\s*([A-Z0-9]{15,})/i);
    
    // Determine type (Income vs Expense) - Narrow context for precision
    const currentLine = lines[anchor.lineIdx].toLowerCase();
    const prevLine = (lines[anchor.lineIdx-1] || "").toLowerCase();
    const prevLine2 = (lines[anchor.lineIdx-2] || "").toLowerCase();
    const context = `${prevLine2} ${prevLine} ${currentLine}`;
    
    let type: "income" | "expense" = "expense";
    if (context.includes("received") || context.includes("credit") || context.includes("credited to")) {
      type = "income";
    } else if (context.includes("paid") || context.includes("debit") || context.includes("debited from")) {
      type = "expense";
    }

    results.push({
      type,
      amount: anchor.val,
      date: formatDate(date),
      time: formatTime(time),
      note: cleanNote(note),
      transactionId: transactionId.replace(/(?:Transaction ID|ID)\s*[:\-]\s*/i, '').trim(),
      category: type === "income" ? "Income" : detectCategory(note),
      source: detectSource(text)
    });
  });

  return results;
}

function findNearby(lines: string[], startIdx: number, regex: RegExp): string {
  // Search up to 12 lines above and 2 lines below (Statements have long gaps)
  for (let offset of [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, 1, 2]) {
    const idx = startIdx + offset;
    if (idx >= 0 && idx < lines.length) {
      const match = lines[idx].match(regex);
      if (match) return match[0];
    }
  }
  return "";
}

function findNearbyNote(lines: string[], startIdx: number): string {
  const merchantKeywords = /(?:Paid to|Received from|Sent to|Transfer to|Credit from)\s+/i;
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+(?:20\d{2})?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/i;

  // Pass 1: Look for explicit Merchant keywords (High Priority)
  for (let offset of [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, 0]) {
    const idx = startIdx + offset;
    if (idx >= 0 && idx < lines.length) {
      const line = lines[idx];
      const match = line.match(merchantKeywords);
      if (match) {
        // CRITICAL FIX: If the line is "Date Time Paid to Merchant", 
        // we must discard everything BEFORE "Paid to".
        const parts = line.split(match[0]);
        const potentialNote = parts.length > 1 ? parts[1] : parts[0];
        return cleanNote(potentialNote);
      }
    }
  }

  // Pass 2: Fallback to any text that isn't noise
  for (let offset of [-1, -2, -3, -4, -5, -6, 0]) {
    const idx = startIdx + offset;
    if (idx >= 0 && idx < lines.length) {
      const line = lines[idx];
      const clean = line.replace(/(?:Paid|Received|Sent|Transfer|to|from)\s+/gi, '').trim();
      const blacklist = /Transaction|ID|UTR|Ref|INR|₹|Rs|Debited|Credited|Account|XX\d+|\d{4}/i;
      if (clean.length > 2 && !clean.match(blacklist) && !['Debit', 'Credit', 'Debt', 'Success'].includes(clean)) {
        return cleanNote(clean);
      }
    }
  }
  return "Transaction";
}

function detectSource(text: string): string {
  const low = text.toLowerCase();
  if (low.includes('phonepe')) return 'PhonePe';
  if (low.includes('google pay') || low.includes('gpay')) return 'GPay';
  if (low.includes('paytm')) return 'Paytm';
  if (low.includes('sbi') || low.includes('state bank')) return 'SBI';
  if (low.includes('hdfc')) return 'HDFC';
  if (low.includes('icici')) return 'ICICI';
  if (low.includes('axis')) return 'Axis';
  return 'Bank Statement';
}

export function formatDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  
  // Clean raw text
  const clean = raw.replace(/st|nd|rd|th/gi, '').replace(/[|,]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Try to match "Apr 04 2026" or "04 Apr 2026" or "04-04-2026"
  const monthMap: { [key: string]: string } = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const monthRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  const monthMatch = clean.match(monthRegex);
  const numbers = clean.match(/\d+/g) || [];
  
  if (monthMatch && numbers.length >= 2) {
    const m = monthMap[monthMatch[0].toLowerCase().substring(0, 3)];
    // Usually format is "Day Month Year" or "Month Day Year"
    // Year is usually 4 digits, or the last number in the sequence
    let y = numbers.find(n => n.length === 4) || numbers[numbers.length - 1];
    let d = numbers.find(n => n !== y) || numbers[0];

    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  // Fallback to standard parser if regex fails
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch(e) {}
  
  return new Date().toISOString().split('T')[0];
}

function formatTime(raw: string): string {
  if (!raw) return "";
  // Handle cases where AM/PM might be misread or spaces added
  const cleanRaw = raw.replace(/es on N/gi, 'AM').replace(/\s+/g, ' '); 
  const match = cleanRaw.match(/(\d{1,2})\s*[:\.\s]\s*(\d{2})\s*(AM|PM|am|pm)?/i);
  if (!match) return "";
  let [_, hours, mins, ampm] = match;
  let h = parseInt(hours);
  if (ampm?.toUpperCase() === "PM" && h < 12) h += 12;
  if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${mins}`;
}

function cleanNote(note: string): string {
  if (!note) return "Transaction";
  return note
    .replace(/[)("“'‘*]/g, '')
    // Aggressive Amount/Currency Stripping
    .replace(/(?:INR|₹|Rs|inr|rs|rs\.)\s*[:\-\s]*\s*[\d,]+\s*[\.\,]\s*\d{0,2}/gi, '')
    .replace(/(?:INR|₹|Rs|inr|rs|rs\.)\s*[:\-\s]*\s*[\d,]+/gi, '')
    .replace(/\b(Transaction|ID|UTR|No|Ref|Debited|Credited|Success|Debit|Credit|Debt|from|to|Paid|Received|Sent|Transfer|LL|II|ll)\b/gi, '')
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
    Shopping: ["amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "shopping", "mall", "store"],
    Utilities: ["electricity", "water", "bill", "recharge", "mobile", "internet", "jio", "airtel", "vi", "bsnl"],
    Savings: ["investment", "mutual fund", "sip", "stocks", "zerodha", "upstox", "groww", "deposit"],
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
