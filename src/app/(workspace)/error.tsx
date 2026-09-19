"use client";

import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <section className="island panel"><EmptyState title="Não foi possível carregar este módulo" description="Ocorreu uma falha ao consultar os dados. Tente novamente em alguns instantes." action={<button className="primary-button" onClick={reset}><RefreshCw size={16} />Tentar novamente</button>} /></section>;
}
