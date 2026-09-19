export type ProjectSummary = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type PartnerSummary = {
  id: string;
  name: string;
  customer: boolean;
  supplier: boolean;
  hasTaxId: boolean;
};
