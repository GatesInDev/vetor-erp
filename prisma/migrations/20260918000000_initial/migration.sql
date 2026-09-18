CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNTANT', 'FINANCE', 'OPERATIONS', 'VIEWER');

CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE');

CREATE TYPE "EntrySource" AS ENUM ('INVOICE', 'BANK_RECEIPT', 'CONTRACT_PAYMENT', 'MEASUREMENT', 'MANUAL');

CREATE TYPE "PayableStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'EXPORTED', 'ISSUED', 'CANCELLED');

CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxIdEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxIdEncrypted" TEXT,
    "bankEncrypted" TEXT,
    "customer" BOOLEAN NOT NULL DEFAULT false,
    "supplier" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LaborContract" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "issWithheld" BOOLEAN NOT NULL DEFAULT false,
    "inssWithheld" BOOLEAN NOT NULL DEFAULT false,
    "issAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inssAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "LaborContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Measurement" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "issAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inssAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "debitAccountId" UUID NOT NULL,
    "creditAccountId" UUID NOT NULL,
    "projectId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "source" "EntrySource" NOT NULL,
    "sourceId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInvoice" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "taxAnnex" TEXT NOT NULL,
    "issWithheld" BOOLEAN NOT NULL DEFAULT false,
    "inssWithheld" BOOLEAN NOT NULL DEFAULT false,
    "issAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inssAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "layoutVersion" TEXT,
    "xmlEncrypted" TEXT,

    CONSTRAINT "ServiceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsSale" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GoodsSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receivable" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "received" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payable" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "measurementId" UUID,
    "projectId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
    "id" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "receivableId" UUID,
    "reconciledAt" TIMESTAMP(3),

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxBracket" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "annex" TEXT NOT NULL,
    "lowerLimit" DECIMAL(18,2) NOT NULL,
    "upperLimit" DECIMAL(18,2) NOT NULL,
    "nominalRate" DECIMAL(8,6) NOT NULL,
    "deduction" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),

    CONSTRAINT "TaxBracket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyTask" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

CREATE UNIQUE INDEX "IdempotencyKey_companyId_operation_key_key" ON "IdempotencyKey"("companyId", "operation", "key");

CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

CREATE UNIQUE INDEX "LaborContract_companyId_number_key" ON "LaborContract"("companyId", "number");

CREATE INDEX "JournalEntry_companyId_occurredAt_idx" ON "JournalEntry"("companyId", "occurredAt");

CREATE INDEX "JournalEntry_companyId_projectId_idx" ON "JournalEntry"("companyId", "projectId");

CREATE UNIQUE INDEX "JournalEntry_companyId_source_sourceId_debitAccountId_credi_key" ON "JournalEntry"("companyId", "source", "sourceId", "debitAccountId", "creditAccountId");

CREATE UNIQUE INDEX "ServiceInvoice_companyId_number_key" ON "ServiceInvoice"("companyId", "number");

CREATE UNIQUE INDEX "GoodsSale_companyId_number_key" ON "GoodsSale"("companyId", "number");

CREATE UNIQUE INDEX "Receivable_invoiceId_key" ON "Receivable"("invoiceId");

CREATE UNIQUE INDEX "Payable_measurementId_key" ON "Payable"("measurementId");

CREATE UNIQUE INDEX "BankStatement_companyId_fileHash_key" ON "BankStatement"("companyId", "fileHash");

CREATE UNIQUE INDEX "BankTransaction_statementId_externalId_key" ON "BankTransaction"("statementId", "externalId");

CREATE INDEX "TaxBracket_companyId_annex_effectiveFrom_idx" ON "TaxBracket"("companyId", "annex", "effectiveFrom");

CREATE UNIQUE INDEX "MonthlyTask_companyId_month_title_key" ON "MonthlyTask"("companyId", "month", "title");

ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Partner" ADD CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LaborContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsSale" ADD CONSTRAINT "GoodsSale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ServiceInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "LaborContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaxBracket" ADD CONSTRAINT "TaxBracket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MonthlyTask" ADD CONSTRAINT "MonthlyTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_positive_amount" CHECK ("amount" > 0);

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_distinct_accounts" CHECK ("debitAccountId" <> "creditAccountId");

ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_positive_amount" CHECK ("amount" > 0 AND "issAmount" >= 0 AND "inssAmount" >= 0 AND "issAmount" + "inssAmount" < "amount");

ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_positive_amount" CHECK ("amount" > 0 AND "issAmount" >= 0 AND "inssAmount" >= 0 AND "issAmount" + "inssAmount" < "amount");

ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_positive_amount" CHECK ("amount" > 0 AND "issAmount" >= 0 AND "inssAmount" >= 0 AND "issAmount" + "inssAmount" < "amount");

ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_balance" CHECK ("amount" > 0 AND "received" >= 0 AND "received" <= "amount");

ALTER TABLE "Payable" ADD CONSTRAINT "Payable_positive_amount" CHECK ("amount" > 0);
