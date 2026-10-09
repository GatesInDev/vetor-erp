import assert from "node:assert/strict";
import test from "node:test";
import { decrypt } from "@/lib/crypto";
import { prepareRentalFiles, previewRentalDocuments } from "./documents";
import { rentalFileLimit, rentalFilesSchema, type RentalFileInput } from "./documents-schema";
import { readRentalDocumentBody } from "./documents-request";

function xmlFile(xml: string): RentalFileInput {
  return { fileName: "invoice.xml", mediaType: "application/xml", contentBase64: Buffer.from(xml).toString("base64") };
}

test("rental XML preview preserves leading zeroes and exact payable values", () => {
  const preview = previewRentalDocuments([xmlFile('<n:CompNfse xmlns:n="urn:test"><n:Nfse><n:InfNfse><n:Numero>000123</n:Numero><n:DataEmissao>2026-09-30T10:30:00</n:DataEmissao><n:Servico><n:Valores><n:ValorServicos>1100.00</n:ValorServicos><n:ValorLiquidoNfse>1000.01</n:ValorLiquidoNfse></n:Valores></n:Servico></n:InfNfse></n:Nfse></n:CompNfse>')]);
  assert.deepEqual(preview.fields, { documentKind: "NFSE", documentNumber: "000123", issuedAt: "2026-09-30", amount: "1000.01" });
  assert.match(preview.warnings[0], /Review/);
});

test("rental import reads national NFSe and NFe totals without using item numbers", () => {
  const national = previewRentalDocuments([xmlFile('<NFSe><infNFSe><nNFSe>0001</nNFSe><dhProc>2026-10-01T00:00:00Z</dhProc><valores><vLiq>90071992547409.01</vLiq></valores><DPS><infDPS><nDPS>other</nDPS></infDPS></DPS></infNFSe></NFSe>')]);
  assert.equal(national.fields.documentNumber, "0001");
  assert.equal(national.fields.amount, "90071992547409.01");
  const goods = previewRentalDocuments([xmlFile('<nfeProc><NFe><infNFe><ide><nNF>23</nNF><dhEmi>2026-09-29T12:00:00-03:00</dhEmi></ide><det><prod><vProd>12.00</vProd></prod></det><total><ICMSTot><vNF>99.50</vNF></ICMSTot></total></infNFe></NFe></nfeProc>')]);
  assert.deepEqual(goods.fields, { documentKind: "INVOICE", documentNumber: "23", issuedAt: "2026-09-29", amount: "99.50" });
});

test("rental imports reject entities malformed XML excessive depth and ambiguous batches", async () => {
  assert.throws(() => previewRentalDocuments([xmlFile('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]><x>&x;</x>')]), /Unsupported XML declarations/);
  assert.throws(() => previewRentalDocuments([xmlFile("<invoice><broken></invoice>")]), /Invoice file is invalid/);
  assert.throws(() => previewRentalDocuments([xmlFile("<x>".repeat(65) + "</x>".repeat(65))]), /too complex/);
  assert.throws(() => previewRentalDocuments([xmlFile("<list><InfNfse><Numero>1</Numero></InfNfse><InfNfse><Numero>2</Numero></InfNfse></list>")]), /Multiple invoices/);
  assert.throws(() => previewRentalDocuments([xmlFile("<root/>"), xmlFile("<root/>")]), /Only one XML/);
  await assert.rejects(prepareRentalFiles([xmlFile("<root/>"), xmlFile("<root/>")]), /Only one XML/);
  await assert.rejects(prepareRentalFiles([xmlFile("<list><InfNfse><Numero>1</Numero></InfNfse><InfNfse><Numero>2</Numero></InfNfse></list>")]), /Multiple invoices/);
  assert.deepEqual(previewRentalDocuments([xmlFile("<unknown><amount>100</amount></unknown>")]).fields, {});
});

test("rental attachments reject unsafe names formats encodings and cumulative size", async () => {
  assert.equal(rentalFilesSchema.safeParse([{ ...xmlFile("<root/>"), fileName: "../invoice.xml" }]).success, false);
  assert.equal(rentalFilesSchema.safeParse([{ ...xmlFile("<root/>"), contentBase64: "file???=" }]).success, false);
  const large = { ...xmlFile("<root/>"), contentBase64: Buffer.alloc(rentalFileLimit).toString("base64") };
  assert.equal(rentalFilesSchema.safeParse([large, xmlFile("<root/>")]).success, false);
  await assert.rejects(prepareRentalFiles([{ fileName: "fake.pdf", mediaType: "application/pdf", contentBase64: Buffer.from("<html>fake</html>").toString("base64") }]), /Invoice file is invalid/);
  assert.throws(() => previewRentalDocuments([xmlFile('<?xml version="1.0" encoding="ISO-8859-1"?><root/>')]), /Unsupported XML encoding/);
});

test("rental attachment storage encrypts original bytes and PDF has no extracted fields", async () => {
  const previous = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const file: RentalFileInput = { fileName: "rental.pdf", mediaType: "application/pdf", contentBase64: Buffer.from("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n").toString("base64") };
    const [stored] = await prepareRentalFiles([file]);
    assert.equal(decrypt(stored.contentEncrypted), file.contentBase64);
    assert.equal(stored.sizeBytes, Buffer.from(file.contentBase64, "base64").length);
    assert.notEqual(stored.contentEncrypted, file.contentBase64);
    const preview = previewRentalDocuments([file]);
    assert.deepEqual(preview.fields, {});
    assert.ok(preview.warnings.some((warning) => warning.includes("without automatic")));
  } finally {
    if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = previous;
  }
});

test("rental file requests enforce the actual body size without trusting content length", async () => {
  assert.deepEqual(await readRentalDocumentBody(new Request("http://localhost", { method: "POST", body: '{"files":[]}' })), { files: [] });
  await assert.rejects(readRentalDocumentBody(new Request("http://localhost", { method: "POST", headers: { "Content-Length": "1" }, body: "x".repeat(3 * 1024 * 1024 + 1) })), /too large/);
});
