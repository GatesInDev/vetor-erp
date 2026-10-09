import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { createFinancialTitle, payableSnapshot, readFinancialTitle, readFinancialTitles, readTitleLinkOptions, updateFinancialTitle } from "./operations";
import type { FinancialTitleInput } from "./schema";
import { financialOriginHref, financialOriginReference } from "../origin";

const companyId = "company-a";
const input: FinancialTitleInput = { accountType: "RECEIVABLE", accountId: "receivable-a", kind: "BOLETO", number: "000045", bankName: "", digitLine: "", barcode: "", notes: "" };
const receivable = {
  id: input.accountId, companyId, amount: new Prisma.Decimal("123.45"), received: new Prisma.Decimal("23.45"),
  dueAt: new Date("2026-09-28T00:00:00Z"), customer: { id: "partner-a", name: "Customer" },
  project: { id: "project-a", name: "Project" }, invoice: { id: "invoice-a", number: "INV-001", status: "ISSUED" },
};
const title = {
  id: "title-a", companyId, payableId: null, receivableId: input.accountId, payable: null, receivable,
  kind: input.kind, number: input.number, bankName: "", digitLine: "", barcode: "", notes: "", revision: 1,
};
const isHttpStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;
const rentalPayable = {
  id: "rental-payable-a", companyId, amount: new Prisma.Decimal("850.00"), status: "OPEN", dueAt: new Date("2026-10-15T00:00:00Z"),
  contractor: { id: "supplier-a", name: "Equipment supplier" }, project: { id: "project-a", name: "Project" },
  contract: null, measurementId: null, rentalCharge: { id: "charge-a", documentNumber: "DOC-045", rental: { id: "rental-a", number: "RENT-001", equipmentName: "Floor grinder" } },
};

