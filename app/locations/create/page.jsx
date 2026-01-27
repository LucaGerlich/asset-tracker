import Link from "next/link";

export default function Page() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Create Location</h1>
      <p className="text-default-500 text-sm sm:text-base">
        Use this page as the foundation for capturing new location details.
      </p>
      <Link
        href="/locations"
        className="inline-flex items-center rounded-md border border-default-300 px-3 py-2 text-sm font-medium text-foreground hover:bg-default-100 w-full sm:w-auto justify-center sm:justify-start"
      >
        Back to Locations
      </Link>
    </div>
  );
}
