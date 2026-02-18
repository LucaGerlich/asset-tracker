import TableSkeleton from "@/components/skeletons/TableSkeleton";

export default function ConsumablesLoading() {
  return (
    <div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
