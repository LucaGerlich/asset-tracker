import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import TeamInvitationsClient from "./ui/TeamInvitationsClient";

export const metadata = {
  title: "Admin - Team Management",
  description: "Manage team invitations and members",
};

export default async function TeamPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Team" },
        ]}
      />
      <div className="mt-6">
        <TeamInvitationsClient />
      </div>
    </div>
  );
}
