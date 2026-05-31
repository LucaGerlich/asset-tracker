import ComponentCategoryCreateForm from "../../create/ui/ComponentCategoryCreateForm";
import { getComponentCategoryById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Component Category",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getComponentCategoryById(id);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Component Categories", href: "/componentCategories" },
          { label: "Edit" },
        ]}
      />
      <ComponentCategoryCreateForm initialData={category} mode="edit" />
    </>
  );
}
