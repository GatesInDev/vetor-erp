type PayableOriginSource = {
  contract: { number: string } | null;
  rentalCharge: { documentNumber: string; rental: { number: string; equipmentName: string } } | null;
};

export function payableOriginFields(source: PayableOriginSource): Record<string, string> {
  return {
    originType: source.rentalCharge ? "Locação" : "Contrato",
    originNumber: source.rentalCharge?.rental.number ?? source.contract?.number ?? "",
    contractNumber: source.contract?.number ?? "",
    rentalNumber: source.rentalCharge?.rental.number ?? "",
    documentNumber: source.rentalCharge?.documentNumber ?? "",
    equipmentName: source.rentalCharge?.rental.equipmentName ?? "",
  };
}
