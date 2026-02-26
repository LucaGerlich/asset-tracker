import { notFound } from "next/navigation";
import Link from "next/link";
import { getKitById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KitDetailPage({ params }: PageProps) {
  const { id } = await params;

  let kit;
  try {
    kit = await getKitById(id);
  } catch {
    notFound();
  }

  const entityTypeLabels: Record<string, string> = {
    asset_category: "Asset Category",
    accessory: "Accessory",
    licence: "Licence",
    component: "Component",
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{kit.name}</h1>
          {kit.description && (
            <p className="text-muted-foreground mt-1">{kit.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant={kit.isActive ? "default" : "secondary"}>
            {kit.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button variant="outline" asChild>
            <Link href={`/kits/${id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">
          Kit Items ({kit.items.length})
        </h2>
        {kit.items.length === 0 ? (
          <p className="text-muted-foreground">No items in this kit.</p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Entity ID</th>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Required</th>
                </tr>
              </thead>
              <tbody>
                {kit.items.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">
                      {entityTypeLabels[item.entityType] || item.entityType}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.entityId}
                    </td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {item.isRequired ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
