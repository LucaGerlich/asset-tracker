import TableSkeleton from "@/components/skeletons/TableSkeleton";

export default function AssetsLoading() {
  return (
    <div>
      <TableSkeleton rows={10} columns={8} />
    </div>
  );
}
