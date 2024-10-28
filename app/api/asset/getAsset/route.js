import prisma from "../../../lib/prisma";

export async function GET() {
  try {
    await prisma.asset.findMany({});

    return new Response(JSON.stringify({ message: "Get Asset successfully" }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return new Response(JSON.stringify({ error: "Error deleting asset" }), {
      status: 500,
    });
  }
}
