CREATE TABLE "MailConnection" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "username" VARCHAR(254) NOT NULL,
  "passwordEncrypted" TEXT NOT NULL,
  "folder" VARCHAR(200) NOT NULL DEFAULT 'INBOX',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "autoSync" BOOLEAN NOT NULL DEFAULT false,
  "importSince" DATE NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "mailboxVersion" UUID NOT NULL,
  "uidValidity" VARCHAR(40),
  "cursorUid" BIGINT NOT NULL DEFAULT 0,
  "syncToken" UUID,
  "syncUntil" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncAttemptAt" TIMESTAMP(3),
  "lastSyncError" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MailConnection_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "MailConnection_cursor_check" CHECK ("cursorUid" BETWEEN 0 AND 4294967295),
  CONSTRAINT "MailConnection_lease_check" CHECK (("syncToken" IS NULL) = ("syncUntil" IS NULL))
);
CREATE UNIQUE INDEX "MailConnection_companyId_key" ON "MailConnection"("companyId");
CREATE INDEX "MailConnection_enabled_autoSync_lastSyncAttemptAt_idx" ON "MailConnection"("enabled", "autoSync", "lastSyncAttemptAt");
ALTER TABLE "MailConnection" ADD CONSTRAINT "MailConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MailMessage" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "mailboxVersion" UUID NOT NULL,
  "uidValidity" VARCHAR(40) NOT NULL,
  "uid" BIGINT NOT NULL,
  "messageId" VARCHAR(500),
  "subject" VARCHAR(500) NOT NULL,
  "from" VARCHAR(1000) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "bodyTextEncrypted" TEXT NOT NULL,
  "warnings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MailMessage_uid_check" CHECK ("uid" BETWEEN 1 AND 4294967295)
);
CREATE UNIQUE INDEX "MailMessage_companyId_id_key" ON "MailMessage"("companyId", "id");
CREATE UNIQUE INDEX "MailMessage_companyId_mailboxVersion_uidValidity_uid_key" ON "MailMessage"("companyId", "mailboxVersion", "uidValidity", "uid");
CREATE INDEX "MailMessage_companyId_receivedAt_id_idx" ON "MailMessage"("companyId", "receivedAt", "id");
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MailAttachment" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "partId" VARCHAR(80) NOT NULL,
  "fileName" VARCHAR(180) NOT NULL,
  "mediaType" VARCHAR(80) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "contentEncrypted" TEXT NOT NULL,
  "rentalChargeId" UUID,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MailAttachment_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 2097152),
  CONSTRAINT "MailAttachment_type_check" CHECK ("mediaType" IN ('application/xml', 'application/pdf')),
  CONSTRAINT "MailAttachment_import_check" CHECK (("rentalChargeId" IS NULL) = ("importedAt" IS NULL))
);
CREATE UNIQUE INDEX "MailAttachment_companyId_messageId_partId_key" ON "MailAttachment"("companyId", "messageId", "partId");
CREATE UNIQUE INDEX "MailAttachment_companyId_messageId_contentHash_key" ON "MailAttachment"("companyId", "messageId", "contentHash");
CREATE INDEX "MailAttachment_companyId_rentalChargeId_idx" ON "MailAttachment"("companyId", "rentalChargeId");
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_companyId_messageId_fkey" FOREIGN KEY ("companyId", "messageId") REFERENCES "MailMessage"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_companyId_rentalChargeId_fkey" FOREIGN KEY ("companyId", "rentalChargeId") REFERENCES "RentalCharge"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
