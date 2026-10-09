import type { ReportDefinition, ReportElement, ReportTemplateInput } from "./schema";
import { reportSources } from "./sources";

export const reportPresets = [
  { id: "blank", label: "Documento livre", description: "Comece com uma folha e organize seus próprios campos." },
  { id: "fuel", label: "Ficha de abastecimento", description: "Veículo, combustível, medição e espaços para preenchimento e assinatura." },
  { id: "inventory", label: "Posição de estoque", description: "Produtos, unidades, saldos e estoque mínimo da empresa." },
  { id: "receivables", label: "Contas a receber", description: "Clientes, vencimentos e saldos em aberto." },
];

export function createReportElement(type: ReportElement["type"], overrides: Partial<ReportElement> = {}): ReportElement {
  return { id: crypto.randomUUID(), type, x: 16, y: 48, width: 80, height: type === "line" ? 1 : 14, text: type === "text" ? "Novo texto" : type === "signature" ? "Assinatura" : "", binding: "company.name", fontSize: 11, bold: false, align: "left", border: type === "box", lineCount: 3, columns: [], ...(type === "image" ? { width: 50, height: 30 } : {}), ...(type === "manualTable" ? { width: 178, height: 60, fontSize: 10, lineCount: 5, columns: [1, 2, 3].map((index) => ({ key: `column_${index}`, label: `Coluna ${index}`, width: 2 })) } : {}), ...overrides };
}

export function createReportPreset(id: string): ReportTemplateInput {
  const definition: ReportDefinition = { version: 1, source: "manual", page: { size: "A4", orientation: "portrait", margin: 12 }, inputs: [], elements: [
    createReportElement("field", { x: 16, y: 16, width: 150, height: 12, binding: "company.name", bold: true, fontSize: 12 }),
    createReportElement("text", { x: 16, y: 31, width: 178, height: 14, text: "Meu documento", fontSize: 20, bold: true }),
  ] };
  let name = "Meu documento";
  let description = "";
  if (id === "fuel") {
    name = "Ficha de abastecimento";
    description = "Controle de abastecimento com preenchimento digital ou manual.";
    definition.elements[1].text = name;
    definition.inputs = [
      { id: "date", label: "Data", type: "date" }, { id: "vehicle", label: "Veículo / equipamento", type: "text" },
      { id: "plate", label: "Placa / identificação", type: "text" }, { id: "driver", label: "Responsável", type: "text" },
      { id: "fuel", label: "Combustível", type: "text" }, { id: "quantity", label: "Quantidade (litros)", type: "number" },
      { id: "meter", label: "Hodômetro / horímetro", type: "text" }, { id: "location", label: "Obra / local", type: "text" },
    ];
    definition.inputs.forEach((input, index) => {
      const x = index % 2 ? 110 : 16;
      const y = 56 + Math.floor(index / 2) * 31;
      definition.elements.push(createReportElement("text", { x, y, width: 84, height: 7, text: input.label, fontSize: 10, bold: true }));
      definition.elements.push(createReportElement("field", { x, y: y + 8, width: 84, height: 14, binding: `input.${input.id}`, border: true }));
    });
    definition.elements.push(createReportElement("text", { x: 16, y: 190, width: 178, height: 8, text: "Observações", bold: true }));
    definition.elements.push(createReportElement("blank", { x: 16, y: 201, width: 178, height: 32, lineCount: 4 }));
    definition.elements.push(createReportElement("signature", { x: 16, y: 253, width: 80, height: 20, text: "Responsável pelo abastecimento", align: "center", fontSize: 10 }));
    definition.elements.push(createReportElement("signature", { x: 114, y: 253, width: 80, height: 20, text: "Conferência / autorização", align: "center", fontSize: 10 }));
  } else if (id === "inventory" || id === "receivables") {
    definition.source = id;
    name = id === "inventory" ? "Posição de estoque" : "Contas a receber";
    description = "Relatório vinculado aos dados atuais da empresa.";
    definition.elements[1].text = name;
    const keys = id === "inventory" ? ["sku", "name", "unit", "quantity", "minimumQuantity"] : ["customer", "invoiceNumber", "dueAt", "remaining"];
    const fields = reportSources.find((source) => source.id === id)?.fields ?? [];
    definition.elements.push(createReportElement("table", { x: 16, y: 55, width: 178, height: 203, fontSize: 9, columns: keys.map((key) => ({ key, label: fields.find((field) => field.key === key)?.label ?? key, width: key === "name" || key === "customer" ? 3 : 2 })) }));
    definition.elements.push(createReportElement("field", { x: 16, y: 268, width: 75, height: 8, binding: "system.date", fontSize: 9 }));
    definition.elements.push(createReportElement("field", { x: 164, y: 268, width: 30, height: 8, binding: "system.page", fontSize: 9, align: "right" }));
  }
  return { name, description, active: true, definition };
}
