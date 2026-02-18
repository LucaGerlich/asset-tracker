import TableSkeleton from "@/components/skeletons/TableSkeleton";

export default function UserLoading() {
  return (
    <div>
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}
