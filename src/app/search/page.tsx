import Breadcrumb from "@/components/Breadcrumb";
import AdvancedSearchClient from "./ui/AdvancedSearchClient";

export const metadata = {
  title: "Asset Tracker - Advanced Search",
  description: "Search across all entities with advanced filters",
};

export default function AdvancedSearchPage() {
  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Advanced Search", href: "/search" },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advanced Search</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Build filters to search across assets, accessories, consumables,
            licences, and components.
          </p>
        </div>
      </div>
      <AdvancedSearchClient />
    </div>
  );
}
