import "server-only";

import { db } from "@/lib/db";
import { readFinancialTitle, readFinancialTitles, readTitleLinkOptions } from "./operations";
import type { FinancialTitleFilters } from "./schema";

export { createFinancialTitle, updateFinancialTitle } from "./operations";

export function getFinancialTitles(companyId: string, filters: FinancialTitleFilters = {}) {
  return readFinancialTitles(db, companyId, filters);
}

export function getFinancialTitle(companyId: string, id: string) {
  return readFinancialTitle(db, companyId, id);
}

export function getTitleLinkOptions(companyId: string, currentTitleId?: string) {
  return readTitleLinkOptions(db, companyId, currentTitleId);
}
