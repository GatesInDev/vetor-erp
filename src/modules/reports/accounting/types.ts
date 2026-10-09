import type { AccountType } from "@prisma/client";

export type AccountingAccount = { id: string; code: string; name: string; type: AccountType; active: boolean };
export type AccountingCompany = { id: string; name: string };

export type TrialBalanceAmounts = {
  openingBalance: string;
  openingDebit: string;
  openingCredit: string;
  debits: string;
  credits: string;
  closingBalance: string;
  closingDebit: string;
  closingCredit: string;
};

export type TrialBalanceLine = AccountingAccount & TrialBalanceAmounts;
export type TrialBalanceReport = {
  company: AccountingCompany;
  generatedAt: string;
  from: string;
  to: string;
  lines: TrialBalanceLine[];
  totals: TrialBalanceAmounts;
  balanced: boolean;
};

export type BalanceSheetLine = AccountingAccount & { balance: string };
export type BalanceSheetGroup = { lines: BalanceSheetLine[]; total: string };
export type BalanceSheetReport = {
  company: AccountingCompany;
  generatedAt: string;
  asOf: string;
  assets: BalanceSheetGroup;
  liabilities: BalanceSheetGroup;
  equity: BalanceSheetGroup;
  unclosedEarnings: string;
  equityIncludingEarnings: string;
  liabilitiesAndEquity: string;
  difference: string;
  balanced: boolean;
};
