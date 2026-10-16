import { Unzip, UnzipInflate } from "fflate";

export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 200;

function archiveEntryCount(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error("WORKBOOK_INVALID");
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    if (offset + 22 + view.getUint16(offset + 20, true) !== bytes.length) continue;
    const count = view.getUint16(offset + 10, true);
    const directorySize = view.getUint32(offset + 12, true);
    const directoryOffset = view.getUint32(offset + 16, true);
    if (view.getUint16(offset + 4, true) || view.getUint16(offset + 6, true) || view.getUint16(offset + 8, true) !== count) {
      throw new Error("WORKBOOK_INVALID");
    }
    if (count > MAX_ARCHIVE_ENTRIES) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
    if (!count || directoryOffset + directorySize !== offset) throw new Error("WORKBOOK_INVALID");
    let cursor = directoryOffset;
    let expandedBytes = 0;
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > offset || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("WORKBOOK_INVALID");
      if (view.getUint16(cursor + 8, true) & 1) throw new Error("WORKBOOK_UNSAFE");
      const entrySize = view.getUint32(cursor + 24, true);
      expandedBytes += entrySize;
      if (entrySize > MAX_ENTRY_BYTES || expandedBytes > MAX_EXPANDED_BYTES) throw new Error("WORKBOOK_TOO_LARGE");
      cursor += 46 + view.getUint16(cursor + 28, true) + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    }
    if (cursor !== offset) throw new Error("WORKBOOK_INVALID");
    return count;
  }
  throw new Error("WORKBOOK_INVALID");
}

export function readSpreadsheetArchive(bytes: Uint8Array): Map<string, string> {
  if (!bytes.length) throw new Error("FILE_EMPTY");
  if (bytes.length > MAX_SPREADSHEET_BYTES) throw new Error("FILE_TOO_LARGE");
  const expectedEntries = archiveEntryCount(bytes);
  const entries = new Map<string, string>();
  const names = new Set<string>();
  let expandedBytes = 0;
  let completedEntries = 0;
  const unzip = new Unzip((file) => {
    if (names.has(file.name) || file.name.startsWith("/") || file.name.includes("\\") || file.name.split("/").includes("..")) {
      throw new Error("WORKBOOK_INVALID");
    }
    names.add(file.name);
    if (names.size > MAX_ARCHIVE_ENTRIES) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
    if (/vbaProject|activeX|embeddings|macrosheets/i.test(file.name)) throw new Error("WORKBOOK_UNSAFE");
    if (file.originalSize !== undefined && file.originalSize > MAX_ENTRY_BYTES) throw new Error("WORKBOOK_TOO_LARGE");
    if (file.compression !== 0 && file.compression !== 8) throw new Error("WORKBOOK_INVALID");
    const isXml = /(?:\.xml|\.rels)$/i.test(file.name);
    const chunks: Uint8Array[] = [];
    let entryBytes = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        if (error instanceof Error && /^(?:WORKBOOK_|FILE_)/.test(error.message)) throw error;
        throw new Error("WORKBOOK_INVALID");
      }
      entryBytes += chunk.length;
      expandedBytes += chunk.length;
      if (entryBytes > MAX_ENTRY_BYTES || expandedBytes > MAX_EXPANDED_BYTES) {
        file.terminate();
        throw new Error("WORKBOOK_TOO_LARGE");
      }
      if (isXml) chunks.push(chunk);
      if (!final) return;
      completedEntries++;
      if (!isXml) return;
      const merged = new Uint8Array(entryBytes);
      let offset = 0;
      for (const part of chunks) {
        merged.set(part, offset);
        offset += part.length;
      }
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(merged);
      if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || /macroEnabled|vbaProject/i.test(xml)) throw new Error("WORKBOOK_UNSAFE");
      entries.set(file.name, xml);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 1024) {
      unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    }
  } catch (error) {
    if (error instanceof Error && /^(?:WORKBOOK_|FILE_)/.test(error.message)) throw error;
    throw new Error("WORKBOOK_INVALID");
  }
  if (completedEntries !== expectedEntries || names.size !== expectedEntries) throw new Error("WORKBOOK_INVALID");
  if (!entries.has("[Content_Types].xml") || !entries.has("xl/workbook.xml") || !entries.has("xl/_rels/workbook.xml.rels")) {
    throw new Error("WORKBOOK_INVALID");
  }
  return entries;
}