test("financial title reads and filters stay within the authenticated company", async () => {
  const client = {
    financialTitle: {
      findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => { assert.deepEqual(args.where, { companyId, id: title.id }); return title; },
      findMany: async (args: Prisma.FinancialTitleFindManyArgs) => { assert.equal(args.where?.companyId, companyId); return [title]; },
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal((await readFinancialTitle(client, companyId, title.id))?.remaining, "100.00");
  assert.equal((await readFinancialTitles(client, companyId, { status: "PARTIAL", search: "customer" })).length, 1);
  assert.equal((await readFinancialTitles(client, companyId, { status: "SETTLED" })).length, 0);
});

test("foreign financial titles are absent from direct reads", async () => {
  const client = { financialTitle: { findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => { assert.equal(args.where?.companyId, companyId); return null; } } } as unknown as Prisma.TransactionClient;
  assert.equal(await readFinancialTitle(client, companyId, "foreign-title"), null);
  await assert.rejects(readTitleLinkOptions(client, companyId, "foreign-title"), isHttpStatus(404));
});

test("title link options scope both account directions and retain the current link", async () => {
  const client = {
    financialTitle: { findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => { assert.deepEqual(args.where, { companyId, id: title.id }); return { id: title.id }; } },
    payable: { findMany: async (args: Prisma.PayableFindManyArgs) => {
      assert.deepEqual(args.where, { companyId, OR: [{ status: { not: "CANCELLED" }, financialTitle: null }, { financialTitle: { id: title.id } }] });
      return [];
    } },
    receivable: { findMany: async (args: Prisma.ReceivableFindManyArgs) => {
      assert.deepEqual(args.where, { companyId, OR: [{ invoice: { status: { not: "CANCELLED" } }, financialTitle: null }, { financialTitle: { id: title.id } }] });
      return [receivable];
    } },
  } as unknown as Prisma.TransactionClient;
  const options = await readTitleLinkOptions(client, companyId, title.id);
  assert.equal(options[0].accountId, receivable.id);
  assert.equal(options[0].origin.id, receivable.invoice.id);
  assert.equal(options[0].partner.id, receivable.customer.id);
});

test("title creation derives values from its scoped account without creating a financial balance", async () => {
  let created: Prisma.FinancialTitleCreateArgs | undefined;
  const transaction = {
    receivable: { findFirst: async (args: Prisma.ReceivableFindFirstArgs) => { assert.deepEqual(args.where, { companyId, id: input.accountId }); return receivable; } },
    financialTitle: {
      findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => { assert.deepEqual(args.where, { companyId, receivableId: input.accountId }); return null; },
      create: async (args: Prisma.FinancialTitleCreateArgs) => { created = args; return title; },
    },
  } as unknown as Prisma.TransactionClient;
  const result = await createFinancialTitle(transaction, companyId, input);
  assert.equal(created?.data.companyId, companyId);
  assert.equal(created?.data.receivableId, input.accountId);
  assert.equal(created?.data.payableId, null);
  assert.equal("amount" in (created?.data ?? {}), false);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.remaining, "100.00");
});

test("title creation rejects a linked account from another company", async () => {
  const transaction = { receivable: { findFirst: async (args: Prisma.ReceivableFindFirstArgs) => { assert.equal(args.where?.companyId, companyId); return null; } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(createFinancialTitle(transaction, companyId, input), isHttpStatus(404));
});

test("title creation rejects duplicate and cancelled account links before writing", async () => {
  const duplicate = {
    receivable: { findFirst: async () => receivable }, financialTitle: { findFirst: async () => ({ id: "other-title" }) },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(createFinancialTitle(duplicate, companyId, input), isHttpStatus(409));
  const cancelled = { receivable: { findFirst: async () => ({ ...receivable, invoice: { ...receivable.invoice, status: "CANCELLED" } }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(createFinancialTitle(cancelled, companyId, input), isHttpStatus(409));
});

test("title updates reject foreign titles and stale revisions before resolving links", async () => {
  const absent = { financialTitle: { findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => { assert.deepEqual(args.where, { companyId, id: title.id }); return null; } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateFinancialTitle(absent, companyId, title.id, { ...input, revision: 1 }), isHttpStatus(404));
  const stale = { financialTitle: { findFirst: async () => title } } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateFinancialTitle(stale, companyId, title.id, { ...input, revision: 2 }), isHttpStatus(409));
});

test("title edits atomically match company and revision while incrementing the version", async () => {
  let updated: Prisma.FinancialTitleUpdateManyArgs | undefined;
  const transaction = {
    receivable: { findFirst: async () => receivable },
    financialTitle: {
      findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => args.where?.id === title.id ? title : null,
      updateMany: async (args: Prisma.FinancialTitleUpdateManyArgs) => { updated = args; return { count: 1 }; },
      findFirstOrThrow: async (args: Prisma.FinancialTitleFindFirstOrThrowArgs) => { assert.deepEqual(args.where, { companyId, id: title.id }); return { ...title, revision: 2 }; },
    },
  } as unknown as Prisma.TransactionClient;
  const result = await updateFinancialTitle(transaction, companyId, title.id, { ...input, revision: 1 });
  assert.deepEqual(updated?.where, { companyId, id: title.id, revision: 1 });
  assert.deepEqual(updated?.data.revision, { increment: 1 });
  assert.equal(result.revision, 2);
});

test("concurrent title edits fail when the revision update does not win", async () => {
  const transaction = {
    receivable: { findFirst: async () => receivable },
    financialTitle: { findFirst: async (args: Prisma.FinancialTitleFindFirstArgs) => args.where?.id === title.id ? title : null, updateMany: async () => ({ count: 0 }) },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(updateFinancialTitle(transaction, companyId, title.id, { ...input, revision: 1 }), isHttpStatus(409));
});

test("rental payables expose their document and equipment without requiring a contract", () => {
  const account = payableSnapshot(rentalPayable as unknown as Parameters<typeof payableSnapshot>[0]);
  assert.deepEqual(account.origin, { type: "RENTAL", id: "rental-a", number: "RENT-001", chargeId: "charge-a", documentNumber: "DOC-045", equipmentName: "Floor grinder" });
  assert.equal(account.amount, "850.00");
  assert.equal(account.remaining, "850.00");
  assert.equal(account.status, "OPEN");
  assert.equal(account.measurementId, null);
  assert.equal(financialOriginHref(account.origin), "/rentals/rental-a");
  assert.equal(financialOriginReference(account.origin), "RENT-001 · DOC-045");
});

test("contract payables preserve origin, measurement and settlement details", () => {
  const account = payableSnapshot({ ...rentalPayable, contract: { id: "contract-a", number: "CTR-001" }, rentalCharge: null, measurementId: "measurement-a", status: "PAID" } as unknown as Parameters<typeof payableSnapshot>[0]);
  assert.deepEqual(account.origin, { type: "CONTRACT", id: "contract-a", number: "CTR-001" });
  assert.equal(account.measurementId, "measurement-a");
  assert.equal(account.settledAmount, "850.00");
  assert.equal(account.remaining, "0.00");
  assert.equal(account.status, "SETTLED");
  assert.equal(financialOriginHref(account.origin), "/billing?tab=contracts&recordId=contract-a");
});

test("title link options and search include received rental document references", async () => {
  const rentalTitle = { ...title, payableId: rentalPayable.id, payable: rentalPayable, receivableId: null, receivable: null };
  const client = {
    payable: { findMany: async (args: Prisma.PayableFindManyArgs) => {
      assert.equal(args.where?.companyId, companyId);
      assert.deepEqual(args.include?.rentalCharge, { include: { rental: true } });
      return [rentalPayable];
    } },
    receivable: { findMany: async () => [] },
    financialTitle: { findMany: async (args: Prisma.FinancialTitleFindManyArgs) => { assert.equal(args.where?.companyId, companyId); return [rentalTitle]; } },
  } as unknown as Prisma.TransactionClient;
  const options = await readTitleLinkOptions(client, companyId);
  assert.equal(options[0].origin.type, "RENTAL");
  assert.match(options[0].label, /RENT-001 · DOC-045/);
  assert.equal((await readFinancialTitles(client, companyId, { search: "doc-045" })).length, 1);
  assert.equal((await readFinancialTitles(client, companyId, { search: "floor grinder" })).length, 1);
});

test("creating a rental title uses the existing payable and derives its amount", async () => {
  const rentalInput: FinancialTitleInput = { ...input, accountType: "PAYABLE", accountId: rentalPayable.id };
  let created: Prisma.FinancialTitleCreateArgs | undefined;
  const transaction = {
    payable: { findFirst: async (args: Prisma.PayableFindFirstArgs) => { assert.deepEqual(args.where, { companyId, id: rentalPayable.id }); return rentalPayable; } },
    financialTitle: {
      findFirst: async () => null,
      create: async (args: Prisma.FinancialTitleCreateArgs) => { created = args; return { ...title, payableId: rentalPayable.id, payable: rentalPayable, receivableId: null, receivable: null }; },
    },
  } as unknown as Prisma.TransactionClient;
  const result = await createFinancialTitle(transaction, companyId, rentalInput);
  assert.equal(created?.data.companyId, companyId);
  assert.equal(created?.data.payableId, rentalPayable.id);
  assert.equal(created?.data.receivableId, null);
  assert.equal("amount" in (created?.data ?? {}), false);
  assert.equal(result.origin.type, "RENTAL");
  assert.equal(result.remaining, "850.00");
});
