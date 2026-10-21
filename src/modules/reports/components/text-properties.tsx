"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { insertTextBinding, textBindings } from "../text-template";

type TextBindingOption = { key: string; label: string };

export function TextProperties({ text, bindings, update }: {
  text: string; bindings: TextBindingOption[]; update: (text: string) => void;
}) {
  const { t } = useLocale();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: text.length, end: text.length });
  const pendingCaret = useRef<number | null>(null);
  const [binding, setBinding] = useState("");
  const [error, setError] = useState("");
  const available = new Set(bindings.map((option) => option.key));
  const invalid = textBindings(text).some((key) => !available.has(key));
  const selectedBinding = available.has(binding) ? binding : "";

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !textarea.current) return;
    textarea.current.focus();
    textarea.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  function insert() {
    if (!selectedBinding) return;
    const result = insertTextBinding(text, selectedBinding, selection.current.start, selection.current.end);
    if (!result) { setError("O texto com a variável deve ter no máximo 2.000 caracteres."); return; }
    selection.current = { start: result.caret, end: result.caret };
    pendingCaret.current = result.caret;
    setError("");
    update(result.text);
  }

  return <div className="report-text-properties">
    <label>{t("Texto")}<textarea ref={textarea} rows={5} maxLength={2000} value={text}
      onSelect={(event) => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
      onChange={(event) => { selection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; setError(""); update(event.target.value); }} /></label>
    <label>{t("Variável no texto")}<select value={selectedBinding} onChange={(event) => setBinding(event.target.value)}>
      <option value="">{t("Selecione um campo")}</option>
      <optgroup label={t("Campos para preencher")}>{bindings.filter((option) => option.key.startsWith("input.")).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</optgroup>
      <optgroup label={t("Dados do relatório")}>{bindings.filter((option) => !option.key.startsWith("input.")).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</optgroup>
    </select></label>
    <button type="button" className="secondary-button" disabled={!selectedBinding} onClick={insert}>{t("Inserir variável")}</button>
    <p className="report-hint">{t("Posicione o cursor no texto e insira um campo. Na prévia, a variável será substituída pelo valor preenchido.")}</p>
    {(error || invalid) && <p className="form-error" role="alert">{t(error || "Há uma variável sem campo vinculado. Remova-a ou insira um campo disponível pelo seletor.")}</p>}
  </div>;
}
