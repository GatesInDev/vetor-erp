"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Grip, Save } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { PageHeader } from "@/components/ui/page-header";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { createReportElement } from "../presets";
import { fitElement } from "../layout";
import { manualTableFits } from "../table-layout";
import { MAX_REPORT_IMAGES_BYTES, reportImageBytes, validateReportImage } from "../images";
import { elementTypeSchema, pageDimensions, reportTemplateInputSchema, type ReportDefinition, type ReportElement, type ReportTemplate, type ReportTemplateInput } from "../schema";
import { reportSources } from "../sources";
import { removeTextBinding, textBindings } from "../text-template";
import { elementStyle, ReportElementContent } from "./report-page";
import { ElementProperties } from "./element-properties";
import { ReportPreview } from "./report-preview";

const elementLabels: Record<ReportElement["type"], string> = { text: "Texto livre", field: "Campo de dados", line: "Linha", box: "Retângulo", blank: "Espaço pautado", signature: "Assinatura", table: "Tabela de registros", manualTable: "Tabela para preenchimento", image: "Imagem / logo" };
type Gesture = { id: string; startX: number; startY: number; pixelsPerMm: number; original: ReportElement; resize: boolean };

export function ReportEditor({ initial, template }: { initial: ReportTemplateInput; template?: ReportTemplate }) {
  const { t, formatNumber } = useLocale();
  const draft = useFormDraft(initial, { title: template ? `${t("Editar")}: ${template.name}` : t("Novo relatório") });
  const { values, setValues } = draft;
  const definition = values.definition;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"design" | "preview">("design");
  const [zoom, setZoom] = useState(75);
  const [imageLoading, setImageLoading] = useState(false);
  const paper = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const selected = definition.elements.find((element) => element.id === selectedId);
  const source = reportSources.find((item) => item.id === definition.source)!;
  const size = pageDimensions(definition.page);

  function changeDefinition(update: (previous: ReportDefinition) => ReportDefinition) {
    setValues((previous) => ({ ...previous, definition: update(previous.definition) }));
  }

  function changeElement(id: string, patch: Partial<ReportElement>) {
    changeDefinition((previous) => {
      const bounds = pageDimensions(previous.page);
      return { ...previous, elements: previous.elements.map((element) => element.id === id ? fitElement({ ...element, ...patch }, bounds.width, bounds.height, previous.page.margin) : element) };
    });
  }

  function addElement(type: ReportElement["type"], position?: { x: number; y: number }, binding?: string) {
    if (definition.elements.length >= 80 || (type === "table" && (!source.fields.length || definition.elements.some((element) => element.type === "table")))) return;
    const element = fitElement(createReportElement(type, {
      ...position, ...(binding ? { binding } : {}),
      ...(type === "table" ? { width: size.width - definition.page.margin * 2, height: 90, fontSize: 9, columns: source.fields.slice(0, 4).map((field) => ({ ...field, width: 2 })) } : {}),
      ...(type === "manualTable" ? { columns: [1, 2, 3].map((index) => ({ key: `column_${index}`, label: `${t("Coluna")} ${index}`, width: 2 })) } : {}),
    }), size.width, size.height, definition.page.margin);
    changeDefinition((previous) => ({ ...previous, elements: [...previous.elements, element] }));
    setSelectedId(element.id);
  }

  function beginGesture(event: PointerEvent<HTMLDivElement>, element: ReportElement, resize: boolean) {
    if (event.button !== 0 || !paper.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: element.id, startX: event.clientX, startY: event.clientY, pixelsPerMm: paper.current.getBoundingClientRect().width / size.width, original: element, resize };
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current) return;
    const dx = Math.round((event.clientX - current.startX) / current.pixelsPerMm);
    const dy = Math.round((event.clientY - current.startY) / current.pixelsPerMm);
    changeElement(current.id, current.resize ? { width: Math.max(2, current.original.width + dx), height: Math.max(current.original.type === "table" ? 25 : 1, current.original.height + dy) } : { x: current.original.x + dx, y: current.original.y + dy });
  }

  function changePage(patch: Partial<ReportDefinition["page"]>) {
    changeDefinition((previous) => { const page = { ...previous.page, ...patch }; const bounds = pageDimensions(page); return { ...previous, page, elements: previous.elements.map((element) => fitElement(element, bounds.width, bounds.height, page.margin)) }; });
  }

  function changeSource(sourceId: ReportDefinition["source"]) {
    const next = reportSources.find((item) => item.id === sourceId)!;
    const available = new Set(next.fields.map((field) => `row.${field.key}`));
    changeDefinition((previous) => ({
      ...previous, source: next.id,
      elements: previous.elements.filter((element) => element.type !== "table" || next.fields.length).map((element) => {
        if (element.type === "table") return { ...element, columns: next.fields.slice(0, 4).map((field) => ({ ...field, width: 2 })) };
        if (element.type === "field" && element.binding.startsWith("row.")) return { ...element, binding: next.fields.length ? `row.${next.fields[0].key}` : "company.name" };
        if (element.type !== "text" && element.type !== "signature") return element;
        const unavailable = textBindings(element.text).filter((binding) => binding.startsWith("row.") && !available.has(binding));
        return { ...element, text: unavailable.reduce(removeTextBinding, element.text) };
      }),
    }));
  }

  function removeInput(id: string) {
    const binding = `input.${id}`;
    changeDefinition((previous) => ({
      ...previous, inputs: previous.inputs.filter((input) => input.id !== id),
      elements: previous.elements.filter((element) => element.type !== "field" || element.binding !== binding)
        .map((element) => element.type === "text" || element.type === "signature" ? { ...element, text: removeTextBinding(element.text, binding) } : element),
    }));
  }

  async function save() {
    if (draft.pending || imageLoading) return;
    if (definition.elements.some((element) => element.type === "image" && !validateReportImage(element.imageData ?? ""))) { draft.setError("Adicione uma imagem a cada elemento de imagem antes de salvar."); return; }
    if (definition.elements.reduce((total, element) => total + (element.imageData ? reportImageBytes(element.imageData) : 0), 0) > MAX_REPORT_IMAGES_BYTES) { draft.setError("As imagens do modelo podem somar no máximo 1 MB."); return; }
    if (definition.elements.some((element) => element.type === "manualTable" && !manualTableFits(element))) { draft.setError("A tabela para preenchimento precisa de colunas com pelo menos 12 mm e linhas com pelo menos 8 mm. Amplie a tabela, reduza as linhas ou ajuste os títulos."); return; }
    const parsed = reportTemplateInputSchema.safeParse(values);
    if (!parsed.success && parsed.error.issues.some((issue) => issue.message === "Unknown inline field binding")) { draft.setError("Há uma variável sem campo vinculado. Remova-a ou insira um campo disponível pelo seletor."); return; }
    if (!parsed.success) { draft.setError("Revise o nome, os campos e as dimensões. Tabelas precisam de colunas, altura mínima de 25 mm e fonte de até 16 pt; todos os elementos devem ficar dentro das margens."); return; }
    draft.setPending(true);
    draft.setError("");
    try {
      await apiRequest(template ? `/api/report-templates/${template.id}` : "/api/report-templates", { method: template ? "PATCH" : "POST", body: { ...parsed.data, ...(template ? { revision: template.revision } : {}) }, idempotencyKey: draft.mutationKey });
      draft.complete("/reports", t("Modelo de relatório salvo. Abra a prévia para preencher e imprimir."));
    } catch (error) { draft.setError(error instanceof Error ? error.message : "Não foi possível salvar o modelo."); }
    finally { draft.setPending(false); }
  }

  return <div className="page-stack report-editor">
    <div className="report-print-hidden"><Link href="/reports" className="text-button"><ArrowLeft size={18} />{t("Modelos de relatório")}</Link>
      <PageHeader eyebrow={t("RELATÓRIOS / EDITOR")} title={t(template ? "Editar modelo" : "Criar modelo")} description={t("Monte o documento no papel, conecte os campos e confira a impressão.")} />
      <div className="report-editor-toolbar"><div className="report-mode-switch" aria-label={t("Modo do editor")}><button type="button" aria-pressed={mode === "design"} onClick={() => setMode("design")}><Grip size={18} />{t("Desenhar")}</button><button type="button" aria-pressed={mode === "preview"} disabled={imageLoading} onClick={() => setMode("preview")}><Eye size={18} />{t("Prévia")}</button></div><button type="button" className="primary-button" disabled={draft.pending || imageLoading} onClick={save}><Save size={18} />{t(draft.pending ? "Salvando…" : "Salvar modelo")}</button></div>
      {imageLoading && <p role="status">{t("Carregando imagem...")}</p>}{draft.error && <p className="form-error" role="alert">{t(draft.error)}</p>}
    </div>
    {mode === "preview" ? <ReportPreview definition={definition} name={values.name} /> : <>
      <details className="island report-settings" open><summary>{t("Identificação e configuração do papel")}</summary><div className="report-settings-grid">
        <label>{t("Nome do modelo")}<input maxLength={120} value={values.name} onChange={(event) => draft.setField("name", event.target.value)} /></label>
        <label>{t("Descrição")}<input maxLength={500} value={values.description} onChange={(event) => draft.setField("description", event.target.value)} /></label>
        <label>{t("Fonte de dados")}<select value={definition.source} onChange={(event) => changeSource(event.target.value as ReportDefinition["source"])}>{reportSources.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label>
        <label>{t("Papel")}<select value={definition.page.size} onChange={(event) => changePage({ size: event.target.value as "A4" | "LETTER" })}><option value="A4">A4</option><option value="LETTER">{t("Carta")}</option></select></label>
        <label>{t("Orientação")}<select value={definition.page.orientation} onChange={(event) => changePage({ orientation: event.target.value as "portrait" | "landscape" })}><option value="portrait">{t("Retrato")}</option><option value="landscape">{t("Paisagem")}</option></select></label>
        <label>{t("Margens (mm)")}<input type="number" min="5" max="30" value={definition.page.margin} onChange={(event) => changePage({ margin: Math.max(5, Math.min(30, Number(event.target.value))) })} /></label>
      </div><p className="report-hint">{t("Ao trocar a fonte, os campos vinculados e a tabela de registros são ajustados. Tabelas para preenchimento mantêm suas colunas. Sem tabela de registros, cada registro gera um documento.")}</p></details>
      <div className="report-designer-grid" inert={imageLoading} aria-busy={imageLoading}>
        <aside className="island report-palette"><h2>{t("Elementos")}</h2><p>{t("Arraste até o papel ou toque para adicionar.")}</p><div className="report-palette-buttons">{elementTypeSchema.options.map((type) => <button key={type} type="button" className="secondary-button" draggable disabled={definition.elements.length >= 80 || (type === "table" && (!source.fields.length || definition.elements.some((element) => element.type === "table")))} onDragStart={(event) => event.dataTransfer.setData("application/x-report-element", type)} onClick={() => addElement(type)}>{t(elementLabels[type])}</button>)}</div>
          <details open><summary>{t("Campos da fonte")}</summary><div className="report-field-list">{[{ key: "company.name", label: "Empresa" }, ...source.fields.map((field) => ({ ...field, key: `row.${field.key}` }))].map((field) => <button type="button" key={field.key} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-report-element", "field"); event.dataTransfer.setData("application/x-report-binding", field.key); }} onClick={() => addElement("field", undefined, field.key)}>{t(field.label)}</button>)}</div></details>
          <details open><summary>{t("Campos para preencher")}</summary><p>{t("Preencha na prévia ou deixe em branco para escrever no papel.")}</p>{definition.inputs.map((input) => <div className="report-input-item" key={input.id}><label>{t("Nome do campo")}<input aria-label={`${t("Nome")}: ${input.label}`} value={input.label} maxLength={80} onChange={(event) => changeDefinition((previous) => ({ ...previous, inputs: previous.inputs.map((item) => item.id === input.id ? { ...item, label: event.target.value } : item) }))} /></label><label>{t("Tipo")}<select value={input.type} onChange={(event) => changeDefinition((previous) => ({ ...previous, inputs: previous.inputs.map((item) => item.id === input.id ? { ...item, type: event.target.value as typeof input.type } : item) }))}><option value="text">{t("Texto")}</option><option value="number">{t("Número")}</option><option value="date">{t("Data")}</option></select></label><div className="inline-actions"><button type="button" className="text-button" onClick={() => addElement("field", undefined, `input.${input.id}`)}>{t("Inserir no papel")}</button><button type="button" className="text-button" onClick={() => removeInput(input.id)}>{t("Remover")}</button></div></div>)}<button type="button" className="secondary-button" disabled={definition.inputs.length >= 30} onClick={() => changeDefinition((previous) => ({ ...previous, inputs: [...previous.inputs, { id: `field_${crypto.randomUUID().slice(0, 8)}`, label: "Novo campo", type: "text" }] }))}>{t("Criar campo")}</button></details>
        </aside>
        <section className="report-canvas-panel"><div className="report-canvas-toolbar"><label>Zoom<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>{[50, 75, 100, 125].map((value) => <option key={value} value={value}>{value}%</option>)}</select></label><span>{formatNumber(size.width)} × {formatNumber(size.height)} mm</span></div><p className="report-hint">{t("Arraste para mover; use a alça inferior para redimensionar. Setas movem 1 mm, Shift + seta move 5 mm.")}</p>
          <div className="report-canvas-scroll"><div style={{ width: `${size.width * zoom / 100}mm`, height: `${size.height * zoom / 100}mm` }}>
            <div ref={paper} className="report-paper report-design-paper" aria-label={t("Papel do relatório")} style={{ width: `${size.width}mm`, height: `${size.height}mm`, transform: `scale(${zoom / 100})`, transformOrigin: "top left" }} onPointerDown={() => setSelectedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const result = elementTypeSchema.safeParse(event.dataTransfer.getData("application/x-report-element")); if (!result.success) return; const bounds = event.currentTarget.getBoundingClientRect(); addElement(result.data, { x: Math.round((event.clientX - bounds.left) / bounds.width * size.width), y: Math.round((event.clientY - bounds.top) / bounds.height * size.height) }, event.dataTransfer.getData("application/x-report-binding") || undefined); }}>
              <div className="report-margin-guide" style={{ inset: `${definition.page.margin}mm` }} />
              {definition.elements.map((element) => <div key={element.id} role="button" tabIndex={0} aria-pressed={selectedId === element.id} aria-label={`${t(elementLabels[element.type])}: ${element.type === "field" ? element.binding : element.text || t(elementLabels[element.type])}`} className={`report-element report-design-element ${selectedId === element.id ? "is-selected" : ""}`} style={elementStyle(element)} onPointerDown={(event) => beginGesture(event, element, false)} onPointerMove={moveGesture} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onFocus={() => setSelectedId(element.id)} onKeyDown={(event) => {
                if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); changeDefinition((previous) => ({ ...previous, elements: previous.elements.filter((item) => item.id !== element.id) })); }
                const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
                if (direction) { event.preventDefault(); const step = event.shiftKey ? 5 : 1; changeElement(element.id, { x: element.x + direction[0] * step, y: element.y + direction[1] * step }); }
              }}><ReportElementContent element={element} editing />{selectedId === element.id && <div className="report-resize-handle" aria-hidden="true" onPointerDown={(event) => beginGesture(event, element, true)} />}</div>)}
            </div>
          </div></div>
        </section>
        <aside className="island report-inspector">{selected ? <ElementProperties onImageLoadingChange={setImageLoading} element={selected} definition={definition} update={(patch) => changeElement(selected.id, patch)} remove={() => changeDefinition((previous) => ({ ...previous, elements: previous.elements.filter((element) => element.id !== selected.id) }))} duplicate={() => { const element = fitElement({ ...selected, id: crypto.randomUUID(), x: selected.x + 5, y: selected.y + 5 }, size.width, size.height, definition.page.margin); changeDefinition((previous) => ({ ...previous, elements: [...previous.elements, element] })); setSelectedId(element.id); }} reorder={(direction) => changeDefinition((previous) => { const elements = [...previous.elements]; const index = elements.findIndex((element) => element.id === selected.id); const target = Math.max(0, Math.min(elements.length - 1, index + direction)); [elements[index], elements[target]] = [elements[target], elements[index]]; return { ...previous, elements }; })} /> : <div><h3>{t("Seu documento, do seu jeito")}</h3><p>{t("Selecione um elemento no papel para editar seu conteúdo, tamanho e posição.")}</p><p>{definition.elements.length} {t("de 80 elementos · medidas em milímetros")}</p></div>}</aside>
      </div>
    </>}
  </div>;
}
