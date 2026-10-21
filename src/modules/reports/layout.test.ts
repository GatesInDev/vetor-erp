import test from "node:test";
import assert from "node:assert/strict";
import { createReportElement, createReportPreset, reportPresets } from "./presets";
import { pageDimensions, reportDefinitionSchema, reportTemplateInputSchema } from "./schema";
import { fitElement, paginateReport, resolveField, resolveText, wrapCell, type ReportValues } from "./layout";
import { manualTableFits, manualTableLayout, manualTableMinimumWidth } from "./table-layout";
import { insertTextBinding, removeTextBinding, replaceTextBindings, textBindings } from "./text-template";

const values: ReportValues = { company: { name: "Example" }, generatedAt: "2026-09-26T15:00:00Z", rows: [{}], truncated: false };

test("all starter templates satisfy the stored schema and printable bounds", () => {
  for (const preset of reportPresets) assert.ok(reportTemplateInputSchema.safeParse(createReportPreset(preset.id)).success, preset.id);
});

test("report definitions reject unknown fields, prototype inputs and duplicate elements", () => {
  const definition = createReportPreset("fuel").definition;
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, inputs: [{ id: "constructor", label: "Bad", type: "text" }] }).success, false);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [...definition.elements, definition.elements[0]] }).success, false);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [createReportElement("field", { binding: "row.passwordHash" })] }).success, false);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [createReportElement("text", { x: -1 })] }).success, false);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [createReportElement("text", { y: 285, height: 25 })] }).success, false);
});

test("only one repeating table is allowed and its columns must match the data source", () => {
  const definition = createReportPreset("inventory").definition;
  const table = definition.elements.find((element) => element.type === "table")!;
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [table, { ...table, id: crypto.randomUUID() }] }).success, false);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [{ ...table, columns: [{ key: "passwordHash", label: "Bad", width: 2 }] }] }).success, false);
});

test("pagination preserves every record and keeps repeated headers within the table height", () => {
  const definition = createReportPreset("inventory").definition;
  const table = definition.elements.find((element) => element.type === "table")!;
  table.height = 70;
  const rows = Array.from({ length: 37 }, (_, index) => ({ sku: `SKU-${index}`, name: "Material de aplicação com descrição longa para quebrar em linhas", unit: "UN", quantity: String(index), minimumQuantity: "1" }));
  const pages = paginateReport(definition, { ...values, rows });
  assert.ok(pages.length > 1);
  assert.equal(pages.flatMap((page) => page.rows).length, rows.length);
  for (const page of pages) {
    assert.ok(page.headers);
    assert.ok(page.headers.height + page.rows.reduce((sum, row) => sum + row.height, 0) <= table.height);
  }
  assert.deepEqual(pages.flatMap((page) => page.rows.map((row) => row.cells[0].join(""))), rows.map((row) => row.sku));
});

test("oversized rows and excessive page counts fail explicitly", () => {
  const definition = createReportPreset("inventory").definition;
  assert.throws(() => paginateReport(definition, { ...values, rows: [{ name: "long ".repeat(4000) }] }), /linha não cabe/);
  assert.throws(() => paginateReport(createReportPreset("blank").definition, { ...values, rows: Array.from({ length: 101 }, () => ({})) }), /100 páginas/);
});

test("manual forms, empty queries and safe field substitution are deterministic", () => {
  const definition = createReportPreset("fuel").definition;
  assert.equal(paginateReport(definition, values).length, 1);
  assert.equal(paginateReport(definition, { ...values, rows: [] }).length, 1);
  assert.equal(resolveField("company.name", values, {}, {}, 1, 2), "Example");
  assert.equal(resolveField("system.page", values, {}, {}, 1, 2), "1");
  assert.equal(resolveField("input.vehicle", values, {}, { vehicle: "Truck" }, 1, 1), "Truck");
  assert.equal(resolveField("row.constructor", values, {}, {}, 1, 1), "");
  assert.equal(resolveField("input.toString", values, {}, {}, 1, 1), "");
});

test("resizing and orientation changes keep elements inside the printable page", () => {
  const bounds = pageDimensions({ size: "A4", orientation: "landscape" });
  const element = fitElement(createReportElement("text", { x: 290, y: 270, width: 300, height: 300 }), bounds.width, bounds.height, 12);
  assert.equal(element.x, 12);
  assert.equal(element.y, 12);
  assert.equal(element.width, 273);
  assert.equal(element.height, 186);
  assert.equal(fitElement({ ...element, width: -1, height: -2 }, 210, 297, 12).width, 2);
});

