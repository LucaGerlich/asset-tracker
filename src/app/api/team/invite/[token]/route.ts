import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireNotDemoMode } from "@/lib/api-auth";
import { setUserPassword } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function findAndValidateInvitation(token: string) {
  const invitation = await prisma.teamInvitation.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
      inviter: { select: { firstname: true, lastname: true } },
    },
  });

  if (!invitation) {
    return { error: "Invitation not found", status: 404, invitation: null };
  }

  if (invitation.status === "accepted") {
    return {
      error: "Invitation has already been accepted",
      status: 410,
      invitation: null,
    };
  }

  if (invitation.status === "revoked") {
    return { error: "Invitation was revoked", status: 410, invitation: null };
  }

  if (new Date() > new Date(invitation.expiresAt)) {
    return { error: "Invitation has expired", status: 410, invitation: null };
  }

  return { error: null, status: 200, invitation };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { error, status, invitation } =
      await findAndValidateInvitation(token);

    if (error || !invitation) {
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      organization: invitation.organization,
      role: invitation.role,
      inviter: invitation.inviter,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    });
  } catch (err) {
    logger.error("Error validating invitation", { error: err });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { token } = await params;
    const { error, status, invitation } =
      await findAndValidateInvitation(token);

    if (error || !invitation) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();
    const { firstname, lastname, password } = body as {
      firstname: string;
      lastname: string;
      password: string;
    };

    const existingUser = await prisma.user.findFirst({
      where: { email: invitation.email },
    });

    if (existingUser) {
      // Existing users must be authenticated and own the invited email.
      // Without this, anyone with the token can hijack the user into another org.
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (!session?.user?.email || session.user.email !== invitation.email) {
        return NextResponse.json(
          {
            error:
              "You must be logged in as the invited user to accept this invitation",
          },
          { status: 401 },
        );
      }

      // Link existing user to the organization
      await prisma.user.update({
        where: { userid: existingUser.userid },
        data: { organizationId: invitation.organization.id },
      });

      // Assign role if specified
      if (invitation.role) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: existingUser.userid,
              roleId: invitation.role.id,
            },
          },
          create: {
            userId: existingUser.userid,
            roleId: invitation.role.id,
            grantedBy: invitation.invitedBy,
          },
          update: {},
        });
      }
    } else {
      if (!firstname || !lastname || !password) {
        return NextResponse.json(
          {
            error:
              "First name, last name, and password are required for new users",
          },
          { status: 400 },
        );
      }

      if (password.length < 12) {
        return NextResponse.json(
          { error: "Password must be at least 12 characters" },
          { status: 400 },
        );
      }

      // Create new user without a password column write — setUserPassword handles
      // both user.password and accounts.password atomically right after creation.
      const newUser = await prisma.user.create({
        data: {
          firstname,
          lastname,
          email: invitation.email,
          username: invitation.email,
          isadmin: false,
          canrequest: true,
          organizationId: invitation.organization.id,
          creation_date: new Date(),
        },
      });

      // Set credential password (writes to user.password + accounts.password upsert)
      await setUserPassword(newUser.userid, password);

      // Assign role if specified
      if (invitation.role) {
        await prisma.userRole.create({
          data: {
            userId: newUser.userid,
            roleId: invitation.role.id,
            grantedBy: invitation.invitedBy,
          },
        });
      }
    }

    // Mark invitation as accepted
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
    });
  } catch (err) {
    logger.error("Error accepting invitation", { error: err });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
