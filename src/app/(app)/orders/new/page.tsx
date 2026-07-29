import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { OrderCreateForm } from "@/features/orders/order-create-form";

export default async function NewOrderPage() {
  const session = await getSession();
  if (!session || !can(session.role, "order:create")) redirect("/orders");

  return (
    <div>
      <PageHeader
        title="Nouvel ordre de fabrication"
        description="Sélectionnez un article et un magasin issus de l'ERP, puis renseignez les informations de production."
      />
      <OrderCreateForm />
    </div>
  );
}
