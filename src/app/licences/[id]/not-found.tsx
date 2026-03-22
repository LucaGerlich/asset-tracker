import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-2xl font-semibold">Licence Not Found</h1>
      <p className="text-foreground-500 text-sm">
        The licence you are looking for does not exist or has been removed.
      </p>
      <Link
        href="/licences"
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        Back to Licences
      </Link>
    </div>
  );
}
