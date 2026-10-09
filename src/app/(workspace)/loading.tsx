"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";

export default function WorkspaceLoading() {
  const { t } = useLocale();
  return <div className="page-stack" aria-busy="true" aria-label={t("Carregando módulo")}>
    <div className="island panel loading-panel"><span className="section-label">{t("SEU ESPAÇO DE TRABALHO")}</span><h2>{t("Preparando seu módulo…")}</h2><p className="muted">{t("Buscando os dados da sua empresa.")}</p></div>
  </div>;
}
