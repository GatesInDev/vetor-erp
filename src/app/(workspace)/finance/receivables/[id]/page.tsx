import { AccountRecordPage } from "@/modules/finance/components/account-record-page";

export default function ReceivablePage({ params }: { params: Promise<{ id: string }> }) {
  return <AccountRecordPage params={params} accountType="RECEIVABLE" />;
}
