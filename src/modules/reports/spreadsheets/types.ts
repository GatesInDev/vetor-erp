export type TitleRow = {
  id: string;
  sourceRow: number;
  documentNumber: string;
  direction: "payable" | "receivable";
  category: string;
  party: string;
  issuedAt: string;
  dueDate: string;
  nominalAmount: string;
  interestAmount: string;
  totalAmount: string;
  paidAt: string;
  status: string;
  paymentMethod: string;
  notes: string;
};

export type ProjectRow = {
  id: string;
  sourceRow: number;
  projectNumber: string;
  name: string;
  party: string;
  taxId: string;
  city: string;
  address: string;
  salesContact: string;
  technicalContact: string;
  floorType: string;
  area: string;
  totalAmount: string;
  quotedAt: string;
  approvedAt: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string;
};

export type ImportIssue = { row: number; message: string };
type SheetInfo = { id: string; name: string; issues: ImportIssue[] };
export type ImportedSheet =
  | (SheetInfo & { kind: "titles"; rows: TitleRow[] })
  | (SheetInfo & { kind: "projects"; rows: ProjectRow[] });

export type ImportedWorkbook = {
  fileName: string;
  sheets: ImportedSheet[];
  skippedSheets: string[];
};

export type ReportRow = TitleRow | ProjectRow;
export type DateField = "dueDate" | "issuedAt" | "paidAt" | "quotedAt" | "approvedAt" | "startsAt" | "endsAt";
export type ReportFilters = {
  search: string;
  direction: "all" | "payable" | "receivable";
  status: string;
  category: string;
  party: string;
  paymentMethod: string;
  city: string;
  dateField: DateField;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  dueStatus: "all" | "overdue" | "today" | "upcoming";
  asOf: string;
  groupBy: "none" | "party" | "category" | "status" | "month" | "city";
  sortBy: "date" | "amount" | "party";
  sortDirection: "asc" | "desc";
  showNotes: boolean;
};

export type ReportGroup = { key: string; rows: ReportRow[]; totalAmount: string };
export type SpreadsheetReport = {
  fileName: string;
  sheetName: string;
  kind: ImportedSheet["kind"];
  generatedAt: string;
  filters: ReportFilters;
  rows: ReportRow[];
  groups: ReportGroup[];
  sourceCount: number;
  rejectedCount: number;
  totals: {
    amount: string;
    payable: string;
    receivable: string;
    balance: string;
    overdue: string;
    settled: string;
  };
};
