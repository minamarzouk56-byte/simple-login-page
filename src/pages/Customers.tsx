import { Users } from "lucide-react";
import { PartnersListPage } from "@/components/partners/PartnersListPage";

const Customers = () => (
  <PartnersListPage
    kind="customer"
    title="العملاء"
    description="إدارة العملاء وعرض كشوف حساباتهم."
    Icon={Users}
    newButtonLabel="عميل جديد"
  />
);

export default Customers;
