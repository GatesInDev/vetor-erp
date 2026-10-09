"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, FilePenLine } from "lucide-react";
import { useId, type InvalidEvent, type ReactNode } from "react";
import { PageHeader } from "./page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";

export function FormPage({ title, description, backHref, children }: { title: string; description?: string; backHref: string; children: ReactNode }) {
  const { t } = useLocale();
  function revealInvalidField(event: InvalidEvent<HTMLDivElement>) {
    const field = event.target;
    if (!(field instanceof HTMLElement)) return;
    let section = field.closest("details");
    while (section) {
      section.open = true;
      section = section.parentElement?.closest("details") ?? null;
    }
  }

  return <div className="page-stack form-page" onInvalidCapture={revealInvalidField}>
    <div className="form-page-navigation"><Link href={backHref} className="text-button"><ArrowLeft size={18} />{t("Voltar à lista")}</Link><span><FilePenLine size={16} />{t("Formulário")}</span></div>
    <PageHeader eyebrow={t("ÁREA DE TRABALHO")} title={t(title)} description={t(description ?? "Preencha os campos abaixo para concluir o cadastro.")} />
    <p className="form-page-hint">{t("Você pode alternar entre as abas sem perder o que está preenchendo. Salve para concluir.")}</p>
    {children}
  </div>;
}

export function FormSection({ title, description, defaultOpen = true, children }: { title: string; description?: string; defaultOpen?: boolean; children: ReactNode }) {
  const { t } = useLocale();
  const id = useId();
  return <details className="form-section island" open={defaultOpen}>
    <summary aria-controls={id}><span><strong>{t(title)}</strong>{description && <span className="form-section-description">{t(description)}</span>}</span><ChevronDown size={21} aria-hidden="true" /></summary>
    <div id={id} className="form-section-content form-grid">{children}</div>
  </details>;
}
