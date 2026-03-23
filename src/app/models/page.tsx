import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
import ModelsTable from "../../ui/models/ModelsTable";
import { getModel } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Models",
  description: "Asset management tool",
};

export default async function Page() {
  const modelsRaw = await getModel();
  const models = modelsRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Models", href: "/models" },
        ]}
      />
      <ModelsTable items={models} />
    </div>
  );
}
