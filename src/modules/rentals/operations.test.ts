import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { HttpError, type Actor } from "@/lib/auth";
import { accountCodes } from "@/lib/account-catalog";
import { createEquipmentRental, createRentalCharge, readEquipmentRental, readEquipmentRentals, readRentalOptions, updateEquipmentRental } from "./operations";
import { payFinancialPayable } from "./payments";
import type { EquipmentRentalInput, RentalChargeInput } from "./schema";

const actor: Actor = { userId: "user-a", companyId: "company-a", role: "FINANCE", sessionId: "session-a" };
const rentalInput: EquipmentRentalInput = { projectId: "project-a", supplierId: "supplier-a", number: "LOC-001", equipmentName: "Mixer", equipmentIdentifier: "MIX-01", quantity: 2, startsAt: "2026-09-01", expectedReturnAt: null, returnedAt: null, notes: "" };
const rental = { ...rentalInput, id: "rental-a", companyId: actor.companyId, revision: 1, startsAt: new Date("2026-09-01T00:00:00Z"), charges: [], project: { id: rentalInput.projectId, code: "P01", name: "Project", active: true }, supplier: { id: rentalInput.supplierId, name: "Supplier" } };
const chargeInput: RentalChargeInput = { documentKind: "NFSE", documentNumber: "000123", issuedAt: "2026-09-30", dueAt: "2026-10-10", amount: "100.25", documentUrl: "", notes: "", files: [] };
const charge = { ...chargeInput, id: "charge-a", rentalId: rental.id, companyId: actor.companyId, amount: new Prisma.Decimal(chargeInput.amount), issuedAt: new Date("2026-09-30T00:00:00Z"), dueAt: new Date("2026-10-10T00:00:00Z"), files: [], payable: { id: "payable-a", status: "OPEN", paidAt: null, financialTitle: null } };
const hasStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

function linkClient() {
  return {
    project: { findFirst: async (args: Prisma.ProjectFindFirstArgs) => { assert.equal(args.where?.companyId, actor.companyId); return { id: rentalInput.projectId }; } },
    partner: { findFirst: async (args: Prisma.PartnerFindFirstArgs) => { assert.equal(args.where?.companyId, actor.companyId); return { id: rentalInput.supplierId }; } },
  };
}

test("creating a rental records only equipment metadata and requires scoped eligible links", async () => {
  let saved: Prisma.EquipmentRentalCreateArgs | undefined;
  const transaction = {
    project: { findFirst: async (args: Prisma.ProjectFindFirstArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: rentalInput.projectId, active: true }); return { id: rentalInput.projectId }; } },
    partner: { findFirst: async (args: Prisma.PartnerFindFirstArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: rentalInput.supplierId, supplier: true }); return { id: rentalInput.supplierId }; } },
    equipmentRental: { findFirst: async () => null, create: async (args: Prisma.EquipmentRentalCreateArgs) => { saved = args; return rental; } },
  } as unknown as Prisma.TransactionClient;
  const result = await createEquipmentRental(transaction, actor.companyId, rentalInput);
  assert.equal(saved?.data.companyId, actor.companyId);
  assert.equal(result.chargeCount, 0);
  assert.equal(result.totalCharged, "0.00");
  assert.deepEqual(result.charges, []);
});

test("rental creation rejects foreign or inactive project and non-supplier links", async () => {
  for (const missing of ["project", "partner"]) {
    const transaction = { ...linkClient(), [missing]: { findFirst: async () => null } } as unknown as Prisma.TransactionClient;
    await assert.rejects(createEquipmentRental(transaction, actor.companyId, rentalInput), hasStatus(422));
  }
});

test("rental reads and options cannot access another company's rental", async () => {
  const client = { equipmentRental: { findFirst: async (args: Prisma.EquipmentRentalFindFirstArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: rental.id }); return null; } } } as unknown as Prisma.TransactionClient;
  assert.equal(await readEquipmentRental(client, actor.companyId, rental.id), null);
  await assert.rejects(readRentalOptions(client, actor.companyId, rental.id), hasStatus(404));
});

test("rental updates reject stale revisions before writing", async () => {
  const transaction = { equipmentRental: { findFirst: async () => rental } } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateEquipmentRental(transaction, actor.companyId, rental.id, { ...rentalInput, revision: 2 }), hasStatus(409));
});

