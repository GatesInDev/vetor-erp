"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Printer, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { subscribeToDataChanges } from "@/lib/client-data-events";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import { paginateReport, type ReportValues } from "../layout";
import { pageDimensions, type ReportDefinition, type ReportInput } from "../schema";
import { reportDataFilterSchema, reportSources } from "../sources";
import { ReportPage } from "./report-page";

type Filters = { from: string; to: string; projectId: string; recordId: string };
type ProjectOption = { id: string; name: string };
type RecordOption = { id: string; label: string };
type ReportImageStatus = "ready" | "loading" | "missing" | "error";

const emptyFilters: Filters = { from: "", to: "", projectId: "", recordId: "" };

async function fetchReportResource<T>(url: string, signal: AbortSignal): Promise<T> {
  return apiRequest<T>(url, { signal });
}

function formattedInput(input: ReportInput, value: string, formatDate: (value: Date) => string, formatNumber: (value: number) => string): string {
  if (!value) return "";
  if (input.type === "date") {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.valueOf()) ? "" : formatDate(date);
  }
  if (input.type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? formatNumber(number) : "";
  }
  return value;
}

function findOverflow(container: HTMLElement | null, definition: ReportDefinition, t: (source: string) => string): string[] {
  if (!container) return [];
  const overflowing: string[] = [];
  container.querySelectorAll<HTMLElement>(".report-paper").forEach((paper, pageIndex) => {
    paper.querySelectorAll<HTMLElement>(".report-element").forEach((element, elementIndex) => {
      const content = element.firstElementChild as HTMLElement | null;
      if (!content) return;
      const overflow = element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1
        || content.scrollHeight > element.clientHeight + 1 || content.scrollWidth > element.clientWidth + 1;
      if (overflow) {
        const source = definition.elements[elementIndex];
        const label = source.type === "manualTable" ? t("Tabela para preenchimento") : source.type === "table" ? t("Tabela") : source.type === "image" ? t("Imagem / logo") : source.text || source.binding || t("Elemento");
        overflowing.push(`${t("Página")} ${pageIndex + 1}: ${label.slice(0, 70)}`);
      }
    });
  });
  return overflowing;
}

function reportImageStatus(container: HTMLElement | null, definition: ReportDefinition, pageCount: number): ReportImageStatus {
  const imageElements = definition.elements.filter((element) => element.type === "image");
  if (!imageElements.length) return "ready";
  if (imageElements.some((element) => !element.imageData)) return "missing";
  if (!container || !pageCount) return "loading";
  const images = [...container.querySelectorAll<HTMLImageElement>(".report-element-image img")];
  if (images.length !== imageElements.length * pageCount) return "missing";
  if (images.some((image) => image.complete && image.naturalWidth === 0)) return "error";
  return images.every((image) => image.complete && image.naturalWidth > 0) ? "ready" : "loading";
}

