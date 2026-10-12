import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

const COLS = 4;
const ROWS = 8;
const PAGE_WIDTH = 612; // Letter width in points (8.5")
const PAGE_HEIGHT = 792; // Letter height in points (11")
const MARGIN = 36; // 0.5" margin
const GAP = 8;

export async function POST(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const { assetIds } = body as { assetIds: string[] };

    if (!assetIds?.length) {
      return NextResponse.json({ error: "assetIds required" }, { status: 400 });
    }

    const assets = await prisma.asset.findMany({
      where: scopeToOrganization({ assetid: { in: assetIds } }, orgId),
      select: {
        assetid: true,
        assetname: true,
        assettag: true,
      },
    });

    const baseUrl = getBaseUrl();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const cellW = (PAGE_WIDTH - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
    const cellH = (PAGE_HEIGHT - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS;
    const qrSize = Math.min(cellW - 8, cellH - 24);
    const perPage = COLS * ROWS;

    for (
      let pageIdx = 0;
      pageIdx < Math.ceil(assets.length / perPage);
      pageIdx++
    ) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const pageAssets = assets.slice(
        pageIdx * perPage,
        (pageIdx + 1) * perPage,
      );

      for (let i = 0; i < pageAssets.length; i++) {
        const asset = pageAssets[i];
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        const cellX = MARGIN + col * (cellW + GAP);
        const cellY = PAGE_HEIGHT - MARGIN - (row + 1) * (cellH + GAP) + GAP;

        // Generate QR code
        const qrUrl = `${baseUrl}/assets/${asset.assetid}`;
        const qrPng = await QRCode.toBuffer(qrUrl, {
          type: "png",
          margin: 1,
          width: 200,
          errorCorrectionLevel: "M",
        });
        const qrImage = await pdfDoc.embedPng(new Uint8Array(qrPng));

        // Center QR in cell
        const qrX = cellX + (cellW - qrSize) / 2;
        const qrY = cellY + 16;
        page.drawImage(qrImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        });

        // Asset name + tag below QR
        const label = asset.assettag
          ? `${asset.assetname} (${asset.assettag})`
          : asset.assetname;
        const fontSize = 5.5;
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const textX = cellX + (cellW - Math.min(textWidth, cellW)) / 2;

        page.drawText(
          label.length > 30 ? label.substring(0, 30) + "…" : label,
          {
            x: textX,
            y: cellY + 4,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: cellW,
          },
        );
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-codes-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/asset/qrcode/bulk error", { error });
    return NextResponse.json(
      { error: "Failed to generate QR sheet" },
      { status: 500 },
    );
  }
}
