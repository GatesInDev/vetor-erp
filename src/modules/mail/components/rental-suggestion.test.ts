import assert from "node:assert/strict";
import test from "node:test";
import { suggestMailRental } from "./rental-suggestion";

const rentals = [{ id: "first", number: "LOC-024" }, { id: "second", number: "LOC-025" }];

test("suggests only an explicit and unambiguous rental reference", () => {
  assert.equal(suggestMailRental("NFSe referente à locação nº LOC-024", rentals)?.id, "first");
  assert.equal(suggestMailRental("Rental: loc-025\nInvoice attached", rentals)?.id, "second");
  assert.equal(suggestMailRental("Locacao número LOC-024", rentals)?.id, "first");
  assert.equal(suggestMailRental("Locação LOC-024 e locação LOC-025", rentals), null);
});

test("does not infer links from unrelated invoice numbers or partial matches", () => {
  assert.equal(suggestMailRental("Nota fiscal LOC-024 e boleto anexo", rentals), null);
  assert.equal(suggestMailRental("Locação LOC-0245", rentals), null);
  assert.equal(suggestMailRental("Locação nº 24", [{ id: "short", number: "24" }]), null);
  assert.equal(suggestMailRental("Locação A.123", [{ id: "punctuated", number: "A.123" }])?.id, "punctuated");
  assert.equal(suggestMailRental("Locação Ax123", [{ id: "punctuated", number: "A.123" }]), null);
});
