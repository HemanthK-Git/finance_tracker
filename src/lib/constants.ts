export const CATEGORIES = [
  "Food",
  "Rent",
  "Travel",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Other",
] as const;

export type Category = typeof CATEGORIES[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: "hsl(20 85% 60%)",
  Rent: "hsl(250 80% 65%)",
  Travel: "hsl(190 80% 50%)",
  Utilities: "hsl(45 90% 55%)",
  Healthcare: "hsl(340 75% 60%)",
  Entertainment: "hsl(280 75% 65%)",
  Other: "hsl(220 15% 55%)",
};

const KEY = "finance.deviceId";
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
