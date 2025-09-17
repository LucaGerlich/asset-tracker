import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/user
// Optional query: ?id=<userid>
export async function GET(req) {
  try {
    const id = req.nextUrl.searchParams.get("id");
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

    const users = await prisma.user.findMany({});
    return NextResponse.json(users, { status: 200 });
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

