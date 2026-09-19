export type SelectOption = { id: string; name: string };

export type InvoiceRow = {
  id: string;
  number: string;
  customer: string;
  project: string;
  amount: string;
  net: string;
  serviceDate: string;
  status: string;
};

export type MeasurementRow = {
  id: string;
  contractId: string;
  contractNumber: string;
  contractor: string;
  project: string;
  amount: string;
  measuredAt: string;
  approved: boolean;
};

export type ContractRow = {
  id: string;
  number: string;
  description: string;
  contractor: string;
  project: string;
  amount: string;
  measured: string;
  remaining: string;
};

export type BillingData = {
  invoices: InvoiceRow[];
  contracts: ContractRow[];
  measurements: MeasurementRow[];
  customers: SelectOption[];
  suppliers: SelectOption[];
  projects: SelectOption[];
};

export const formatMoney = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
export const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
export const today = () => new Date().toLocaleDateString("en-CA");
export const dateInputToIso = (value: string) => new Date(`${value}T12:00:00.000Z`).toISOString();
