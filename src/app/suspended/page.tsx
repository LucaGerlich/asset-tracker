import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import SignOutButton from "./SignOutButton";

export const metadata = {
  title: "Organization Suspended",
};

export default async function SuspendedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const canManageBilling =
    !!session?.user?.isadmin && !!process.env.STRIPE_SECRET_KEY;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md text-center">
        <div className="rounded-lg border border-red-200 bg-white p-8 shadow-sm dark:border-red-800 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Organization Suspended
          </h1>

          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            Access to your organization is currently restricted. It stays
            restricted until the subscription is reactivated.
          </p>

          <div className="space-y-3">
            {canManageBilling ? (
              <form method="post" action="/api/billing/portal">
                <Button type="submit" className="w-full">
                  Manage subscription
                </Button>
              </form>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact your administrator or support to reactivate this
                organization.
              </p>
            )}

            <SignOutButton />
          </div>

          <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