test("charged rentals cannot be moved to another project or supplier", async () => {
  const transaction = { ...linkClient(), equipmentRental: { findFirst: async () => ({ ...rental, charges: [charge] }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateEquipmentRental(transaction, actor.companyId, rental.id, { ...rentalInput, projectId: "project-b", revision: 1 }), hasStatus(409));
  await assert.rejects(updateEquipmentRental(transaction, actor.companyId, rental.id, { ...rentalInput, supplierId: "supplier-b", revision: 1 }), hasStatus(409));
});

test("rental edits atomically scope the revision update to the authenticated company", async () => {
  let updated: Prisma.EquipmentRentalUpdateManyArgs | undefined;
  const transaction = { ...linkClient(), equipmentRental: {
    findFirst: async (args: Prisma.EquipmentRentalFindFirstArgs) => args.where?.number ? null : rental,
    updateMany: async (args: Prisma.EquipmentRentalUpdateManyArgs) => { updated = args; return { count: 1 }; },
  } } as unknown as Prisma.TransactionClient;
  await updateEquipmentRental(transaction, actor.companyId, rental.id, { ...rentalInput, notes: "Returned clean", revision: 1 });
  assert.deepEqual(updated?.where, { companyId: actor.companyId, id: rental.id, revision: 1 });
  assert.deepEqual(updated?.data.revision, { increment: 1 });
});

test("a rental charge atomically creates a supplier payable and matching rental expense entry", async () => {
  let payable: Prisma.PayableCreateArgs | undefined;
  let entry: Prisma.JournalEntryCreateArgs | undefined;
  let savedCharge: Prisma.RentalChargeCreateArgs | undefined;
  const transaction = {
    equipmentRental: { findFirst: async (args: Prisma.EquipmentRentalFindFirstArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: rental.id }); return rental; }, updateMany: async () => ({ count: 1 }) },
    rentalCharge: { findFirst: async () => null, create: async (args: Prisma.RentalChargeCreateArgs) => { savedCharge = args; return charge; }, findFirstOrThrow: async (args: Prisma.RentalChargeFindFirstOrThrowArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: charge.id }); return charge; } },
    account: { findMany: async (args: Prisma.AccountFindManyArgs) => { assert.equal(args.where?.companyId, actor.companyId); return [{ id: "rental-cost", code: accountCodes.equipmentRentalCost }, { id: "supplier-liability", code: accountCodes.supplierPayable }]; } },
    payable: { create: async (args: Prisma.PayableCreateArgs) => { payable = args; return charge.payable; } },
    journalEntry: { create: async (args: Prisma.JournalEntryCreateArgs) => { entry = args; return { id: "entry-a" }; } },
  } as unknown as Prisma.TransactionClient;
  const result = await createRentalCharge(transaction, actor, rental.id, chargeInput);
  assert.equal(savedCharge?.data.companyId, actor.companyId);
  assert.equal(payable?.data.rentalChargeId, charge.id);
  assert.equal(payable?.data.contractId, undefined);
  assert.equal(payable?.data.contractorId, rental.supplierId);
  assert.equal(payable?.data.projectId, rental.projectId);
  assert.equal(entry?.data.debitAccountId, "rental-cost");
  assert.equal(entry?.data.creditAccountId, "supplier-liability");
  assert.equal(entry?.data.source, "RENTAL_CHARGE");
  assert.equal(entry?.data.sourceId, charge.id);
  assert.deepEqual(entry?.data.occurredAt, charge.issuedAt);
  assert.equal(result.amount, "100.25");
  assert.equal(result.payable?.id, charge.payable.id);
});

test("rental charge creation stops for missing rentals, duplicate documents and missing accounting accounts", async () => {
  const missing = { equipmentRental: { findFirst: async () => null } } as unknown as Prisma.TransactionClient;
  await assert.rejects(createRentalCharge(missing, actor, rental.id, chargeInput), hasStatus(404));
  const duplicate = { equipmentRental: { findFirst: async () => rental }, rentalCharge: { findFirst: async () => charge } } as unknown as Prisma.TransactionClient;
  await assert.rejects(createRentalCharge(duplicate, actor, rental.id, chargeInput), hasStatus(409));
  const invalidAccounts = { equipmentRental: { findFirst: async () => rental }, rentalCharge: { findFirst: async () => null }, account: { findMany: async () => [] } } as unknown as Prisma.TransactionClient;
  await assert.rejects(createRentalCharge(invalidAccounts, actor, rental.id, chargeInput), hasStatus(422));
});

