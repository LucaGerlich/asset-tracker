import type { ExportColumn } from "./export";

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * Sanitize a string for CSV to prevent formula injection in Excel/Sheets.
 */
function sanitizeCsvCell(value: string): string {
  const sanitized = value.replace(/\t/g, " ").replace(/\r/g, "");
  if (FORMULA_PREFIXES.some((p) => sanitized.startsWith(p))) {
    return "'" + sanitized;
  }
  return sanitized;
}

/**
 * Escape a value for CSV output.
 * Wraps in double quotes, escaping internal quotes by doubling them.
 * Sanitizes formula characters to prevent injection.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (value instanceof Date) return `"${value.toISOString().split("T")[0]}"`;
  if (typeof value === "object") {
    const json = sanitizeCsvCell(JSON.stringify(value)).replace(/"/g, '""');
    return `"${json}"`;
  }
  const str = sanitizeCsvCell(String(value)).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Convert a single row to a CSV line.
 */
function rowToCsvLine(
  row: Record<string, unknown>,
  columns: ExportColumn[],
): string {
  return columns.map((col) => escapeCsvValue(row[col.key])).join(",");
}

/**
 * Configuration for streaming export.
 */
export interface StreamingExportConfig {
  /** Column definitions for the CSV header and field extraction */
  columns: ExportColumn[];
  /**
   * Async function that fetches a batch of rows.
   * Receives `skip` and `take` parameters for offset-based pagination.
   * Should return the raw data rows from Prisma.
   */
  fetchBatch: (params: {
    skip: number;
    take: number;
  }) => Promise<Record<string, unknown>[]>;
  /** Number of rows to fetch per batch. Defaults to 1000. */
  batchSize?: number;
  /**
   * Optional transform applied to each row before CSV conversion.
   * Use this to strip sensitive fields (e.g., passwords).
   */
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Create a ReadableStream that produces CSV content in batches.
 *
 * Streams rows from the database in configurable batch sizes to avoid
 * loading entire datasets into memory at once. Suitable for large exports
 * with tens of thousands of rows.
 */
export function createStreamingCsvExport(
  config: StreamingExportConfig,
): ReadableStream<Uint8Array> {
  const { columns, fetchBatch, batchSize = 1000, transformRow } = config;

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const headerLine =
          columns.map((c) => escapeCsvValue(c.header)).join(",") + "\n";
        controller.enqueue(encoder.encode(headerLine));

        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const batch = await fetchBatch({ skip: offset, take: batchSize });

          if (batch.length === 0) {
            hasMore = false;
            break;
          }

          const lines = batch
            .map((row) => {
              const processed = transformRow ? transformRow(row) : row;
              return rowToCsvLine(processed, columns);
            })
            .join("\n");

          controller.enqueue(encoder.encode(lines + "\n"));

          offset += batch.length;

          // If we got fewer rows than requested, we've reached the end
          if (batch.length < batchSize) {
            hasMore = false;
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Build a streaming CSV Response suitable for Next.js route handlers.
 *
 * @param config  Streaming export configuration
 * @param filename  Base filename without extension (e.g., "assets-export-2026-03-06")
 */
export function buildStreamingCsvResponse(
  config: StreamingExportConfig,
  filename: string,
): Response {
  const stream = createStreamingCsvExport(config);

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
