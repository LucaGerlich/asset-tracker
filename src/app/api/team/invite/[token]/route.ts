import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
    console.error("Error validating invitation:", err);
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

    // Check if user with that email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: invitation.email },
    });

    if (existingUser) {
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
      // Validate required fields for new user
      if (!firstname || !lastname || !password) {
        return NextResponse.json(
          {
            error:
              "First name, last name, and password are required for new users",
          },
          { status: 400 },
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }

      // Create new user
      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.user.create({
        data: {
          firstname,
          lastname,
          email: invitation.email,
          username: invitation.email,
          password: hashedPassword,
          isadmin: false,
          canrequest: true,
          organizationId: invitation.organization.id,
          creation_date: new Date(),
        },
      });

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
    console.error("Error accepting invitation:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
