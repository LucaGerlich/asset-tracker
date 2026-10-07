import prisma from "../../../../lib/prisma";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";

const stripPassword = (user) => {
  if (!user) return user;
  const { password: _password, ...rest } = user;
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
