import ExcelJS from "exceljs";

/**
 * Column definition for export.
 * `key` is the field name on the data object.
 * `header` is the human-readable column header.
 */
export interface ExportColumn {
  key: string;
  header: string;
}

/**
 * Supported export formats.
 */
export type ExportFormat = "csv" | "xlsx";

function formatCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

function buildRows(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
): (string | number | boolean | null)[][] {
  return data.map((row) => columns.map((col) => formatCellValue(row[col.key])));
}

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * Sanitize a string value for CSV output to prevent formula injection.
 * Prepends a single quote to values starting with formula characters
 * so Excel/Sheets treat them as text, not executable formulas.
 */
function sanitizeCsvCell(value: string): string {
  const sanitized = value.replace(/\t/g, " ").replace(/\r/g, "");
  if (FORMULA_PREFIXES.some((p) => sanitized.startsWith(p))) {
    return "'" + sanitized;
  }
  return sanitized;
}

export function generateCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
): string {
  const headers = columns.map((c) => c.header);
  const rows = buildRows(data, columns);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = sanitizeCsvCell(String(cell ?? ""));
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}

export async function generateXLSX(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  sheetName = "Export",
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length, 15),
  }));

  const rows = buildRows(data, columns);
  for (const row of rows) {
    worksheet.addRow(row);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Creates a Response for file download in either CSV or XLSX format.
 *
 * @param data      Array of objects to export
 * @param columns   Column definitions (key + header)
 * @param format    "csv" or "xlsx"
 * @param filename  Base filename without extension (e.g. "assets-export")
 * @param sheetName Optional sheet name for XLSX (defaults to "Export")
 */
export async function buildExportResponse(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  format: ExportFormat,
  filename: string,
  sheetName?: string,
): Promise<Response> {
  if (format === "xlsx") {
    const buffer = await generateXLSX(data, columns, sheetName);
    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = generateCSV(data, columns);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
