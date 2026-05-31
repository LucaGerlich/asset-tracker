import Breadcrumb from "@/components/Breadcrumb";
import ComponentCategoriesTable from "../../ui/componentCategories/ComponentCategoriesTable";
import { getComponentCategories } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Component Categories",
  description: "Asset management tool",
};

export default async function Page() {
  const categoriesRaw = await getComponentCategories();
  const categories = categoriesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Component Categories", href: "/componentCategories" },
        ]}
      />
      <ComponentCategoriesTable items={categories} />
    </div>
  );
}
