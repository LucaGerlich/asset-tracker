import TableSkeleton from "@/components/skeletons/TableSkeleton";

export default function AccessoriesLoading() {
  return (
    <div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
