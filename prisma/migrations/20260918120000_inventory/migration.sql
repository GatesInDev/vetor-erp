CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'EXIT');

CREATE TABLE "InventoryProduct" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minimumQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryProduct_quantity_nonnegative" CHECK ("quantity" >= 0),
    CONSTRAINT "InventoryProduct_minimumQuantity_nonnegative" CHECK ("minimumQuantity" >= 0)
);

CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "projectId" UUID,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockMovement_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "StockMovement_exit_project_required" CHECK ("type" <> 'EXIT' OR "projectId" IS NOT NULL)
);

CREATE UNIQUE INDEX "InventoryProduct_companyId_sku_key" ON "InventoryProduct"("companyId", "sku");
CREATE INDEX "InventoryProduct_companyId_name_idx" ON "InventoryProduct"("companyId", "name");
CREATE INDEX "StockMovement_companyId_createdAt_idx" ON "StockMovement"("companyId", "createdAt");
CREATE INDEX "StockMovement_companyId_productId_idx" ON "StockMovement"("companyId", "productId");

ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
