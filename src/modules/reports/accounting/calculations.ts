import { Prisma } from "@prisma/client";
import type { AccountType } from "@prisma/client";
import type { AccountingAccount, BalanceSheetGroup, BalanceSheetReport, TrialBalanceAmounts, TrialBalanceLine } from "./types";

export type AccountMovement = { accountId: string; amount: Prisma.Decimal };
export type LedgerSums = { debits: AccountMovement[]; credits: AccountMovement[] };

const AccountingDecimal = Prisma.Decimal.clone({ precision: 40 });
const zero = new AccountingDecimal(0);

function movementMap(movements: AccountMovement[]): Map<string, Prisma.Decimal> {
  const amounts = new Map<string, Prisma.Decimal>();
  for (const movement of movements) amounts.set(movement.accountId, (amounts.get(movement.accountId) ?? zero).plus(movement.amount));
  return amounts;
}

function balanceColumns(balance: Prisma.Decimal) {
  return { debit: Prisma.Decimal.max(balance, 0).toFixed(2), credit: Prisma.Decimal.max(balance.negated(), 0).toFixed(2) };
}

function sumAmount(lines: TrialBalanceLine[], field: keyof TrialBalanceAmounts): string {
  return lines.reduce((total, line) => total.plus(line[field]), zero).toFixed(2);
}

export function calculateTrialBalance(accounts: AccountingAccount[], opening: LedgerSums, period: LedgerSums): {
  lines: TrialBalanceLine[];
  totals: TrialBalanceAmounts;
  balanced: boolean;
} {
  const openingDebits = movementMap(opening.debits);
  const openingCredits = movementMap(opening.credits);
  const periodDebits = movementMap(period.debits);
  const periodCredits = movementMap(period.credits);
  const lines = accounts.map((account): TrialBalanceLine => {
    const openingBalance = (openingDebits.get(account.id) ?? zero).minus(openingCredits.get(account.id) ?? zero);
    const debits = periodDebits.get(account.id) ?? zero;
    const credits = periodCredits.get(account.id) ?? zero;
    const closingBalance = openingBalance.plus(debits).minus(credits);
    const openingColumns = balanceColumns(openingBalance);
    const closingColumns = balanceColumns(closingBalance);
    return {
      ...account, openingBalance: openingBalance.toFixed(2), openingDebit: openingColumns.debit, openingCredit: openingColumns.credit,
      debits: debits.toFixed(2), credits: credits.toFixed(2), closingBalance: closingBalance.toFixed(2), closingDebit: closingColumns.debit, closingCredit: closingColumns.credit,
    };
  });
  const fields: (keyof TrialBalanceAmounts)[] = ["openingBalance", "openingDebit", "openingCredit", "debits", "credits", "closingBalance", "closingDebit", "closingCredit"];
  const totals = Object.fromEntries(fields.map((field) => [field, sumAmount(lines, field)])) as TrialBalanceAmounts;
  const balanced = new AccountingDecimal(totals.openingBalance).isZero()
    && new AccountingDecimal(totals.debits).eq(totals.credits)
    && new AccountingDecimal(totals.closingBalance).isZero();
  return { lines, totals, balanced };
}

export function calculateBalanceSheet(accounts: AccountingAccount[], cumulative: LedgerSums): Pick<BalanceSheetReport, "assets" | "liabilities" | "equity" | "unclosedEarnings" | "equityIncludingEarnings" | "liabilitiesAndEquity" | "difference" | "balanced"> {
  const debits = movementMap(cumulative.debits);
  const credits = movementMap(cumulative.credits);
  const lines = accounts.map((account) => {
    const signedBalance = (debits.get(account.id) ?? zero).minus(credits.get(account.id) ?? zero);
    const balance = ["LIABILITY", "EQUITY", "REVENUE"].includes(account.type) ? signedBalance.negated() : signedBalance;
    return { ...account, balance: balance.toFixed(2) };
  });
  const group = (type: AccountType): BalanceSheetGroup => {
    const matching = lines.filter((line) => line.type === type);
    return { lines: matching, total: matching.reduce((total, line) => total.plus(line.balance), zero).toFixed(2) };
  };
  const assets = group("ASSET");
  const liabilities = group("LIABILITY");
  const equity = group("EQUITY");
  const unclosedEarnings = new AccountingDecimal(group("REVENUE").total).minus(group("COST").total).minus(group("EXPENSE").total);
  const equityIncludingEarnings = new AccountingDecimal(equity.total).plus(unclosedEarnings);
  const liabilitiesAndEquity = new AccountingDecimal(liabilities.total).plus(equityIncludingEarnings);
  const difference = new AccountingDecimal(assets.total).minus(liabilitiesAndEquity);
  return {
    assets, liabilities, equity, unclosedEarnings: unclosedEarnings.toFixed(2), equityIncludingEarnings: equityIncludingEarnings.toFixed(2),
    liabilitiesAndEquity: liabilitiesAndEquity.toFixed(2), difference: difference.toFixed(2), balanced: difference.isZero(),
  };
}
