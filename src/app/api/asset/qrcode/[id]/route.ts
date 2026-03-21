import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth();

    const { id: assetId } = await params;
    const format = req.nextUrl.searchParams.get("format") || "png";

    const baseUrl = getBaseUrl();
    const qrData = `${baseUrl}/assets/${assetId}`;

    if (format === "svg") {
      const svgString = await QRCode.toString(qrData, {
        type: "svg",
        margin: 2,
        width: 300,
      });

      return new NextResponse(svgString, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Default: PNG
    const pngBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      margin: 2,
      width: 300,
      errorCorrectionLevel: "M",
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/asset/qrcode/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
