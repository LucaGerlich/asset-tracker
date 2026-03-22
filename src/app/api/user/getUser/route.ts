import prisma from "../../../../lib/prisma";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";

const stripPassword = (user) => {
  if (!user) return user;
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = user;
  return rest;
};

export async function GET() {
  try {
    await requirePermission("user:view");
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const where = scopeToOrganization({}, orgId);
    const users = await prisma.user.findMany({ where, take: 1000 });
    return NextResponse.json(users.map(stripPassword));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
