export function formatRentalTotal(values: string[], locale: string, decimalPlaces: number): string {
  const total = values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  }, BigInt(0));
  const roundingScale = BigInt(10) ** BigInt(Math.max(0, 2 - decimalPlaces));
  const rounded = decimalPlaces < 2 ? (total + roundingScale / BigInt(2)) / roundingScale : total * BigInt(10) ** BigInt(decimalPlaces - 2);
  const displayScale = BigInt(10) ** BigInt(decimalPlaces);
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(rounded / displayScale);
  const fraction = (rounded % displayScale).toString().padStart(decimalPlaces, "0");
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
  return formatter.formatToParts(BigInt(0)).map((part) => part.type === "integer" ? whole : part.type === "fraction" ? fraction : part.value).join("");
}
