"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { MAX_REPORT_IMAGE_BYTES, MAX_REPORT_IMAGE_DIMENSION, MAX_REPORT_IMAGES_BYTES, reportImageBytes, validateReportImage } from "../images";
import type { ReportDefinition, ReportElement } from "../schema";

export function ImageProperties({ element, definition, update, onLoadingChange }: {
  element: ReportElement;
  definition: ReportDefinition;
  update: (patch: Partial<ReportElement>) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; onLoadingChange(false); }, [onLoadingChange]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const currentRequest = ++requestId.current;
    setError("");
    if (!["image/png", "image/jpeg"].includes(file.type) || !file.size || file.size > MAX_REPORT_IMAGE_BYTES) {
      setError("Escolha uma imagem PNG ou JPEG de até 512 KB.");
      return;
    }
    setLoading(true);
    onLoadingChange(true);
    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image read failed"));
        reader.onerror = () => reject(new Error("Image read failed"));
        reader.onabort = () => reject(new Error("Image read aborted"));
        reader.readAsDataURL(file);
      });
      if (!validateReportImage(imageData)) throw new Error("Invalid image");
      const image = new Image();
      image.src = imageData;
      await image.decode();
      if (currentRequest !== requestId.current) return;
      if (image.naturalWidth > MAX_REPORT_IMAGE_DIMENSION || image.naturalHeight > MAX_REPORT_IMAGE_DIMENSION) {
        setError("Reduza a imagem para no máximo 4096 × 4096 pixels.");
        return;
      }
      const otherImageBytes = definition.elements.reduce((total, item) => total + (item.id !== element.id && item.imageData ? reportImageBytes(item.imageData) : 0), 0);
      if (otherImageBytes + reportImageBytes(imageData) > MAX_REPORT_IMAGES_BYTES) {
        setError("As imagens do modelo podem somar no máximo 1 MB.");
        return;
      }
      update({ imageData, text: element.text || file.name.replace(/\.[^.]+$/, "").slice(0, 120) });
    } catch {
      if (currentRequest === requestId.current) setError("Não foi possível ler a imagem. Escolha um arquivo PNG ou JPEG válido.");
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); onLoadingChange(false); }
    }
  }

  return <div className="report-image-properties">
    <label>{t(element.imageData ? "Substituir imagem" : "Enviar imagem / logo")}<input type="file" accept="image/png,image/jpeg" disabled={loading} onChange={upload} /></label>
    <p className="report-hint">{t("PNG ou JPEG de até 512 KB por imagem e 1 MB por modelo. Para logos sem fundo, use PNG transparente.")}</p>
    <label>{t("Descrição da imagem")}<input maxLength={120} disabled={loading} value={element.text} onChange={(event) => update({ text: event.target.value })} /></label>
    <p className="report-hint">{t("A imagem mantém a proporção dentro da área definida e é salva junto com o modelo.")}</p>
    {loading && <p role="status">{t("Carregando imagem...")}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </div>;
}
