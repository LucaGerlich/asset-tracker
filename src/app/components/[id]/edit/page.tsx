import ComponentCreateForm from "../../create/ui/ComponentCreateForm";
import {
  getComponentById,
  getComponentCategories,
  getLocationOptions,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Component",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const component = await getComponentById(params.id);

  const [categories, manufacturers, suppliers, locations] = await Promise.all([
    getComponentCategories(),
    getManufacturers(),
    getSuppliers(),
    getLocationOptions(),
  ]);

  const initialData = {
    ...component,
    purchasePrice:
      component.purchasePrice != null ? Number(component.purchasePrice) : null,
    purchaseDate: component.purchaseDate
      ? component.purchaseDate.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Components", href: "/components" },
          { label: "Edit" },
        ]}
      />
      <ComponentCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        locations={locations}
        initialData={initialData}
        mode="edit"
      />
    </>
  );
}
