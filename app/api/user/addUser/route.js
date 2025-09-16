import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

// POST /api/user/addUser
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      username,
      isadmin = false,
      canrequest = true,
      lastname,
      firstname,
      email,
      lan,
      password,
    } = body || {};

    if (!lastname || !firstname || !password) {
      return NextResponse.json(
        { error: "firstname, lastname and password are required" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        username: username ?? null,
        isadmin: Boolean(isadmin),
        canrequest: Boolean(canrequest),
        lastname,
        firstname,
        email: email ?? null,
        lan: lan ?? null,
        password: hashed,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/user/addUser error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
