"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type FormDialogProps = { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode };

export function FormDialog({ open, onClose, title, description, children }: FormDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  return <dialog ref={ref} className="form-dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><div><p className="section-label">VETOR · ÁREA DE TRABALHO</p><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={onClose}><X size={19} /></button></div>
    <div className="dialog-body">{children}</div>
  </dialog>;
}
