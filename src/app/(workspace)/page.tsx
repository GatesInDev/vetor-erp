import { ModuleLauncher } from "@/modules/workspace/components/module-launcher";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { db } from "@/lib/db";

export default async function WorkspacePage() {
  const { actor, company } = await getWorkspaceContext();
  const [projectCount, customerCount, invoiceCount, payableCount] = await Promise.all([
    db.project.count({ where: { companyId: actor.companyId, active: true } }),
    db.partner.count({ where: { companyId: actor.companyId, customer: true } }),
    db.serviceInvoice.count({ where: { companyId: actor.companyId } }),
    db.payable.count({ where: { companyId: actor.companyId, status: "OPEN" } }),
  ]);
  return <ModuleLauncher companyName={company.name} projectCount={projectCount} customerCount={customerCount} invoiceCount={invoiceCount} payableCount={payableCount} role={actor.role} />;
}
