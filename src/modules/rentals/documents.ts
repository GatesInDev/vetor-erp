import { XMLParser, XMLValidator } from "fast-xml-parser";
import { HttpError } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { rentalFilesSchema, type RentalDocumentPreview, type RentalFileInput } from "./documents-schema";

type XmlNode = Record<string, unknown>;

function parseXml(bytes: Buffer): XmlNode {
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new HttpError(400, "Unsupported XML encoding. Use UTF-8."); }
  const encoding = /<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)["']/i.exec(xml)?.[1];
  if (encoding && !/^utf-?8$/i.test(encoding)) throw new HttpError(400, "Unsupported XML encoding. Use UTF-8.");
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new HttpError(400, "Unsupported XML declarations.");
  let depth = 0;
  let nodes = 0;
  const tags = /<(?:!--[\s\S]*?--|!\[CDATA\[[\s\S]*?\]\]|\?[\s\S]*?\?|(?:[^"'<>]|"[^"]*"|'[^']*')*)>/g;
  for (const [tag] of xml.matchAll(tags)) {
    if (tag.startsWith("<!") || tag.startsWith("<?")) continue;
    nodes += 1;
    if (tag.startsWith("</")) depth -= 1;
    else if (!tag.endsWith("/>")) depth += 1;
    if (nodes > 10000 || depth > 64) throw new HttpError(400, "The XML document is too complex.");
  }
  if (XMLValidator.validate(xml) !== true) throw new HttpError(400, "Invoice file is invalid.");
  try {
    return new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, processEntities: false, maxNestedTags: 64, transformTagName: (name) => name.toLowerCase() }).parse(xml) as XmlNode;
  } catch { throw new HttpError(400, "Invoice file is invalid."); }
}

function readFiles(input: RentalFileInput[]) {
  const files = rentalFilesSchema.parse(input).map((file) => {
    const bytes = Buffer.from(file.contentBase64, "base64");
    if (bytes.toString("base64") !== file.contentBase64) throw new HttpError(400, "Invalid file encoding");
    if (file.mediaType === "application/pdf") {
      if (!/\.pdf$/i.test(file.fileName) || !/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString("ascii")) || !bytes.subarray(-1024).toString("ascii").includes("%%EOF")) throw new HttpError(400, "Invoice file is invalid.");
      return { file, bytes, xml: null };
    }
    if (!/\.xml$/i.test(file.fileName)) throw new HttpError(400, "Only PDF and XML files are supported.");
    return { file, bytes, xml: parseXml(bytes) };
  });
  const xmlFiles = files.filter((file) => file.xml);
  if (xmlFiles.length > 1) throw new HttpError(400, "Only one XML invoice can be imported at a time.");
  if (xmlFiles.some((file) => nodesNamed(file.xml, "infnfse").length + nodesNamed(file.xml, "infnfe").length > 1)) throw new HttpError(400, "Multiple invoices were found. Import one invoice per charge.");
  return files;
}

function nodesNamed(node: unknown, name: string): XmlNode[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodesNamed(child, name));
  return Object.entries(node).flatMap(([key, child]) => key === name ? (Array.isArray(child) ? child : [child]).filter((item): item is XmlNode => Boolean(item && typeof item === "object" && !Array.isArray(item))) : nodesNamed(child, name));
}

function valueAt(node: XmlNode, ...path: string[]): string | undefined {
  let value: unknown = node;
  for (const key of path) value = value && typeof value === "object" ? (value as XmlNode)[key] : undefined;
  return typeof value === "string" ? value.trim() : undefined;
}

function uniqueValue(node: unknown, name: string): string | undefined {
  const values: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === name && typeof child === "string") values.push(child.trim());
      else visit(child);
    }
  };
  visit(node);
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : undefined;
}

export function previewRentalDocuments(input: RentalFileInput[]): RentalDocumentPreview {
  const files = readFiles(input);
  const xmlFiles = files.filter((file) => file.xml);
  const warnings = ["Review the imported values before recording the charge."];
  if (files.some((file) => !file.xml)) warnings.push("PDF files are attached without automatic field extraction.");
  if (!xmlFiles.length) return { fields: {}, warnings: [...warnings, "Select an XML file to import."] };
  const xml = xmlFiles[0].xml;
  const serviceInvoices = nodesNamed(xml, "infnfse");
  const goodsInvoices = nodesNamed(xml, "infnfe");
  const invoice = serviceInvoices[0] ?? goodsInvoices[0];
  if (!invoice) return { fields: {}, warnings: [...warnings, "No supported invoice fields were found. Enter the document details manually."] };
  const service = serviceInvoices.length === 1;
  const fields: RentalDocumentPreview["fields"] = { documentKind: service ? "NFSE" : "INVOICE" };
  const number = service ? valueAt(invoice, "numero") ?? valueAt(invoice, "nnfse") : valueAt(invoice, "ide", "nnf");
  if (number && number.length <= 80) fields.documentNumber = number;
  const date = (service ? valueAt(invoice, "dataemissao") ?? valueAt(invoice, "dhproc") : valueAt(invoice, "ide", "dhemi") ?? valueAt(invoice, "ide", "demi"))?.slice(0, 10);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date) fields.issuedAt = date;
  }
  const amount = service ? uniqueValue(invoice, "valorliquidonfse") ?? uniqueValue(invoice, "vliq") ?? uniqueValue(invoice, "valorservicos") ?? uniqueValue(invoice, "vserv") : valueAt(invoice, "total", "icmstot", "vnf");
  if (amount && /^\d{1,14}(\.\d{1,2})?$/.test(amount) && /[1-9]/.test(amount)) fields.amount = amount;
  if (!fields.documentNumber || !fields.issuedAt || !fields.amount) warnings.push("No supported invoice fields were found. Enter the document details manually.");
  return { fields, warnings };
}

export async function prepareRentalFiles(input: RentalFileInput[]) {
  return readFiles(input).map(({ file, bytes }) => ({ fileName: file.fileName, mediaType: file.mediaType, sizeBytes: bytes.length, contentEncrypted: encrypt(file.contentBase64) }));
}
