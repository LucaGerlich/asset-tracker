import { notFound } from "next/navigation";
import LicenceCategoriesCreateForm from "../../create/ui/LicenceCategoriesCreateForm";
import { getLicenceCategoryById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Licence Category",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let category;
  try {
    category = await getLicenceCategoryById(id);
  } catch {
    notFound();
  }

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licence Categories", href: "/licenceCategories" },
          { label: "Edit" },
        ]}
      />
      <LicenceCategoriesCreateForm initialData={category} mode="edit" />
    </>
  );
}
