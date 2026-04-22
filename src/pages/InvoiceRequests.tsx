import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const InvoiceRequests = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>إدارة طلبات الفواتير</CardTitle>
              <CardDescription>سيتم إضافة تفاصيل هذه الصفحة قريباً</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground">
            قيد الإنشاء
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceRequests;
