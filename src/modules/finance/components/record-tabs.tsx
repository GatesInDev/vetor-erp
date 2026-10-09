"use client";

import { useId, type ReactNode } from "react";

type RecordTab<T extends string> = { value: T; label: string; count?: number; content: ReactNode };

export function RecordTabs<T extends string>({ label, value, tabs, onChange }: { label: string; value: T; tabs: RecordTab<T>[]; onChange: (value: T) => void }) {
  const id = useId();
  return <div className="page-stack" onInvalidCapture={(event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement)) return;
    const panel = field.closest<HTMLElement>("[data-record-panel]");
    const tab = tabs.find((item) => item.value === panel?.dataset.recordPanel);
    if (tab && tab.value !== value) { onChange(tab.value); requestAnimationFrame(() => field.focus()); }
  }}>
    <div className="module-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => <button key={tab.value} id={`${id}-${tab.value}-tab`} type="button" role="tab" aria-selected={value === tab.value} aria-controls={`${id}-${tab.value}-panel`} tabIndex={value === tab.value ? 0 : -1} onClick={() => onChange(tab.value)} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        onChange(tabs[nextIndex].value);
        document.getElementById(`${id}-${tabs[nextIndex].value}-tab`)?.focus();
      }}>{tab.label}{tab.count !== undefined && <span>{tab.count}</span>}</button>)}
    </div>
    {tabs.map((tab) => <div key={tab.value} id={`${id}-${tab.value}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab.value}-tab`} data-record-panel={tab.value} hidden={value !== tab.value}>{tab.content}</div>)}
  </div>;
}
