export type InventoryProductSummary = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  minimumQuantity: string;
  quantity: string;
  active: boolean;
};

export type StockMovementSummary = {
  id: string;
  type: "ENTRY" | "EXIT";
  quantity: string;
  reason: string;
  createdAt: string;
  product: { id: string; sku: string; name: string; unit: string };
  project: { id: string; code: string; name: string } | null;
};
