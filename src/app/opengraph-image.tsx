import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Asset Tracker — IT Asset Management Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const fontSemiBold = await readFile(
    join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
    ),
  );
  const fontRegular = await readFile(
    join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    ),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0f172a",
        padding: "60px 80px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: "#1e293b",
          border: "2px solid #334155",
          marginBottom: 32,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontFamily: "Geist SemiBold",
            color: "#f8fafc",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          Asset Tracker
        </div>
        <div
          style={{
            fontSize: 24,
            fontFamily: "Geist Regular",
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: 700,
          }}
        >
          IT Asset Management Software for Modern Teams
        </div>
      </div>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 40,
        }}
      >
        {["Hardware Tracking", "License Management", "Maintenance"].map(
          (label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "8px 20px",
                borderRadius: 9999,
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                fontSize: 16,
                fontFamily: "Geist Regular",
                color: "#cbd5e1",
              }}
            >
              {label}
            </div>
          ),
        )}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist SemiBold",
          data: fontSemiBold,
          style: "normal",
          weight: 600,
        },
        {
          name: "Geist Regular",
          data: fontRegular,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
