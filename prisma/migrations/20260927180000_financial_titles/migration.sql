CREATE TYPE "FinancialTitleKind" AS ENUM ('BOLETO', 'DUPLICATE', 'PROMISSORY_NOTE', 'OTHER');

CREATE UNIQUE INDEX "Payable_companyId_id_key" ON "Payable"("companyId", "id");
CREATE UNIQUE INDEX "Receivable_companyId_id_key" ON "Receivable"("companyId", "id");

CREATE TABLE "FinancialTitle" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payableId" UUID,
    "receivableId" UUID,
    "kind" "FinancialTitleKind" NOT NULL DEFAULT 'BOLETO',
    "number" VARCHAR(80) NOT NULL,
    "bankName" VARCHAR(120) NOT NULL DEFAULT '',
    "digitLine" VARCHAR(48) NOT NULL DEFAULT '',
    "barcode" VARCHAR(44) NOT NULL DEFAULT '',
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialTitle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialTitle_single_account_check" CHECK (("payableId" IS NOT NULL)::int + ("receivableId" IS NOT NULL)::int = 1),
    CONSTRAINT "FinancialTitle_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "FinancialTitle_number_check" CHECK (length(trim("number")) > 0),
    CONSTRAINT "FinancialTitle_digitLine_check" CHECK ("digitLine" = '' OR "digitLine" ~ '^[0-9]{47,48}$'),
    CONSTRAINT "FinancialTitle_barcode_check" CHECK ("barcode" = '' OR "barcode" ~ '^[0-9]{44}$')
);

CREATE UNIQUE INDEX "FinancialTitle_companyId_payableId_key" ON "FinancialTitle"("companyId", "payableId");
CREATE UNIQUE INDEX "FinancialTitle_companyId_receivableId_key" ON "FinancialTitle"("companyId", "receivableId");
CREATE INDEX "FinancialTitle_companyId_updatedAt_idx" ON "FinancialTitle"("companyId", "updatedAt");

ALTER TABLE "FinancialTitle" ADD CONSTRAINT "FinancialTitle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTitle" ADD CONSTRAINT "FinancialTitle_companyId_payableId_fkey" FOREIGN KEY ("companyId", "payableId") REFERENCES "Payable"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialTitle" ADD CONSTRAINT "FinancialTitle_companyId_receivableId_fkey" FOREIGN KEY ("companyId", "receivableId") REFERENCES "Receivable"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
