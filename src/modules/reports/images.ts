export const MAX_REPORT_IMAGE_BYTES = 512 * 1024;
export const MAX_REPORT_IMAGES_BYTES = 1024 * 1024;
export const MAX_REPORT_IMAGE_DIMENSION = 4096;

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function imagePayload(data: string) {
  const prefix = data.startsWith("data:image/png;base64,") ? "data:image/png;base64," : data.startsWith("data:image/jpeg;base64,") ? "data:image/jpeg;base64," : null;
  if (!prefix) return null;
  const payload = data.slice(prefix.length);
  if (!payload.length || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const lastValue = base64Alphabet.indexOf(payload[payload.length - padding - 1]);
  if ((padding === 2 && lastValue % 16 !== 0) || (padding === 1 && lastValue % 4 !== 0)) return null;
  return { payload, bytes: payload.length / 4 * 3 - padding, png: prefix === "data:image/png;base64," };
}

export function reportImageBytes(data: string): number {
  return imagePayload(data)?.bytes ?? 0;
}

function unsignedInteger(content: string, offset: number): number {
  return content.charCodeAt(offset) * 16777216 + content.charCodeAt(offset + 1) * 65536 + content.charCodeAt(offset + 2) * 256 + content.charCodeAt(offset + 3);
}

function validPng(content: string): boolean {
  if (!content.startsWith("\x89PNG\r\n\x1a\n") || content.length < 57) return false;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= content.length) {
    const length = unsignedInteger(content, offset);
    const type = content.slice(offset + 4, offset + 8);
    if (offset + length + 12 > content.length) return false;
    if (offset === 8) {
      const width = unsignedInteger(content, offset + 8);
      const height = unsignedInteger(content, offset + 12);
      if (type !== "IHDR" || length !== 13 || width === 0 || height === 0 || width > MAX_REPORT_IMAGE_DIMENSION || height > MAX_REPORT_IMAGE_DIMENSION) return false;
    }
    if (offset !== 8 && type === "IHDR") return false;
    if (type === "IDAT" && length > 0) hasImageData = true;
    if (type === "IEND") return length === 0 && hasImageData && offset + 12 === content.length;
    offset += length + 12;
  }
  return false;
}

function validJpeg(content: string): boolean {
  if (!content.startsWith("\xff\xd8\xff") || !content.endsWith("\xff\xd9")) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset + 4 < content.length) {
    if (content.charCodeAt(offset) !== 255) return false;
    while (content.charCodeAt(offset) === 255) offset += 1;
    const marker = content.charCodeAt(offset);
    offset += 1;
    const length = content.charCodeAt(offset) * 256 + content.charCodeAt(offset + 1);
    if (length < 2 || offset + length >= content.length - 1) return false;
    if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
      const height = content.charCodeAt(offset + 3) * 256 + content.charCodeAt(offset + 4);
      const width = content.charCodeAt(offset + 5) * 256 + content.charCodeAt(offset + 6);
      if (length < 8 || width === 0 || height === 0 || width > MAX_REPORT_IMAGE_DIMENSION || height > MAX_REPORT_IMAGE_DIMENSION) return false;
      hasFrame = true;
    }
    if (marker === 218) return hasFrame && length >= 6 && offset + length < content.length - 2;
    if (marker === 0 || marker === 1 || marker >= 208 && marker <= 217) return false;
    offset += length;
  }
  return false;
}

export function validateReportImage(data: string): boolean {
  if (data.length > Math.ceil(MAX_REPORT_IMAGE_BYTES / 3) * 4 + 23) return false;
  const image = imagePayload(data);
  if (!image || image.bytes > MAX_REPORT_IMAGE_BYTES) return false;
  try {
    const content = atob(image.payload);
    return image.png ? validPng(content) : validJpeg(content);
  } catch {
    return false;
  }
}
