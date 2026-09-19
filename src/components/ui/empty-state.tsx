import type { ReactNode } from "react";
import { Orbit } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-orbit"><Orbit size={28} strokeWidth={1.25} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
