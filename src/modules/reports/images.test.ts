import assert from "node:assert/strict";
import test from "node:test";
import { MAX_REPORT_IMAGE_BYTES, MAX_REPORT_IMAGE_DIMENSION, MAX_REPORT_IMAGES_BYTES, reportImageBytes, validateReportImage } from "./images";
import { createReportElement, createReportPreset, reportPresets } from "./presets";
import { reportDefinitionSchema, reportElementSchema, reportTemplateInputSchema } from "./schema";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==";

function dataUrl(bytes: Buffer, mediaType = "image/png") {
  return `data:${mediaType};base64,${bytes.toString("base64")}`;
}

function sizedPng(size: number) {
  const source = Buffer.from(png.split(",")[1], "base64");
  const padding = Buffer.alloc(size - source.length, 65);
  padding.writeUInt32BE(padding.length - 12, 0);
  padding.write("tEXt", 4, "ascii");
  padding.write("Note\0", 8, "ascii");
  let checksum = 0xffffffff;
  for (const value of padding.subarray(4, padding.length - 4)) {
    checksum ^= value;
    for (let bit = 0; bit < 8; bit += 1) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  padding.writeUInt32BE((checksum ^ 0xffffffff) >>> 0, padding.length - 4);
  return dataUrl(Buffer.concat([source.subarray(0, 33), padding, source.subarray(33)]));
}

test("report images accept embedded PNG and JPEG and measure decoded bytes", () => {
  for (const image of [png, jpeg]) {
    assert.equal(validateReportImage(image), true);
    assert.equal(reportImageBytes(image), Buffer.from(image.split(",")[1], "base64").length);
  }
});

test("report images reject external URLs, active formats and forged media types", () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  for (const image of [
    "https://example.com/logo.png", "//example.com/logo.jpg", "blob:https://example.com/image", "/logo.png",
    dataUrl(svg, "image/svg+xml"), dataUrl(svg), dataUrl(html), dataUrl(html, "text/html"),
    png.replace("image/png", "image/jpeg"), jpeg.replace("image/jpeg", "image/png"),
    png.replace("image/png", "image/gif"), jpeg.replace("image/jpeg", "image/jpg"),
  ]) assert.equal(validateReportImage(image), false, image.slice(0, 70));
});

test("base64 payloads must be complete and canonical without whitespace or extra parameters", () => {
  for (const image of [
    "", "data:image/png;base64,", "data:image/png;base64,AA=A", "data:image/png;base64,AAAA===",
    "data:image/png;base64,AA-_=", "data:image/png;base64,AB==", "data:image/png;base64,AAB=",
    `${png}\n`, png.replace("base64,", "base64, "), png.replace(";base64", ";charset=utf-8;base64"),
    png.slice(0, -1), png.replace("base64,", "base64,%"),
  ]) {
    assert.equal(validateReportImage(image), false);
    assert.equal(reportImageBytes(image), 0);
  }
});

test("image validation rejects truncated signatures, invalid PNG chunk lengths and missing JPEG scans", () => {
  const pngBytes = Buffer.from(png.split(",")[1], "base64");
  const jpegBytes = Buffer.from(jpeg.split(",")[1], "base64");
  const brokenPng = Buffer.from(pngBytes);
  brokenPng.writeUInt32BE(0xffffffff, 33);
  const emptyDimensions = Buffer.from(pngBytes);
  emptyDimensions.writeUInt32BE(0, 16);
  for (const image of [
    dataUrl(pngBytes.subarray(0, 8)), dataUrl(pngBytes.subarray(0, -1)), dataUrl(brokenPng), dataUrl(emptyDimensions),
    dataUrl(jpegBytes.subarray(0, 3), "image/jpeg"), dataUrl(jpegBytes.subarray(0, -2), "image/jpeg"),
    dataUrl(Buffer.from([255, 216, 255, 217]), "image/jpeg"),
    dataUrl(Buffer.concat([pngBytes, Buffer.from("<script/>")])),
  ]) assert.equal(validateReportImage(image), false);
});

