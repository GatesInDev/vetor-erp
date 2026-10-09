import { z } from "zod";

export const accountingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return value >= "0001-01-01" && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid accounting date");

export function accountingDefaults(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return { asOf: today, from: `${today.slice(0, 7)}-01`, to: today };
}

export const balanceSheetFiltersSchema = z.object({
  asOf: accountingDateSchema.default(() => accountingDefaults().asOf),
}).strict();

export const trialBalanceFiltersSchema = z.object({
  from: accountingDateSchema.default(() => accountingDefaults().from),
  to: accountingDateSchema.default(() => accountingDefaults().to),
}).strict().refine((value) => value.from <= value.to, { path: ["to"], message: "End date must not precede start date" });

export type BalanceSheetFilters = z.infer<typeof balanceSheetFiltersSchema>;
export type TrialBalanceFilters = z.infer<typeof trialBalanceFiltersSchema>;

export function accountingDayStart(date: string): Date {
  return new Date(`${accountingDateSchema.parse(date)}T00:00:00.000Z`);
}

export function accountingDayEndExclusive(date: string): Date {
  const end = accountingDayStart(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}
