import assert from "node:assert/strict";
import test from "node:test";
import { equipmentRentalInputSchema, equipmentRentalUpdateSchema, rentalChargeInputSchema, rentalDateSchema, rentalFiltersSchema } from "./schema";

const id = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
const rental = { projectId: id, supplierId: id, number: "LOC-001", equipmentName: "Concrete mixer", quantity: 1, startsAt: "2026-09-01" };
const charge = { documentKind: "NFSE", documentNumber: "000123", issuedAt: "2026-09-30", dueAt: "2026-10-10", amount: "1250.25" };

test("rental input accepts a project, supplier and bounded equipment metadata", () => {
  const result = equipmentRentalInputSchema.parse(rental);
  assert.equal(result.expectedReturnAt, null);
  assert.equal(result.returnedAt, null);
  assert.equal(result.equipmentIdentifier, "");
  for (const extra of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: 10000 }, { number: " " }, { equipmentName: "a".repeat(161) }, { companyId: id }, { payableId: id }]) {
    assert.equal(equipmentRentalInputSchema.safeParse({ ...rental, ...extra }).success, false);
  }
});

test("rental dates must be real calendar dates in chronological order", () => {
  assert.equal(rentalDateSchema.safeParse("2024-02-29").success, true);
  for (const date of ["2026-02-29", "2026-04-31", "2026-1-01", "0000-01-01"]) assert.equal(rentalDateSchema.safeParse(date).success, false);
  assert.equal(equipmentRentalInputSchema.safeParse({ ...rental, returnedAt: "2026-08-31" }).success, false);
  assert.equal(equipmentRentalInputSchema.safeParse({ ...rental, expectedReturnAt: "2026-08-31" }).success, false);
  assert.equal(equipmentRentalInputSchema.safeParse({ ...rental, returnedAt: "2026-09-01" }).success, true);
});

test("rental updates require an explicit positive revision", () => {
  assert.equal(equipmentRentalUpdateSchema.safeParse({ ...rental, revision: 1 }).success, true);
  for (const revision of [undefined, 0, -1, 1.5, 2147483647]) assert.equal(equipmentRentalUpdateSchema.safeParse({ ...rental, revision }).success, false);
});

test("rental charges preserve document leading zeroes and exact positive cents", () => {
  assert.equal(rentalChargeInputSchema.parse(charge).documentNumber, "000123");
  for (const amount of ["0", "0.00", "-1", "1.001", "1e3", "1,23", "100000000000000", 1.23]) assert.equal(rentalChargeInputSchema.safeParse({ ...charge, amount }).success, false);
  assert.equal(rentalChargeInputSchema.safeParse({ ...charge, amount: "0.01" }).success, true);
  assert.equal(rentalChargeInputSchema.parse({ ...charge, amount: "99999999999999.99" }).amount, "99999999999999.99");
  assert.equal(rentalChargeInputSchema.safeParse({ ...charge, dueAt: charge.issuedAt }).success, true);
  assert.equal(rentalChargeInputSchema.safeParse({ ...charge, dueAt: "2026-09-29" }).success, false);
});

test("rental charge URLs allow external document links but reject executable protocols and credentials", () => {
  for (const documentUrl of ["", "https://example.com/invoice.pdf", "http://example.com/document"]) assert.equal(rentalChargeInputSchema.safeParse({ ...charge, documentUrl }).success, true);
  for (const documentUrl of ["javascript:alert(1)", "data:text/html,test", "file:///c:/secret", "https://user:password@example.com/file"]) assert.equal(rentalChargeInputSchema.safeParse({ ...charge, documentUrl }).success, false);
});

test("rental charge metadata cannot override ownership, payable or accounting fields", () => {
  for (const extra of [{ companyId: id }, { userId: id }, { rentalId: id }, { payableId: id }, { status: "PAID" }, { debitAccountId: id }]) assert.equal(rentalChargeInputSchema.safeParse({ ...charge, ...extra }).success, false);
  assert.equal(rentalFiltersSchema.safeParse({ companyId: id }).success, false);
  assert.equal(rentalFiltersSchema.safeParse({ status: "RETURNED" }).success, true);
});
