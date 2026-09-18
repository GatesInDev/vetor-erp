import type { AccountType } from "@prisma/client";

export const accountCodes = {
  bank: "1.1.01",
  receivable: "1.1.02",
  issRetention: "1.1.04",
  inssRetention: "1.1.05",
  contractorPayable: "2.1.04",
  issPayable: "2.1.05",
  inssPayable: "2.1.06",
  serviceRevenue: "4.1.01",
  laborCost: "5.1.01",
} as const;

export const defaultAccounts: { code: string; name: string; type: AccountType }[] = [
  { code: "1.1.01", name: "Bank", type: "ASSET" },
  { code: "1.1.02", name: "Trade receivables", type: "ASSET" },
  { code: "1.1.03", name: "Inventory", type: "ASSET" },
  { code: "1.1.04", name: "ISS withheld receivable", type: "ASSET" },
  { code: "1.1.05", name: "INSS withheld receivable", type: "ASSET" },
  { code: "2.1.01", name: "Suppliers payable", type: "LIABILITY" },
  { code: "2.1.02", name: "DAS payable", type: "LIABILITY" },
  { code: "2.1.03", name: "Other taxes payable", type: "LIABILITY" },
  { code: "2.1.04", name: "Labor contracts payable", type: "LIABILITY" },
  { code: "2.1.05", name: "ISS withheld payable", type: "LIABILITY" },
  { code: "2.1.06", name: "INSS withheld payable", type: "LIABILITY" },
  { code: "2.2.01", name: "Loans", type: "LIABILITY" },
  { code: "3.1.01", name: "Share capital", type: "EQUITY" },
  { code: "3.2.01", name: "Retained earnings", type: "EQUITY" },
  { code: "4.1.01", name: "Service revenue", type: "REVENUE" },
  { code: "4.2.01", name: "Goods revenue", type: "REVENUE" },
  { code: "5.1.01", name: "Direct labor cost", type: "COST" },
  { code: "5.1.02", name: "Direct materials cost", type: "COST" },
  { code: "5.1.03", name: "Equipment rental cost", type: "COST" },
  { code: "6.1.01", name: "Administrative expense", type: "EXPENSE" },
];
