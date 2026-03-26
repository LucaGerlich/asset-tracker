import { notFound } from "next/navigation";
import Link from "next/link";
import { getKitById, getEntityHistory } from "@/lib/data";
import HistoryTimeline from "@/components/HistoryTimeline";
import Breadcrumb from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Asset Tracker - Kit Details",
};

export default async function KitDetailPage({ params }: PageProps) {
  const { id } = await params;

  let kit;
  try {
    kit = await getKitById(id);
  } catch {
    notFound();
  }

  const historyEntries = await getEntityHistory("kit", id);

  const entityTypeLabels: Record<string, string> = {
    asset_category: "Asset Category",
    accessory: "Accessory",
    licence: "Licence",
    component: "Component",
  };

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Kits", href: "/kits" },
    { label: "Kit Details", href: `/kits/${id}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
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
          <h2 className="mb-3 text-lg font-semibold">
            Kit Items ({kit.items.length})
          </h2>
          {kit.items.length === 0 ? (
            <p className="text-muted-foreground">No items in this kit.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kit.items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {entityTypeLabels[item.entityType] || item.entityType}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.entityId}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.isRequired ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Separator className="mt-6" />

        <div>
          <h2 className="text-lg font-semibold">Kit History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="kit" />
        </div>
      </div>
    </>
  );
}