test("long tokens and explicit line breaks wrap without overflowing the column", () => {
  const lines = wrapCell("ABCDEFGHIJK\nword phrase", 4);
  assert.ok(lines.every((line) => line.length <= 4));
  assert.equal(lines.join("").replaceAll(" ", ""), "ABCDEFGHIJKwordphrase");
  assert.throws(() => wrapCell("value", 0));
});

test("manual tables accept independent columns and multiple tables with any source", () => {
  for (const preset of ["blank", "inventory"]) {
    const definition = createReportPreset(preset).definition;
    definition.elements.push(createReportElement("manualTable", { columns: [{ key: "driver", label: "Driver signature", width: 2 }] }));
    definition.elements.push(createReportElement("manualTable", { y: 120 }));
    assert.ok(reportDefinitionSchema.safeParse(definition).success, preset);
  }
});

test("manual table validation rejects missing columns, excessive rows and clipped headings", () => {
  const definition = createReportPreset("blank").definition;
  const table = createReportElement("manualTable");
  const invalidTables = [
    { ...table, columns: [] },
    { ...table, columns: Array.from({ length: 9 }, (_, index) => ({ key: `column_${index}`, label: "Column", width: 1 })) },
    { ...table, lineCount: 0 },
    { ...table, lineCount: 16 },
    { ...table, lineCount: 1.5 },
    { ...table, fontSize: 17 },
    { ...table, height: 20 },
    { ...table, width: 24 },
    { ...table, columns: table.columns.map((column, index) => ({ ...column, width: index ? 20 : 1 })) },
    { ...table, width: 36, columns: table.columns.map((column) => ({ ...column, label: "Long heading ".repeat(6) })) },
  ];
  for (const element of invalidTables) assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [element] }).success, false);
  assert.throws(() => paginateReport({ ...definition, elements: [{ ...table, height: 20 }] }, values), /8 mm/);
});

test("adding blank tables preserves the records and pagination of an existing data table", () => {
  const definition = createReportPreset("inventory").definition;
  const data = { ...values, rows: Array.from({ length: 50 }, (_, index) => ({ sku: `SKU-${index}`, name: "Product", quantity: String(index) })) };
  const expected = paginateReport(definition, data);
  const actual = paginateReport({ ...definition, elements: [...definition.elements, createReportElement("manualTable"), createReportElement("manualTable")] }, data);
  assert.deepEqual(actual, expected);
  const manualDefinition = { ...createReportPreset("blank").definition, elements: [createReportElement("manualTable")] };
  assert.equal(paginateReport(manualDefinition, { ...values, rows: [] }).length, 1);
  assert.equal(paginateReport(manualDefinition, { ...values, rows: [{}, {}, {}] }).length, 3);
});

test("manual tables keep writing space and wrapped headings inside the printable area", () => {
  const element = createReportElement("manualTable", { width: 5, height: 5, lineCount: 15, y: 250, columns: [{ key: "date", label: "Date", width: 1 }, { key: "notes", label: "Notes and verification", width: 3 }] });
  const fitted = fitElement(element, 297, 210, 12);
  const layout = manualTableLayout(fitted);
  assert.equal(fitted.width, manualTableMinimumWidth(element));
  assert.ok(manualTableFits(fitted));
  assert.ok(layout.rowHeight >= 8);
  assert.ok(Math.abs(layout.headers.height + fitted.lineCount * layout.rowHeight - fitted.height) < 0.01);
  assert.ok(fitted.y >= 12 && fitted.y + fitted.height <= 198);
  assert.ok(layout.headers.cells[1].length > 1);
  assert.ok(reportDefinitionSchema.safeParse({ ...createReportPreset("blank").definition, page: { size: "A4", orientation: "landscape", margin: 12 }, elements: [fitted] }).success);
});

test("inline variables resolve repeated values in prose with the same formatting as fields", () => {
  const text = "I, {{ input.driver }}, confirm {{row.quantity}} for {{company.name}}.\nSigned: {{input.driver}} on {{system.date}} ({{system.page}}/{{system.pages}}).";
  assert.deepEqual(textBindings(text), ["input.driver", "row.quantity", "company.name", "system.date", "system.page", "system.pages"]);
  assert.equal(resolveText(text, values, { quantity: "12,50" }, { driver: "Alex" }, 2, 4), "I, Alex, confirm 12,50 for Example.\nSigned: Alex on 26/09/2026 (2/4).");
  assert.equal(resolveText("Signed: {{input.driver}} / {{row.name}}.", values, {}, {}, 1, 1), "Signed:  / .");
  assert.equal(resolveText("{{input.toString}}{{row.constructor}}", values, {}, {}, 1, 1), "");
});

