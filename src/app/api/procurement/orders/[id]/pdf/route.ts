import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requirePlanFeature } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/procurement/orders/[id]/pdf - Generate PO PDF
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requirePermission("procurement:view");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        supplier: {
          select: {
            supplierid: true,
            suppliername: true,
            email: true,
            phonenumber: true,
            website: true,
          },
        },
        purchaseRequest: {
          include: {
            items: {
              include: {
                supplier: {
                  select: { supplierid: true, suppliername: true },
                },
              },
            },
          },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89; // A4
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // --- Header ---
    page.drawText("Purchase Order", {
      x: margin,
      y,
      size: 22,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 28;

    page.drawText(purchaseOrder.poNumber, {
      x: margin,
      y,
      size: 14,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 24;

    // Organization name
    if (purchaseOrder.organization?.name) {
      page.drawText(purchaseOrder.organization.name, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 16;
    }

    // Date
    page.drawText(
      `Date: ${purchaseOrder.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      },
    );
    y -= 14;

    // Status
    page.drawText(`Status: ${purchaseOrder.status}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 24;

    // --- Separator ---
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 20;

    // --- Supplier details ---
    if (purchaseOrder.supplier) {
      page.drawText("Supplier", {
        x: margin,
        y,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 16;

      page.drawText(purchaseOrder.supplier.suppliername, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 14;

      if (purchaseOrder.supplier.email) {
        page.drawText(`Email: ${purchaseOrder.supplier.email}`, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= 13;
      }

      if (purchaseOrder.supplier.phonenumber) {
        page.drawText(`Phone: ${purchaseOrder.supplier.phonenumber}`, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= 13;
      }

      y -= 10;
    }

    // --- Expected delivery date ---
    if (purchaseOrder.expectedDeliveryDate) {
      page.drawText(
        `Expected Delivery: ${new Date(
          purchaseOrder.expectedDeliveryDate,
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        },
      );
      y -= 20;
    }

    // --- Line items table ---
    const items = purchaseOrder.purchaseRequest?.items ?? [];

    // Filter to items matching this PO's supplier (or all items if no supplier filter needed)
    const poItems = purchaseOrder.supplierId
      ? items.filter((item) => item.supplierId === purchaseOrder.supplierId)
      : items;

    if (poItems.length > 0) {
      // Table header
      const colDesc = margin;
      const colQty = margin + contentWidth * 0.55;
      const colUnit = margin + contentWidth * 0.68;
      const colTotal = margin + contentWidth * 0.84;

      page.drawText("Description", {
        x: colDesc,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("Qty", {
        x: colQty,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("Unit Price", {
        x: colUnit,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("Total", {
        x: colTotal,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 6;

      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= 14;

      // Table rows
      for (const item of poItems) {
        if (y < margin + 60) break; // Leave room for totals

        const unitCost = item.estimatedUnitCost
          ? Number(item.estimatedUnitCost)
          : 0;
        const lineTotal = item.quantity * unitCost;

        // Truncate description if too long
        const maxDescLen = 50;
        const desc =
          item.description.length > maxDescLen
            ? item.description.substring(0, maxDescLen) + "..."
            : item.description;

        page.drawText(desc, {
          x: colDesc,
          y,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(String(item.quantity), {
          x: colQty,
          y,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(unitCost > 0 ? unitCost.toFixed(2) : "-", {
          x: colUnit,
          y,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(lineTotal > 0 ? lineTotal.toFixed(2) : "-", {
          x: colTotal,
          y,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 16;
      }

      // Grand total
      y -= 4;
      page.drawLine({
        start: { x: colTotal - 10, y: y + 10 },
        end: { x: margin + contentWidth, y: y + 10 },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });

      const grandTotal = purchaseOrder.totalAmount
        ? Number(purchaseOrder.totalAmount)
        : 0;

      page.drawText("Grand Total:", {
        x: colUnit,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(grandTotal > 0 ? grandTotal.toFixed(2) : "-", {
        x: colTotal,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 24;
    }

    // --- Notes ---
    if (purchaseOrder.notes) {
      page.drawText("Notes", {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 14;

      // Word-wrap notes text
      const words = purchaseOrder.notes.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, 9);
        if (testWidth > contentWidth) {
          if (y < margin) break;
          page.drawText(line, {
            x: margin,
            y,
            size: 9,
            font,
            color: rgb(0.3, 0.3, 0.3),
          });
          y -= 13;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && y >= margin) {
        page.drawText(line, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="PO-${purchaseOrder.poNumber}.pdf"`,
      },
    });
  } catch (error) {
    logger.error("GET /api/procurement/orders/[id]/pdf error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
