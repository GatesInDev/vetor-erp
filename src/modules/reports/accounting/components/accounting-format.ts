export function formatAccountingAmount(value: string | number, locale: string): string {
  const amount = typeof value === "number" ? value.toFixed(2) : value;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!match) return currency.format(Number(value));
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(match[2]));
  const fraction = (match[3] ?? "").padEnd(2, "0");
  return currency.formatToParts(match[1] ? -1 : 1).map((part) => part.type === "integer" ? integer : part.type === "fraction" ? fraction : part.value).join("");
}
