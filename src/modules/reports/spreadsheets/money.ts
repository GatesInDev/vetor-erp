export function parseAmount(value: string): string {
  let input = value.trim().replace(/^R\$\s*/, "");
  if (input.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(input)) throw new Error("Invalid monetary amount");
    input = input.replaceAll(".", "").replace(",", ".");
  }
  const match = /^(\d{1,16})(?:\.(\d+))?$/.exec(input);
  if (!match || (match[2]?.slice(2).replaceAll("0", "") ?? "")) throw new Error("Invalid monetary amount");
  return `${BigInt(match[1])}.${(match[2] ?? "").slice(0, 2).padEnd(2, "0")}`;
}

export function toCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error("Invalid monetary amount");
  return (BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"))) * BigInt(match[1] ? -1 : 1);
}

export function fromCents(value: bigint): string {
  const absolute = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
