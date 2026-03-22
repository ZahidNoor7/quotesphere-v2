import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "PKR",
  locale = "en-PK"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, fmt = "dd MMM yyyy"): string {
  const d = new Date(date);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = d.getDate().toString().padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatShortDate(date: Date | string): string {
  const d = new Date(date);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function getDaysOverdue(dueDate: Date | string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

export function generateColor(str: string): string {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function serializeDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}
