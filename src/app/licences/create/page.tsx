import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import LicenceCreateForm from "./ui/LicenceCreateForm";
import {
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getUsers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Licence",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  const [categories, manufacturers, suppliers, users] = await Promise.all([
    getLicenceCategories(),
    getManufacturers(),
    getSuppliers(),
    getUsers(),
  ]);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licences", href: "/licences" },
          { label: "Create Licence" },
        ]}
      />
      <LicenceCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        users={users}
      />
    </>
  );
}
