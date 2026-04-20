import { Truck } from "lucide-react";
import { PartnersListPage } from "@/components/partners/PartnersListPage";

const Suppliers = () => (
  <PartnersListPage
    kind="supplier"
    title="الموردين"
    description="إدارة الموردين وعرض كشوف حساباتهم."
    Icon={Truck}
    newButtonLabel="مورد جديد"
  />
);

export default Suppliers;
