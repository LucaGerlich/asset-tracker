import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";

// To handle a GET request to /api
export async function GET(_request) {
  try {
    await requireApiAuth();
    return NextResponse.json({ message: "Hello World" }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to handle request" },
      { status: 500 },
    );
  }
}

// To handle a POST request to /api
export async function POST(_request) {
  try {
    await requireApiAuth();
    return NextResponse.json({ message: "Hello World" }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to handle request" },
      { status: 500 },
    );
  }
}

// Same logic to add a `PATCH`, `DELETE`...
