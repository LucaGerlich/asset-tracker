import Link from "next/link";

export default function Page() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Create Supplier</h1>
      <p className="text-default-500 text-sm sm:text-base">
        Flesh out the supplier creation flow here to onboard new vendors.
      </p>
      <Link
        href="/suppliers"
        className="inline-flex items-center rounded-md border border-default-300 px-3 py-2 text-sm font-medium text-foreground hover:bg-default-100 w-full sm:w-auto justify-center sm:justify-start"
      >
        Back to Suppliers
      </Link>
    </div>
  );
}
