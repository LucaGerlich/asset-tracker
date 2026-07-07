import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getKitById } from "@/lib/data";
import KitCreateForm from "../../create/ui/KitCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Kit",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditKitPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  let kit;
  try {
    kit = await getKitById(id);
  } catch {
    notFound();
  }

  const initialData = {
    id: kit.id,
    name: kit.name,
    description: kit.description ?? "",
    isActive: kit.isActive,
    items: kit.items.map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      quantity: item.quantity,
      isRequired: item.isRequired,
      notes: item.notes ?? "",
    })),
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Kits", href: "/kits" },
          { label: kit.name, href: `/kits/${id}` },
          { label: "Edit" },
        ]}
      />
      <h1 className="text-2xl font-bold">Edit Kit</h1>
      <KitCreateForm mode="edit" initialData={initialData} />
    </div>
  );
}
