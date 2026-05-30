import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function roleLabel(role?: string) {
  if (role === "loan_department") return "Loan Department";
  if (role === "admin") return "Admin";
  return "Merchant";
}

export function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 55) return "text-primary";
  return "text-amber-600";
}
