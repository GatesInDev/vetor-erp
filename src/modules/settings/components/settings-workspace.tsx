"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FormSection } from "@/components/ui/form-page";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { useLocale, usePreferences } from "./preferences-provider";

export function SettingsWorkspace({ canManageEmail = false }: { canManageEmail?: boolean }) {
  const { preferences, savePreferences } = usePreferences();
  const { t } = useLocale();
  const draft = useFormDraft(preferences, { title: "Configurações" });
  const [saved, setSaved] = useState(false);
  const numberOptions = { minimumFractionDigits: draft.values.decimalPlaces, maximumFractionDigits: draft.values.decimalPlaces };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.pending) return;
    draft.setPending(true);
    draft.setError("");
    setSaved(false);
    try {
      await savePreferences(draft.values);
      draft.acceptValues(draft.values);
      setSaved(true);
    } catch { draft.setError(t("Não foi possível salvar suas preferências. Tente novamente.")); }
    finally { draft.setPending(false); }
  }

  return <div className="page-stack form-page settings-workspace">
    <PageHeader eyebrow={t("PREFERÊNCIAS DO SISTEMA")} title={t("Configurações")} description={t("Ajuste a aparência, o idioma e a exibição de dados. Suas preferências acompanham sua conta.")} />
    <form onSubmit={submit}>
      <FormSection title={t("Aparência e idioma")} description={t("Preferências pessoais")}>
        <label className="form-field">{t("Tema")}<select disabled={draft.pending} value={draft.values.theme} onChange={(event) => draft.setField("theme", event.target.value as typeof preferences.theme)}><option value="dark">{t("Escuro")}</option><option value="light">{t("Claro")}</option></select></label>
        <label className="form-field">{t("Idioma")}<select disabled={draft.pending} value={draft.values.locale} onChange={(event) => draft.setField("locale", event.target.value as typeof preferences.locale)}><option value="pt-BR">{t("Português (Brasil)")}</option><option value="en-US">{t("Inglês (Estados Unidos)")}</option></select></label>
      </FormSection>
      <FormSection title={t("Exibição de números")} description={t("Essa preferência muda apenas a exibição. Os valores e cálculos armazenados mantêm sua precisão original.")}>
        <label className="form-field">{t("Casas decimais")}<select disabled={draft.pending} value={draft.values.decimalPlaces} onChange={(event) => draft.setField("decimalPlaces", Number(event.target.value))}>{Array.from({ length: 7 }, (_, digits) => <option key={digits} value={digits}>{digits}</option>)}</select></label>
        <div className="settings-preview"><span>{t("Exemplo numérico")}</span><strong>{new Intl.NumberFormat(draft.values.locale, numberOptions).format(1234.56789)}</strong><span>{t("Exemplo monetário")}</span><strong>{new Intl.NumberFormat(draft.values.locale, { ...numberOptions, style: "currency", currency: "BRL" }).format(1234.56789)}</strong></div>
      </FormSection>
      <FormSection title={t("Telas mantidas em memória")} description={t("As telas usadas mais recentemente ficam prontas para alternar. As demais abas continuam abertas e recarregam ao voltar, preservando os rascunhos dos formulários.")}>
        <label className="form-field">{t("Limite de telas carregadas")}<select disabled={draft.pending} value={draft.values.loadedScreenLimit} onChange={(event) => draft.setField("loadedScreenLimit", Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
      </FormSection>
      {draft.error && <p className="form-error" role="alert">{draft.error}</p>}
      {saved && !draft.dirty && <p className="form-success" role="status">{t("Preferências salvas.")}</p>}
      <div className="form-actions"><button className="primary-button" disabled={draft.pending} type="submit"><Save size={18} />{t(draft.pending ? "Salvando..." : "Salvar preferências")}</button></div>
    </form>
    {canManageEmail && <FormSection title={t("Integrações")} description={t("Receba documentos do Gmail na caixa de entrada do sistema.")}>
      <div className="full-width"><Link href="/settings/email" className="secondary-button">{t("Conexão de e-mail")}</Link></div>
    </FormSection>}
  </div>;
}
