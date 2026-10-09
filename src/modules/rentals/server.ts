import "server-only";

import { db } from "@/lib/db";
import { readEquipmentRental, readEquipmentRentals, readRentalOptions } from "./operations";
import type { RentalFilters } from "./schema";

export { createEquipmentRental, createRentalCharge, updateEquipmentRental } from "./operations";

export function getEquipmentRentals(companyId: string, filters: RentalFilters = {}) {
  return readEquipmentRentals(db, companyId, filters);
}

export function getEquipmentRental(companyId: string, id: string) {
  return readEquipmentRental(db, companyId, id);
}

export function getRentalOptions(companyId: string, currentRentalId?: string) {
  return readRentalOptions(db, companyId, currentRentalId);
}
