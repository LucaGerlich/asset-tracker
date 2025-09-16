import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

// Admin-only: set another user's password without current password
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.isadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, newPassword } = await request.json();
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: "userId and newPassword are required" },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "newPassword must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { userid: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { userid: userId }, data: { password: hashed } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/user/adminSetPassword error:", error);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}

