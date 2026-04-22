import { ConfirmedInvoicesPage } from "@/components/invoices/ConfirmedInvoicesPage";

const SalesInvoices = () => (
  <ConfirmedInvoicesPage
    primaryType="sale"
    returnType="sale_return"
    title="فواتير البيع المؤكدة"
    description="جميع فواتير البيع التي تم تأكيدها وأثرت على المخزون والقيود."
  />
);

export default SalesInvoices;
