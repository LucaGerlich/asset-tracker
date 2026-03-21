import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendEmail } from "@/lib/email/service";
import { emailTemplates, renderTemplate } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();

    if (!user.id || !user.organizationId) {
      return NextResponse.json(
        { error: "Missing user or organization context" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { email, roleId } = body as { email: string; roleId?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check for existing pending invitation for same email + org
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId: user.organizationId,
        status: "pending",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email address" },
        { status: 409 },
      );
    }

    // Generate unique token and set 7-day expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create TeamInvitation record
    const invitation = await prisma.teamInvitation.create({
      data: {
        email: email.toLowerCase(),
        organizationId: user.organizationId,
        roleId: roleId || null,
        invitedBy: user.id,
        token,
        status: "pending",
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
        role: { select: { name: true } },
        inviter: { select: { firstname: true, lastname: true } },
      },
    });

    // Try to send invitation email
    try {
      const baseUrl = getBaseUrl();
      const inviteUrl = `${baseUrl}/invite/${token}`;
      const inviterName =
        `${invitation.inviter.firstname} ${invitation.inviter.lastname}`.trim();

      const subject = renderTemplate(emailTemplates.teamInvitation.subject, {
        organizationName: invitation.organization.name,
      });
      const html = renderTemplate(emailTemplates.teamInvitation.html, {
        inviterName,
        organizationName: invitation.organization.name,
        inviteUrl,
      });

      const result = await sendEmail({
        to: email.toLowerCase(),
        subject,
        html,
      });

      if (!result.success) {
        logger.warn("Failed to send invitation email", { error: result.error });
      }
    } catch (emailError) {
      logger.warn("Failed to send invitation email", { error: emailError });
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    logger.error("Error creating invitation", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Missing organization context" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { id, status } = body as { id: string; status: string };

    const allowedStatuses = ["cancelled", "revoked"];
    if (!id || !status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          error:
            !id || !status
              ? "Invitation ID and status are required"
              : `Status must be one of: ${allowedStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Verify invitation belongs to the same organization
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invitations can be updated" },
        { status: 400 },
      );
    }

    const updated = await prisma.teamInvitation.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    logger.error("Error updating invitation", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const user = await requireApiAdmin();

    if (!user.organizationId) {
      return NextResponse.json(
        { error: "Missing organization context" },
        { status: 400 },
      );
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        organizationId: user.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        inviter: { select: { firstname: true, lastname: true } },
        role: { select: { name: true } },
      },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    logger.error("Error fetching invitations", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
