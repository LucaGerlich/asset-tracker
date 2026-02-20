import prisma from "@/lib/prisma";
import InviteAcceptForm from "./InviteAcceptForm";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: "Accept Invitation - Asset Tracker",
  description: "Accept your team invitation",
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const invitation = await prisma.teamInvitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      role: { select: { name: true } },
      inviter: { select: { firstname: true, lastname: true } },
    },
  });

  if (!invitation) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="bg-card w-full max-w-md rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-destructive text-2xl font-bold">
            Invitation Not Found
          </h1>
          <p className="text-muted-foreground mt-4">
            This invitation link is invalid or does not exist.
          </p>
          <a
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const isExpired = new Date() > new Date(invitation.expiresAt);
  const isAccepted = invitation.status === "accepted";
  const isRevoked = invitation.status === "revoked";

  if (isExpired || isAccepted || isRevoked) {
    let message = "This invitation has expired.";
    if (isAccepted) message = "This invitation has already been accepted.";
    if (isRevoked) message = "This invitation was revoked.";

    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="bg-card w-full max-w-md rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-destructive text-2xl font-bold">
            Invitation Unavailable
          </h1>
          <p className="text-muted-foreground mt-4">{message}</p>
          <a
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const inviterName =
    `${invitation.inviter.firstname} ${invitation.inviter.lastname}`.trim();

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-lg border p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Team Invitation</h1>
        <p className="text-muted-foreground mt-2">
          <strong>{inviterName}</strong> has invited you to join{" "}
          <strong>{invitation.organization.name}</strong> on Asset Tracker.
        </p>
        {invitation.role && (
          <p className="text-muted-foreground mt-1 text-sm">
            Role: <strong>{invitation.role.name}</strong>
          </p>
        )}
        <p className="text-muted-foreground mt-1 text-sm">
          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
        </p>
        <div className="mt-6">
          <InviteAcceptForm token={token} email={invitation.email} />
        </div>
      </div>
    </div>
  );
}
