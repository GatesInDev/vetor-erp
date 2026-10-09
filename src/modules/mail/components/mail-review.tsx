"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { EquipmentRentalRow } from "@/modules/rentals/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import type { MailMessageDetail } from "../types";
import { MailReviewForm } from "./mail-review-form";

export function MailReview({ messageId }: { messageId: string }) {
  const { t } = useLocale();
  const active = useWorkspaceScreenActive();
  const [message, setMessage] = useState<MailMessageDetail | null>(null);
  const [rentals, setRentals] = useState<EquipmentRentalRow[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ message: MailMessageDetail }>(`/api/mail/messages/${messageId}`, { signal: controller.signal }),
      apiRequest<{ rentals: EquipmentRentalRow[] }>("/api/equipment-rentals", { signal: controller.signal }),
    ]).then(([detail, options]) => { setMessage(detail.message); setRentals(options.rentals); setError(""); }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível carregar a mensagem."); });
    return () => controller.abort();
  }, [messageId, attempt, active]);

  function importedCharge(result: { rentalId: string; chargeId: string }, attachmentIds: string[]) {
    setMessage((previous) => previous && {
      ...previous,
      importedAttachmentCount: previous.importedAttachmentCount + attachmentIds.length,
      attachments: previous.attachments.map((attachment) => attachmentIds.includes(attachment.id) ? { ...attachment, rentalId: result.rentalId, rentalChargeId: result.chargeId } : attachment),
    });
    setAttempt((value) => value + 1);
  }
  return <div className="page-stack">
    {error && <section className="island panel page-stack"><p className="form-error" role="alert">{t(error)}</p><div><button type="button" className="secondary-button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>{t("Tentar novamente")}</button></div></section>}
    {message ? <MailReviewForm message={message} rentals={rentals} onImported={importedCharge} /> : !error && <p className="muted" role="status">{t("Carregando mensagem…")}</p>}
  </div>;
}
