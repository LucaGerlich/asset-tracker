import ComponentCategoryCreateForm from "./ui/ComponentCategoryCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Component Category",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Component Categories", href: "/componentCategories" },
          { label: "Create" },
        ]}
      />
      <ComponentCategoryCreateForm />
    </>
  );
}