test("inline replacement treats values as literal text without recursive or HTML evaluation", () => {
  const text = "Statement: {{input.statement}}.";
  const statement = '<script>alert("example")</script> {{company.name}} $&';
  assert.equal(resolveText(text, values, {}, { statement }, 1, 1), `Statement: ${statement}.`);
  assert.equal(replaceTextBindings("Before {{input.value}} after", () => "{{input.other}}"), "Before {{input.other}} after");
});

test("malformed braces remain literal while complete tokens are recognized consistently", () => {
  const text = "{input.driver} {{input.driver {{{input.driver}}} {{input.\ndriver}}";
  assert.deepEqual(textBindings(text), []);
  assert.equal(replaceTextBindings(text, () => "Alex"), text);
  assert.deepEqual(textBindings("{{}} {{ input.unknown }}"), ["", "input.unknown"]);
});

test("text and signature templates validate inline variables against their input and source fields", () => {
  const definition = createReportPreset("fuel").definition;
  for (const type of ["text", "signature"] as const) {
    const element = createReportElement(type, { text: "Signed by {{ input.driver }} for {{company.name}} on {{system.date}}, page {{system.page}}/{{system.pages}}." });
    assert.ok(reportDefinitionSchema.safeParse({ ...definition, elements: [element] }).success);
    for (const binding of ["input.missing", "input.constructor", "input.__proto__", "input.prototype", "row.passwordHash", "company.password", "system.unknown", "", "input.driver.toString"]) {
      const result = reportDefinitionSchema.safeParse({ ...definition, elements: [{ ...element, text: `Before {{${binding}}} after` }] });
      assert.equal(result.success, false, binding);
      if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path.join(".") === "elements.0.text"));
    }
  }
  const inventory = createReportPreset("inventory").definition;
  const element = createReportElement("text", { text: "Product: {{row.name}} / {{row.sku}}" });
  assert.ok(reportDefinitionSchema.safeParse({ ...inventory, elements: [element] }).success);
  assert.equal(reportDefinitionSchema.safeParse({ ...definition, elements: [element] }).success, false);
});

test("renaming an input label preserves inline links and removing a link preserves prose", () => {
  const definition = createReportPreset("fuel").definition;
  definition.inputs = definition.inputs.map((input) => input.id === "driver" ? { ...input, label: "Authorized signatory" } : input);
  const text = "I, {{input.driver}}, sign for {{ company.name }}.\n{{ input.driver }} / {{input.vehicle}}";
  definition.elements = [createReportElement("signature", { text })];
  assert.ok(reportDefinitionSchema.safeParse(definition).success);
  assert.equal(resolveText(text, values, {}, { driver: "Alex", vehicle: "Truck" }, 1, 1), "I, Alex, sign for Example.\nAlex / Truck");
  const remaining = removeTextBinding(text, "input.driver");
  assert.equal(remaining, "I, , sign for {{ company.name }}.\n / {{input.vehicle}}");
  assert.equal(removeTextBinding(remaining, "input.driver"), remaining);
  assert.ok(reportDefinitionSchema.safeParse({ ...definition, inputs: definition.inputs.filter((input) => input.id !== "driver"), elements: [{ ...definition.elements[0], text: remaining }] }).success);
});

test("inline insertion replaces the selected range or inserts at the caret and respects text limits", () => {
  assert.deepEqual(insertTextBinding("Hello , welcome.", "input.driver", 6, 6), { text: "Hello {{input.driver}}, welcome.", caret: 22 });
  assert.deepEqual(insertTextBinding("Hello NAME, welcome.", "input.driver", 6, 10), { text: "Hello {{input.driver}}, welcome.", caret: 22 });
  assert.deepEqual(insertTextBinding("", "company.name", 0, 0), { text: "{{company.name}}", caret: 16 });
  assert.equal(insertTextBinding("x".repeat(1985), "company.name", 1985, 1985), null);
  assert.equal(insertTextBinding("x".repeat(1984), "company.name", 1984, 1984)?.text.length, 2000);
  assert.equal(insertTextBinding("x".repeat(2000), "company.name", 0, 16)?.text.length, 2000);
  assert.deepEqual(insertTextBinding("Replace me", "company.name", -2, 90), { text: "{{company.name}}", caret: 16 });
});