export function ReportPreview({ definition, name }: { definition: ReportDefinition; name: string }) {
  const { t, formatDate, formatNumber } = useLocale();
  const isScreenActive = useWorkspaceScreenActive();
  const source = reportSources.find((item) => item.id === definition.source)!;
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [filterError, setFilterError] = useState("");
  const [data, setData] = useState<ReportValues | null>(null);
  const [loadedSource, setLoadedSource] = useState(definition.source);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectError, setProjectError] = useState("");
  const [recordOptions, setRecordOptions] = useState<RecordOption[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [blankInputs, setBlankInputs] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const paperContainer = useRef<HTMLDivElement>(null);
  const inputsContainer = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const activeScreen = useRef(isScreenActive);
  const pendingDataReload = useRef(false);
  const { width, height } = pageDimensions(definition.page);

  useLayoutEffect(() => {
    activeScreen.current = isScreenActive;
    if (isScreenActive && pendingDataReload.current) {
      pendingDataReload.current = false;
      setReload((value) => value + 1);
    }
  }, [isScreenActive]);

  useEffect(() => subscribeToDataChanges(() => {
    pendingDataReload.current = true;
    if (activeScreen.current) {
      pendingDataReload.current = false;
      setReload((value) => value + 1);
    }
  }), []);

  useEffect(() => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setRecordOptions([]);
    setFilterError("");
  }, [definition.source]);

  useEffect(() => {
    if (!activeScreen.current) {
      pendingDataReload.current = true;
      return;
    }
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    const query = new URLSearchParams({ source: definition.source });
    if (source.dated && appliedFilters.from) query.set("from", appliedFilters.from);
    if (source.dated && appliedFilters.to) query.set("to", appliedFilters.to);
    if (source.projectScoped && appliedFilters.projectId) query.set("projectId", appliedFilters.projectId);
    if (definition.source !== "manual" && appliedFilters.recordId) query.set("recordId", appliedFilters.recordId);
    setLoading(true);
    setLoadError("");
    setData(null);
    fetchReportResource<ReportValues>(`/api/report-data?${query}`, controller.signal).then((result) => {
      if (controller.signal.aborted || currentRequest !== requestId.current) return;
      setData(result);
      setLoadedSource(definition.source);
      if (!appliedFilters.recordId) {
        setRecordOptions(result.rows.filter((row) => row.id).map((row) => ({ id: row.id, label: [row.code || row.sku || row.number || row.invoiceNumber || row.originNumber || row.contractNumber, row.documentNumber, row.name || row.product || row.customer || row.contractor, row.createdAt || row.dueAt].filter(Boolean).join(" · ") })));
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && currentRequest === requestId.current) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
    }).finally(() => {
      if (!controller.signal.aborted && currentRequest === requestId.current) setLoading(false);
    });
    return () => controller.abort();
  }, [definition.source, source.dated, source.projectScoped, appliedFilters, reload]);

  useEffect(() => {
    if (!activeScreen.current) {
      pendingDataReload.current = true;
      return;
    }
    const controller = new AbortController();
    setProjects([]);
    setProjectError("");
    if (source.projectScoped) {
      fetchReportResource<{ projects: ProjectOption[] }>("/api/projects", controller.signal).then((result) => {
        if (!controller.signal.aborted) setProjects(result.projects);
      }).catch(() => {
        if (!controller.signal.aborted) setProjectError("Não foi possível carregar as obras. Atualize a prévia para tentar novamente.");
      });
    }
    return () => controller.abort();
  }, [source.projectScoped, reload]);

  const printInputs = useMemo(() => Object.fromEntries(definition.inputs.map((input) => [input.id, blankInputs ? "" : formattedInput(input, inputValues[input.id] ?? "", formatDate, formatNumber)])), [definition.inputs, inputValues, blankInputs, formatDate, formatNumber]);
  const document = useMemo(() => {
    if (!data || loadedSource !== definition.source) return { pages: [], error: "", data: null, inputs: printInputs };
    try {
      return { pages: paginateReport(definition, data), error: "", data, inputs: printInputs };
    } catch (error) {
      return { pages: [], error: error instanceof Error ? error.message : "Não foi possível organizar as páginas. Ajuste o layout.", data, inputs: printInputs };
    }
  }, [definition, data, loadedSource, printInputs]);
  const [layoutCheck, setLayoutCheck] = useState<{ document: typeof document; overflow: string[]; images: ReportImageStatus } | null>(null);

  useEffect(() => {
    if (!isScreenActive || !document.data || document.error) return;
    let active = true;
    let frame = 0;
    const measure = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;
        const overflow = findOverflow(paperContainer.current, definition, t);
        const images = reportImageStatus(paperContainer.current, definition, document.pages.length);
        setLayoutCheck((previous) => previous?.document === document && previous.images === images && previous.overflow.join("|") === overflow.join("|") ? previous : { document, overflow, images });
      });
    };
    measure();
    globalThis.document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    const container = paperContainer.current;
    if (container) {
      observer.observe(container);
      container.addEventListener("load", measure, true);
      container.addEventListener("error", measure, true);
    }
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      container?.removeEventListener("load", measure, true);
      container?.removeEventListener("error", measure, true);
    };
  }, [document, definition, zoom, isScreenActive, t]);

  const overflow = layoutCheck?.document === document ? layoutCheck.overflow : [];
  const images = layoutCheck?.document === document ? layoutCheck.images : definition.elements.some((element) => element.type === "image") ? "loading" : "ready";
  const imageError = images === "missing" ? "Adicione uma imagem a cada elemento de imagem antes de imprimir."
    : images === "error" ? "Uma imagem não pôde ser carregada. Substitua o arquivo no editor antes de imprimir." : "";
  const empty = Boolean(data && definition.source !== "manual" && !data.rows.length);
  const blockReason = loading ? "Aguarde o carregamento dos dados."
    : loadError || document.error || (data?.truncated ? "A consulta excedeu 500 registros. Restrinja o período, a obra ou escolha um registro para imprimir o relatório completo." : "")
      || (empty ? "Nenhum registro encontrado. Ajuste os filtros antes de imprimir." : "")
      || imageError
      || (images === "loading" ? "Aguarde o carregamento das imagens." : "")
      || (overflow.length ? "Alguns conteúdos ultrapassam o espaço disponível. Aumente a área dos elementos ou reduza a fonte no editor antes de imprimir." : "")
      || (!document.data || layoutCheck?.document !== document ? "Aguarde a verificação do layout." : "");

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const proposed = {
      source: definition.source,
      ...(source.dated && filters.from ? { from: filters.from } : {}),
      ...(source.dated && filters.to ? { to: filters.to } : {}),
      ...(source.projectScoped && filters.projectId ? { projectId: filters.projectId } : {}),
      ...(definition.source !== "manual" && filters.recordId ? { recordId: filters.recordId } : {}),
    };
    if (!reportDataFilterSchema.safeParse(proposed).success) {
      setFilterError("Confira as datas e mantenha a data final igual ou posterior à inicial.");
      return;
    }
    setFilterError("");
    setAppliedFilters({ ...filters });
  }

  function printReport() {
    if (!isScreenActive || blockReason) return;
    const invalidInput = [...inputsContainer.current?.querySelectorAll<HTMLInputElement>("input") ?? []].find((input) => !input.checkValidity());
    if (invalidInput) { invalidInput.reportValidity(); return; }
    const latestOverflow = findOverflow(paperContainer.current, definition, t);
    const latestImages = reportImageStatus(paperContainer.current, definition, document.pages.length);
    if (latestOverflow.length || latestImages !== "ready") { setLayoutCheck({ document, overflow: latestOverflow, images: latestImages }); return; }
    window.print();
  }

  return <section className="report-preview" aria-label={`${t("Prévia de")} ${name}`}>
    {isScreenActive && <style>{`@page { size: ${definition.page.size === "LETTER" ? "Letter" : "A4"} ${definition.page.orientation}; margin: 0; } .report-print-warning { display: none; } @media print { .report-preview-pages, .report-page-frame { transform: none !important; zoom: 1 !important; } .report-page-frame { width: ${width}mm !important; height: ${height}mm !important; } .report-preview-scroll { overflow: visible !important; } ${blockReason ? ".report-print-area { display: none !important; } .report-print-warning { display: block !important; color: #000 !important; background: #fff !important; padding: 20mm; }" : ""} }`}</style>}
    <div className="report-preview-controls report-print-hidden">
      <div className="report-preview-toolbar">
        <div><strong>{name}</strong><p>{t("Prévia de impressão ·")} {t(source.label)} · {definition.page.size === "LETTER" ? t("Carta") : "A4"} · {t(definition.page.orientation === "portrait" ? "Retrato" : "Paisagem")}</p></div>
        <label className="field">{t("Escala")}<select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value="0.75">75%</option><option value="1">100%</option></select></label>
        <button type="button" className="secondary-button" onClick={() => setReload((value) => value + 1)} disabled={loading}><RefreshCw size={17} />{t("Atualizar dados")}</button>
        <button type="button" className="primary-button" onClick={printReport} disabled={Boolean(blockReason)}><Printer size={17} />{t("Imprimir / salvar PDF")}</button>
      </div>
      {definition.source !== "manual" && <form className="report-preview-filters form-grid" onSubmit={applyFilters}>
        {source.dated && <><label className="field">{t("Data inicial (UTC)")}<input type="date" value={filters.from} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value, recordId: "" }))} /></label><label className="field">{t("Data final (UTC)")}<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value, recordId: "" }))} /></label></>}
        {source.projectScoped && <label className="field">{t("Obra")}<select value={filters.projectId} onChange={(event) => setFilters((previous) => ({ ...previous, projectId: event.target.value, recordId: "" }))}><option value="">{t("Todas as obras")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
        <label className="field">{t("Registro")}<select value={filters.recordId} onChange={(event) => setFilters((previous) => ({ ...previous, recordId: event.target.value }))}><option value="">{t("Todos os registros do filtro")}</option>{recordOptions.map((record) => <option key={record.id} value={record.id}>{record.label || t("Registro")}</option>)}</select></label>
        <button className="secondary-button" type="submit" disabled={loading}>{t("Aplicar filtros")}</button>
        {(filterError || projectError) && <p className="form-error field-full" role="alert">{t(filterError || projectError)}</p>}
        {source.dated && <p className="field-help field-full">{t("O intervalo inclui os dois dias em UTC.")} {t(definition.source === "stockMovements" ? "As movimentações exibem o horário de Brasília." : definition.source === "invoices" ? "O período considera a data do serviço." : "O período considera a data de vencimento.")}</p>}
      </form>}
      {definition.inputs.length > 0 && <div className="report-preview-fields" ref={inputsContainer}>
        <label className="checkbox-field"><input type="checkbox" checked={blankInputs} onChange={(event) => setBlankInputs(event.target.checked)} />{t("Deixar os campos manuais em branco para preencher após a impressão")}</label>
        <div className="form-grid">{definition.inputs.map((input) => <label className="field" key={input.id}>{input.label}<input type={input.type} value={inputValues[input.id] ?? ""} disabled={blankInputs} maxLength={2000} step={input.type === "number" ? "any" : undefined} onChange={(event) => setInputValues((previous) => ({ ...previous, [input.id]: event.target.value.slice(0, 2000) }))} /></label>)}</div>
      </div>}
      <div className="report-preview-status" aria-live="polite">
        {blockReason ? <p className={loadError || document.error || overflow.length || imageError || data?.truncated ? "form-error" : "field-help"}><AlertCircle size={16} />{t(blockReason)}</p> : <p className="field-help">{document.pages.length} {t(document.pages.length === 1 ? "página pronta" : "páginas prontas")} · {definition.source === "manual" ? t("Documento livre") : `${data?.rows.length ?? 0} ${t(data?.rows.length === 1 ? "registro" : "registros")}`} {t("· Na janela de impressão, escolha “Salvar como PDF” para exportar. Use escala 100% e desative cabeçalhos e rodapés do navegador.")}</p>}
        {overflow.length > 0 && <ul>{overflow.slice(0, 5).map((label, index) => <li key={index}>{label}</li>)}{overflow.length > 5 && <li>{t("Mais")} {overflow.length - 5} {t("elementos precisam de ajuste.")}</li>}</ul>}
      </div>
    </div>
    <div className="report-print-warning"><h1>{name}</h1><p>{t("Impressão indisponível:")} {t(blockReason)}</p></div>
    <div className="report-preview-scroll" style={{ overflow: "auto", maxWidth: "100%", minWidth: 0 }}>
      <div className="report-preview-pages report-print-area" ref={paperContainer}>
        {document.data && document.pages.map((page, index) => <div className="report-page-frame" key={index} style={{ width: `${width}mm`, height: `${height}mm`, zoom }}><ReportPage definition={definition} data={document.data!} page={page} inputs={document.inputs} index={index + 1} total={document.pages.length} /></div>)}
      </div>
    </div>
  </section>;
}
