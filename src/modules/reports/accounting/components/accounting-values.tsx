"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import { accountingTranslations } from "@/modules/settings/accounting-translations";
import { formatAccountingAmount } from "./accounting-format";

export function useAccountingFormat() {
  const { locale, formatDate, t } = useLocale();
  return { money: (value: string | number) => formatAccountingAmount(value, locale), date: (value: string) => formatDate(value, { dateStyle: "medium" }), t: (source: string) => locale === "en-US" ? accountingTranslations[source] ?? t(source) : t(source) };
}

export function AccountBalance({ value }: { value: string }) {
  const { money, t } = useAccountingFormat();
  const negative = value.startsWith("-");
  const zero = /^-?0(?:\.0+)?$/.test(value);
  return <span className="accounting-balance">{money(value.replace(/^-/, ""))}{!zero && <abbr title={t(negative ? "Saldo credor" : "Saldo devedor")}>{negative ? "C" : "D"}</abbr>}</span>;
}
