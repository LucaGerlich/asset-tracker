import prisma from "../../../../lib/prisma";
import { logger } from "@/lib/logger";

export async function DELETE(req) {
  const startTime = Date.now();
  
  try {
    const { accessoryId } = await req.json();

    if (!accessoryId) {
      logger.warn("DELETE /api/accessories/deleteAccessory - Missing accessoryId", {
        type: "validation_error",
      });
      return new Response(JSON.stringify({ error: "Accessory ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info("Deleting accessory", {
      accessoryId,
      type: "accessory_delete",
    });

    await prisma.$transaction([
      prisma.userAccessoires.deleteMany({ where: { accessorieid: accessoryId } }),
      prisma.accessories.delete({ where: { accessorieid: accessoryId } }),
    ]);

    const duration = Date.now() - startTime;
    logger.apiResponse("DELETE", "/api/accessories/deleteAccessory", 200, duration, {
      accessoryId,
    });

    return new Response(
      JSON.stringify({ message: "Accessory deleted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError("DELETE", "/api/accessories/deleteAccessory", error, {
      duration,
    });
    
    return new Response(JSON.stringify({ error: "Error deleting accessory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