test("paying rental and labor payables debits the corresponding liability without another expense", async () => {
  for (const rentalPayment of [true, false]) {
    let entry: Prisma.JournalEntryCreateArgs | undefined;
    const debitCode = rentalPayment ? accountCodes.supplierPayable : accountCodes.contractorPayable;
    const transaction = {
      payable: {
        findFirst: async (args: Prisma.PayableFindFirstArgs) => {
          assert.deepEqual(args.where, { id: charge.payable.id, companyId: actor.companyId });
          return { id: charge.payable.id, status: "OPEN", projectId: rental.projectId, contractorId: rental.supplierId, amount: charge.amount, contract: rentalPayment ? null : { companyId: actor.companyId, projectId: rental.projectId, contractorId: rental.supplierId, number: "CON-01" }, rentalCharge: rentalPayment ? { ...charge, rental } : null };
        },
        updateMany: async (args: Prisma.PayableUpdateManyArgs) => { assert.deepEqual(args.where, { id: charge.payable.id, companyId: actor.companyId, status: "OPEN" }); return { count: 1 }; },
      },
      account: { findMany: async () => [{ id: "liability", code: debitCode }, { id: "bank", code: accountCodes.bank }] },
      journalEntry: { create: async (args: Prisma.JournalEntryCreateArgs) => { entry = args; return { id: "payment-entry" }; } },
    } as unknown as Prisma.TransactionClient;
    const result = await payFinancialPayable(transaction, actor, charge.payable.id);
    assert.equal(entry?.data.debitAccountId, "liability");
    assert.equal(entry?.data.creditAccountId, "bank");
    assert.equal(entry?.data.source, rentalPayment ? "RENTAL_PAYMENT" : "CONTRACT_PAYMENT");
    assert.equal(result.amount, "100.25");
  }
});

test("already settled, foreign and mismatched rental payables cannot be paid", async () => {
  for (const payable of [null, { ...charge.payable, status: "PAID", rentalCharge: { rental } }, { ...charge.payable, projectId: "foreign-project", contractorId: rental.supplierId, rentalCharge: { rental } }]) {
    const transaction = { payable: { findFirst: async () => payable } } as unknown as Prisma.TransactionClient;
    await assert.rejects(payFinancialPayable(transaction, actor, charge.payable.id), hasStatus(payable ? 409 : 404));
  }
});

test("rental edits reject a revision lost after reading the original rental", async () => {
  const transaction = { ...linkClient(), equipmentRental: {
    findFirst: async (args: Prisma.EquipmentRentalFindFirstArgs) => args.where?.number ? null : rental,
    updateMany: async () => ({ count: 0 }),
  } } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateEquipmentRental(transaction, actor.companyId, rental.id, { ...rentalInput, revision: 1 }), hasStatus(409));
});

