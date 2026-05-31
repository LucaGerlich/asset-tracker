import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ConsumableCreateForm from "./ui/ConsumableCreateForm";
import {
  getConsumableCategories,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Consumable",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  const [categories, manufacturers, suppliers] = await Promise.all([
    getConsumableCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Consumables", href: "/consumables" },
          { label: "Create Consumable" },
        ]}
      />
      <ConsumableCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
      />
    </>
  );
}
