# Changelog

## Bug Fixes

### Duplicate Detection
- **Stale snapshot in bulk-add** — `handleBulkAdd` now tracks items added within the same batch (`addedEntries` array) so duplicates within a single Excel/CSV upload are caught, not just against existing DB
- **UI duplicate warnings** — Review table now also checks against other rows in the same upload, showing "⚠️ ALREADY IN HISTORY" badge + warning banner for in-batch duplicates

### Performance & Memory
- **useToast listener leak** — Changed `useEffect` dependency from `[state]` to `[]` to prevent listener proliferation on every toast state change
- **Date.now() as React key** — Removed from TransactionForm (was forcing full remount destroying form state); `scannedData` prop already triggers reset

### Code Quality
- **Dual toast systems** — Removed unused Radix `<Toaster />` from App.tsx, kept only Sonner
- **Array index as React key** — Changed `key={idx}` to stable composite key in scanned results table
- **Deprecated API** — Replaced `readAsBinaryString` with `readAsArrayBuffer` for Excel imports
- **Empty catch block** — Added `console.warn` logging in `formatDate` fallback instead of silently swallowing errors
- **Bulk delete aborts on first failure** — Changed to `Promise.allSettled` with failure count toast
- **Competing useEffect hooks** — Merged two `form.reset()` effects in TransactionForm into one `if/else` to prevent race conditions
- **useIsMobile initial undefined** — Changed to `useState(false)` for cleaner type
- **Unused imports** — Removed `Loader2`, `FileImage`, `scanReceipt`, `CheckSquare`, `Square`, `orderBy`, `Timestamp`

### Category Detection (detectCategory in ocr.ts)
- **Excel imports now categorize** — Added `detectCategory()` call to Excel upload path (was defaulting everything to "Other")
- **Expanded keyword coverage** — Added missing keywords for Food, Travel, Shopping, Utilities based on real PhonePe statement data
  - Food: `bakers`, `pan`, `wok`, `kitchen`, `choco`, `kirana`
  - Travel: `rapido`, `metro`, `oyo`, `road transport`, `parking`
  - Shopping: `zudio`, `ikea`, `haier`, `salon`, `traders`, `trading`
  - Utilities: `fiber`, `fibre`, `networks`, `postpaid`

## Sample Data
- Added `public/samples/april-statement.csv` (141 transactions)
- Added `public/samples/may-statement.csv` (70 transactions)
- Added `public/samples/june-statement.csv` (50 transactions)
- Format matches app's expected columns: Date, Time, Year, Person, Amount, Type, Transaction ID
