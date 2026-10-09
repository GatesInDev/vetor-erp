import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { rentalFiltersSchema } from "@/modules/rentals/schema";
import { rejectRentalOwnerOverrides, rentalQuery } from "./validation";

const hasStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

test("rental requests reject tenant and actor overrides in bodies and query strings", () => {
  for (const field of ["companyId", "userId"]) {
    assert.throws(() => rejectRentalOwnerOverrides({ [field]: "other-owner" }), hasStatus(403));
    assert.throws(() => rentalQuery(new NextRequest(`http://localhost/api/equipment-rentals?${field}=other-owner`)), hasStatus(403));
  }
});

test("duplicate rental filters cannot override an earlier filter value", () => {
  assert.throws(() => rentalQuery(new NextRequest("http://localhost/api/equipment-rentals?status=ACTIVE&status=RETURNED")), hasStatus(400));
});

test("rental query parsing preserves supported filters and rejects unexpected fields", () => {
  const query = rentalQuery(new NextRequest("http://localhost/api/equipment-rentals?search=Mixer&status=ACTIVE"));
  assert.deepEqual(rentalFiltersSchema.parse(query), { search: "Mixer", status: "ACTIVE" });
  assert.equal(rentalFiltersSchema.safeParse(rentalQuery(new NextRequest("http://localhost/api/equipment-rentals?includeFiles=true"))).success, false);
});
