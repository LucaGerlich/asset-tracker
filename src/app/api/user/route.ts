import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const USER_SORT_FIELDS = ["firstname", "lastname", "email", "creation_date"];

// GET /api/user
// Optional query: ?id=<userid>
// Pagination: ?page=1&pageSize=25&sortBy=lastname&sortOrder=asc&search=keyword
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      const user = await prisma.user.findUnique({ where: { userid: id } });
      if (!user) {
        return NextResponse.json(
          { error: `User with id ${id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(user, { status: 200 });
    }

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const users = await prisma.user.findMany({});
      return NextResponse.json(users, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, USER_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter (firstname, lastname, email, username)
    if (params.search) {
      where.OR = [
        { firstname: { contains: params.search, mode: "insensitive" } },
        { lastname: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { username: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, ...prismaArgs }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(users, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/user error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PUT /api/user
// Body must include userid; any provided fields will be updated
export async function PUT(req) {
  try {
    const body = await req.json();
    const { userid, password, ...data } = body || {};

    if (!userid) {
      return NextResponse.json(
        { error: "userid is required to update a user" },
        { status: 400 }
      );
    }

    // Normalize booleans
    if (Object.prototype.hasOwnProperty.call(data, "isadmin")) {
      data.isadmin = Boolean(data.isadmin);
    }
    if (Object.prototype.hasOwnProperty.call(data, "canrequest")) {
      data.canrequest = Boolean(data.canrequest);
    }

    // Attach password if provided (blank means no change)
    if (typeof password === "string" && password.length > 0) {
      data.password = password;
    }

    const updated = await prisma.user.update({
      where: { userid },
      data: {
        ...data,
        change_date: new Date(),
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

