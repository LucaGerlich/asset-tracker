import { notFound } from "next/navigation";
import StatusTypeCreateForm from "../../create/ui/StatusTypeCreateForm";
import { getStatusById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Status Type",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let statusType;
  try {
    statusType = await getStatusById(id);
  } catch {
    notFound();
  }

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Status Types", href: "/statusTypes" },
          { label: "Edit" },
        ]}
      />
      <StatusTypeCreateForm initialData={statusType} mode="edit" />
    </>
  );
}
