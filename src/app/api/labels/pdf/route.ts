import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { renderLabelTemplate } from "@/lib/label-renderer";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const { assetIds, templateId } = body as {
      assetIds: string[];
      templateId: string;
    };

    if (!assetIds?.length) {
      return NextResponse.json({ error: "assetIds required" }, { status: 400 });
    }

    const template = templateId
      ? await prisma.label_templates.findUnique({ where: { id: templateId } })
      : await prisma.label_templates.findFirst({
          where: { isDefault: true },
        });

    if (!template) {
      return NextResponse.json(
        { error: "No label template found" },
        { status: 404 },
      );
    }

    const assets = await prisma.asset.findMany({
      where: scopeToOrganization({ assetid: { in: assetIds } }, orgId),
      include: {
        manufacturer: true,
        model: true,
        location: true,
        assetCategoryType: true,
        statusType: true,
      },
    });

    const baseUrl = getBaseUrl();
    const widthPt = Number(template.width) * 72;
    const heightPt = Number(template.height) * 72;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const asset of assets) {
      const page = pdfDoc.addPage([widthPt, heightPt]);
      const padding = 10;
      const qrUrl = `${baseUrl}/assets/${asset.assetid}`;

      const data: Record<string, string> = {
        assetName: asset.assetname || "",
        assetTag: asset.assettag || "",
        serialNumber: asset.serialnumber || "",
        manufacturer: asset.manufacturer?.manufacturername || "",
        model: asset.model?.modelname || "",
        location: asset.location?.locationname || "",
        category: asset.assetCategoryType?.assetcategorytypename || "",
        purchaseDate: asset.purchasedate
          ? new Date(
              typeof asset.purchasedate === "string"
                ? asset.purchasedate
                : asset.purchasedate,
            ).toLocaleDateString()
          : "",
        purchasePrice: asset.purchaseprice
          ? `$${Number(asset.purchaseprice).toFixed(2)}`
          : "",
        status: asset.statusType?.statustypename || "",
        qrCodeUrl: qrUrl,
      };

      // Generate QR code as PNG
      const qrPng = await QRCode.toBuffer(qrUrl, {
        type: "png",
        margin: 1,
        width: 150,
        errorCorrectionLevel: "M",
      });
      const qrImage = await pdfDoc.embedPng(new Uint8Array(qrPng));

      // QR code on the right side
      const qrSize = Math.min(heightPt - padding * 2, 80);
      const qrX = widthPt - qrSize - padding;
      const qrY = heightPt - qrSize - padding;
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });

      const textWidth = qrX - padding * 2;
      const isTemplateLayout =
        template.layout && template.layout.includes("{{");

      if (isTemplateLayout) {
        const rendered = renderLabelTemplate(template.layout, data);
        const lines = rendered.split("\n").filter((l) => l.trim());
        const fontSize = Math.min(
          8,
          (heightPt - padding * 2) / lines.length / 1.5,
        );
        let y = heightPt - padding - fontSize;

        for (const line of lines) {
          if (y < padding) break;
          page.drawText(line.trim(), {
            x: padding,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: textWidth,
          });
          y -= fontSize * 1.4;
        }
      } else {
        // Legacy fields mode
        let fields: string[];
        try {
          fields = JSON.parse(template.fields);
        } catch {
          fields = ["assetName", "assetTag", "serialNumber"];
        }
        const fontSize = Math.min(
          8,
          (heightPt - padding * 2) / fields.length / 1.5,
        );
        let y = heightPt - padding - fontSize;

        for (const field of fields) {
          const value = data[field];
          if (!value || y < padding) continue;
          const label = field.replace(/([A-Z])/g, " $1").trim() + ": ";
          page.drawText(label, {
            x: padding,
            y,
            size: fontSize,
            font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
          });
          const labelWidth = fontBold.widthOfTextAtSize(label, fontSize);
          page.drawText(value, {
            x: padding + labelWidth,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: textWidth - labelWidth,
          });
          y -= fontSize * 1.4;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/labels/pdf error", { error });
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
