ALTER TYPE "EntrySource" ADD VALUE 'RENTAL_CHARGE';
ALTER TYPE "EntrySource" ADD VALUE 'RENTAL_PAYMENT';
CREATE TYPE "RentalDocumentKind" AS ENUM ('NFSE', 'INVOICE', 'RENTAL_RECEIPT', 'OTHER');

CREATE UNIQUE INDEX "Project_companyId_id_key" ON "Project"("companyId", "id");
CREATE UNIQUE INDEX "Partner_companyId_id_key" ON "Partner"("companyId", "id");

CREATE TABLE "EquipmentRental" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "number" VARCHAR(80) NOT NULL,
  "equipmentName" VARCHAR(160) NOT NULL,
  "equipmentIdentifier" VARCHAR(120) NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "startsAt" DATE NOT NULL,
  "expectedReturnAt" DATE,
  "returnedAt" DATE,
  "notes" VARCHAR(2000) NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EquipmentRental_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipmentRental_quantity_check" CHECK ("quantity" BETWEEN 1 AND 9999),
  CONSTRAINT "EquipmentRental_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "EquipmentRental_dates_check" CHECK (("expectedReturnAt" IS NULL OR "expectedReturnAt" >= "startsAt") AND ("returnedAt" IS NULL OR "returnedAt" >= "startsAt")),
  CONSTRAINT "EquipmentRental_number_check" CHECK (length(trim("number")) > 0 AND length(trim("equipmentName")) > 0)
);
CREATE UNIQUE INDEX "EquipmentRental_companyId_id_key" ON "EquipmentRental"("companyId", "id");
CREATE UNIQUE INDEX "EquipmentRental_companyId_number_key" ON "EquipmentRental"("companyId", "number");
CREATE INDEX "EquipmentRental_companyId_projectId_startsAt_idx" ON "EquipmentRental"("companyId", "projectId", "startsAt");

CREATE TABLE "RentalCharge" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "rentalId" UUID NOT NULL,
  "documentKind" "RentalDocumentKind" NOT NULL,
  "documentNumber" VARCHAR(80) NOT NULL,
  "issuedAt" DATE NOT NULL,
  "dueAt" DATE NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "documentUrl" VARCHAR(2000) NOT NULL DEFAULT '',
  "notes" VARCHAR(2000) NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalCharge_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "RentalCharge_dates_check" CHECK ("dueAt" >= "issuedAt"),
  CONSTRAINT "RentalCharge_number_check" CHECK (length(trim("documentNumber")) > 0)
);
CREATE UNIQUE INDEX "RentalCharge_companyId_id_key" ON "RentalCharge"("companyId", "id");
CREATE UNIQUE INDEX "RentalCharge_companyId_rentalId_documentKind_documentNumber_key" ON "RentalCharge"("companyId", "rentalId", "documentKind", "documentNumber");
CREATE INDEX "RentalCharge_companyId_rentalId_issuedAt_idx" ON "RentalCharge"("companyId", "rentalId", "issuedAt");

CREATE TABLE "RentalChargeFile" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "rentalChargeId" UUID NOT NULL,
  "fileName" VARCHAR(180) NOT NULL,
  "mediaType" VARCHAR(80) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "contentEncrypted" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalChargeFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalChargeFile_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 2097152)
);
CREATE INDEX "RentalChargeFile_companyId_rentalChargeId_idx" ON "RentalChargeFile"("companyId", "rentalChargeId");

ALTER TABLE "EquipmentRental" ADD CONSTRAINT "EquipmentRental_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentRental" ADD CONSTRAINT "EquipmentRental_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "Project"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentRental" ADD CONSTRAINT "EquipmentRental_companyId_supplierId_fkey" FOREIGN KEY ("companyId", "supplierId") REFERENCES "Partner"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "EquipmentRental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalChargeFile" ADD CONSTRAINT "RentalChargeFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalChargeFile" ADD CONSTRAINT "RentalChargeFile_companyId_rentalChargeId_fkey" FOREIGN KEY ("companyId", "rentalChargeId") REFERENCES "RentalCharge"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payable" ALTER COLUMN "contractId" DROP NOT NULL;
ALTER TABLE "Payable" ADD COLUMN "rentalChargeId" UUID;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_single_origin_check" CHECK (("contractId" IS NOT NULL)::int + ("rentalChargeId" IS NOT NULL)::int = 1);
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_measurement_origin_check" CHECK ("measurementId" IS NULL OR "contractId" IS NOT NULL);
CREATE UNIQUE INDEX "Payable_companyId_rentalChargeId_key" ON "Payable"("companyId", "rentalChargeId");
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_rentalChargeId_fkey" FOREIGN KEY ("companyId", "rentalChargeId") REFERENCES "RentalCharge"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Account" ("id", "companyId", "code", "name", "type", "active")
SELECT gen_random_uuid(), "id", '5.1.03', 'Equipment rental cost', 'COST'::"AccountType", true FROM "Company"
ON CONFLICT ("companyId", "code") DO NOTHING;
INSERT INTO "Account" ("id", "companyId", "code", "name", "type", "active")
SELECT gen_random_uuid(), "id", '2.1.01', 'Suppliers payable', 'LIABILITY'::"AccountType", true FROM "Company"
ON CONFLICT ("companyId", "code") DO NOTHING;
