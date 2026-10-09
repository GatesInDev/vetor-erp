import type { financialTitleKinds, financialTitleStatuses, titleAccountTypes } from "./schema";

export type FinancialTitleKind = typeof financialTitleKinds[number];
export type FinancialTitleStatus = typeof financialTitleStatuses[number];
export type TitleAccountType = typeof titleAccountTypes[number];
export type FinancialAccountOrigin = { id: string; number: string; type: "INVOICE" | "CONTRACT" } | {
  id: string;
  number: string;
  type: "RENTAL";
  chargeId: string;
  documentNumber: string;
  equipmentName: string;
};

export type TitleAccountSnapshot = {
  accountType: TitleAccountType;
  accountId: string;
  amount: string;
  settledAmount: string;
  remaining: string;
  dueAt: string;
  status: FinancialTitleStatus;
  partner: { id: string; name: string };
  project: { id: string; name: string };
  origin: FinancialAccountOrigin;
  measurementId: string | null;
};

export type FinancialTitleRow = TitleAccountSnapshot & {
  id: string;
  kind: FinancialTitleKind;
  number: string;
  bankName: string;
  digitLine: string;
  barcode: string;
  notes: string;
  revision: number;
};

export type TitleLinkOption = TitleAccountSnapshot & { label: string };