test("individual image limits use decoded bytes and accept the exact boundary", () => {
  const maximum = sizedPng(MAX_REPORT_IMAGE_BYTES);
  const oversized = sizedPng(MAX_REPORT_IMAGE_BYTES + 1);
  assert.equal(reportImageBytes(maximum), MAX_REPORT_IMAGE_BYTES);
  assert.equal(reportImageBytes(oversized), MAX_REPORT_IMAGE_BYTES + 1);
  assert.equal(validateReportImage(maximum), true);
  assert.equal(validateReportImage(oversized), false);
  assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: maximum })).success, true);
  assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: oversized })).success, false);
});

test("image dimensions reject oversized PNG and JPEG frames in either direction", () => {
  const pngBytes = Buffer.from(png.split(",")[1], "base64");
  const jpegBytes = Buffer.from(jpeg.split(",")[1], "base64");
  const frame = jpegBytes.indexOf(Buffer.from([255, 192]));
  assert.ok(frame > 0);
  for (const dimension of [16, 20]) {
    const oversized = Buffer.from(pngBytes);
    oversized.writeUInt32BE(MAX_REPORT_IMAGE_DIMENSION + 1, dimension);
    assert.equal(validateReportImage(dataUrl(oversized)), false);
    assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: dataUrl(oversized) })).success, false);
  }
  for (const dimension of [frame + 5, frame + 7]) {
    const oversized = Buffer.from(jpegBytes);
    oversized.writeUInt16BE(MAX_REPORT_IMAGE_DIMENSION + 1, dimension);
    assert.equal(validateReportImage(dataUrl(oversized, "image/jpeg")), false);
    assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: dataUrl(oversized, "image/jpeg") })).success, false);
  }
});

test("saving a report requires every image and rejects image payloads on other element types", () => {
  assert.equal(reportElementSchema.safeParse(createReportElement("image")).success, false);
  assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: "" })).success, false);
  assert.equal(reportElementSchema.safeParse(createReportElement("image", { imageData: png })).success, true);
  for (const type of ["text", "field", "line", "box", "blank", "signature", "table", "manualTable"] as const) {
    assert.equal(reportElementSchema.safeParse(createReportElement(type, { imageData: png })).success, false, type);
    assert.equal(reportElementSchema.safeParse(createReportElement(type, { imageData: undefined })).success, true, type);
  }
});

test("aggregate image limits count every occurrence and reject reports above one MiB", () => {
  const large = sizedPng(MAX_REPORT_IMAGE_BYTES);
  const definition = createReportPreset("blank").definition;
  const images = [createReportElement("image", { imageData: large }), createReportElement("image", { imageData: large })];
  assert.equal(images.reduce((sum, image) => sum + reportImageBytes(image.imageData!), 0), MAX_REPORT_IMAGES_BYTES);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: images }).success, true);
  const invalid = reportDefinitionSchema.safeParse({ ...definition, elements: [...images, createReportElement("image", { imageData: png })] });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.ok(invalid.error.issues.some((issue) => issue.message === "Report images must total at most 1 MiB"));
});

test("existing version-one templates remain valid and image data survives a serialization round trip", () => {
  for (const preset of reportPresets) {
    const template = createReportPreset(preset.id);
    assert.deepEqual(reportTemplateInputSchema.parse(JSON.parse(JSON.stringify(template))), template);
  }
  const template = createReportPreset("blank");
  template.definition.elements.push(createReportElement("image", { imageData: png, text: "Company logo" }));
  template.definition.elements.push(createReportElement("image", { imageData: jpeg, text: "Equipment photograph" }));
  const persisted = reportTemplateInputSchema.parse(JSON.parse(JSON.stringify(template)));
  assert.deepEqual(persisted, template);
  assert.equal(persisted.definition.elements.at(-1)?.imageData, jpeg);
});
