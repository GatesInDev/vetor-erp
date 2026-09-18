import { HttpError } from "@/lib/auth";

export type OfxTransaction = { externalId: string; amount: string; postedAt: Date; description: string };

function value(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\r\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

export function parseOfx(content: string): OfxTransaction[] {
  if (content.length > 2_000_000) throw new HttpError(413, "OFX file too large");
  const blocks = content.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi) ?? [];
  if (!blocks.length || blocks.length > 5000) throw new HttpError(400, "No supported OFX transactions found");
  return blocks.map((block) => {
    const externalId = value(block, "FITID");
    const rawAmount = value(block, "TRNAMT")?.replace(",", ".");
    const rawDate = value(block, "DTPOSTED");
    const description = value(block, "MEMO") ?? value(block, "NAME") ?? "Bank transaction";
    if (!externalId || !rawAmount || !rawDate || !/^-?\d+(\.\d{1,2})?$/.test(rawAmount) || !/^\d{8}/.test(rawDate)) throw new HttpError(400, "Malformed OFX transaction");
    const postedAt = new Date(`${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T00:00:00Z`);
    if (Number.isNaN(postedAt.getTime())) throw new HttpError(400, "Invalid OFX date");
    return { externalId: externalId.slice(0, 128), amount: rawAmount, postedAt, description: description.slice(0, 500) };
  });
}