test("concurrent rental edits stop a charge before any financial record is written", async () => {
  const transaction = {
    equipmentRental: {
      findFirst: async () => rental,
      updateMany: async (args: Prisma.EquipmentRentalUpdateManyArgs) => {
        assert.deepEqual(args.where, { companyId: actor.companyId, id: rental.id, revision: rental.revision });
        assert.deepEqual(args.data, { revision: { increment: 1 } });
        return { count: 0 };
      },
    },
    rentalCharge: { findFirst: async () => null, create: async () => assert.fail("Conflicting charges must not be created") },
    account: { findMany: async (args: Prisma.AccountFindManyArgs) => {
      assert.deepEqual(args.where, { companyId: actor.companyId, active: true, OR: [{ code: accountCodes.equipmentRentalCost, type: "COST" }, { code: accountCodes.supplierPayable, type: "LIABILITY" }] });
      return [{ code: accountCodes.equipmentRentalCost }, { code: accountCodes.supplierPayable }];
    } },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(createRentalCharge(transaction, actor, rental.id, chargeInput), hasStatus(409));
});

test("rental totals preserve cents beyond the safe integer range and distinguish paid from open charges", async () => {
  const charges = [
    { ...charge, id: "charge-a", amount: new Prisma.Decimal("99999999999999.99") },
    { ...charge, id: "charge-b", amount: new Prisma.Decimal("0.01"), payable: { ...charge.payable, status: "PAID" } },
    { ...charge, id: "charge-c", amount: new Prisma.Decimal("0.02"), payable: { ...charge.payable, status: "CANCELLED" } },
  ];
  const client = { equipmentRental: { findFirst: async () => ({ ...rental, charges }) } } as unknown as Prisma.TransactionClient;
  const result = await readEquipmentRental(client, actor.companyId, rental.id);
  assert.equal(result?.totalCharged, "100000000000000.02");
  assert.equal(result?.totalPaid, "0.01");
  assert.equal(result?.totalOutstanding, "99999999999999.99");
  assert.equal(result?.charges[0].amount, "99999999999999.99");
});

test("rental listings scope project and supplier filters and apply scheduled and returned status", async () => {
  const client = { equipmentRental: { findMany: async (args: Prisma.EquipmentRentalFindManyArgs) => {
    assert.equal(args.where?.companyId, actor.companyId);
    assert.equal(args.where?.projectId, rental.projectId);
    assert.equal(args.where?.supplierId, rental.supplierId);
    return [rental, { ...rental, id: "future-rental", startsAt: new Date("9999-12-31T00:00:00Z") }, { ...rental, id: "returned-rental", returnedAt: new Date("2026-09-30T00:00:00Z") }];
  } } } as unknown as Prisma.TransactionClient;
  const filters = { projectId: rental.projectId, supplierId: rental.supplierId };
  assert.deepEqual((await readEquipmentRentals(client, actor.companyId, { ...filters, status: "SCHEDULED" })).map((row) => row.id), ["future-rental"]);
  assert.deepEqual((await readEquipmentRentals(client, actor.companyId, { ...filters, status: "RETURNED" })).map((row) => row.id), ["returned-rental"]);
});

test("a competing payment cannot create a second journal entry", async () => {
  const transaction = {
    payable: {
      findFirst: async () => ({ ...charge.payable, projectId: rental.projectId, contractorId: rental.supplierId, amount: charge.amount, contract: null, rentalCharge: { ...charge, rental } }),
      updateMany: async () => ({ count: 0 }),
    },
    account: { findMany: async (args: Prisma.AccountFindManyArgs) => {
      assert.deepEqual(args.where, { companyId: actor.companyId, active: true, OR: [{ code: accountCodes.supplierPayable, type: "LIABILITY" }, { code: accountCodes.bank, type: "ASSET" }] });
      return [{ code: accountCodes.supplierPayable }, { code: accountCodes.bank }];
    } },
    journalEntry: { create: async () => assert.fail("A competing payment must not post another entry") },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(payFinancialPayable(transaction, actor, charge.payable.id), hasStatus(409));
});

test("payment rejects ambiguous, foreign or inconsistent rental origins before changing the payable", async () => {
  const valid = { ...charge.payable, projectId: rental.projectId, contractorId: rental.supplierId, amount: charge.amount, contract: null, rentalCharge: { ...charge, rental } };
  for (const payable of [
    { ...valid, contract: { companyId: actor.companyId }, rentalCharge: null, contractorId: "wrong-supplier" },
    { ...valid, contract: { companyId: actor.companyId } },
    { ...valid, rentalCharge: null },
    { ...valid, rentalCharge: { ...charge, companyId: "other-company", rental } },
    { ...valid, rentalCharge: { ...charge, rental: { ...rental, companyId: "other-company" } } },
    { ...valid, contractorId: "wrong-supplier" },
    { ...valid, amount: new Prisma.Decimal("100.24") },
  ]) {
    const transaction = { payable: { findFirst: async () => payable, updateMany: async () => assert.fail("Invalid origins must not settle a payable") } } as unknown as Prisma.TransactionClient;
    await assert.rejects(payFinancialPayable(transaction, actor, charge.payable.id), hasStatus(409));
  }
});

test("missing payment accounts leave the payable open", async () => {
  const transaction = {
    payable: {
      findFirst: async () => ({ ...charge.payable, projectId: rental.projectId, contractorId: rental.supplierId, amount: charge.amount, contract: null, rentalCharge: { ...charge, rental } }),
      updateMany: async () => assert.fail("Payments without valid accounts must remain open"),
    },
    account: { findMany: async () => [{ code: accountCodes.bank }] },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(payFinancialPayable(transaction, actor, charge.payable.id), hasStatus(422));
});
