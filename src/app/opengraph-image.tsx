import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Asset Tracker — IT Asset Management Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS_DIR = join(process.cwd(), "node_modules/geist/dist/fonts");
const BG = "#0b0b0c";
const LINE = "#1f1f22";
const TEXT = "#ededed";
const MUTED = "#8a8a93";
const ACCENT = "#c6f36b";

export default async function OGImage() {
  const [sansSemiBold, mono] = await Promise.all([
    readFile(join(FONTS_DIR, "geist-sans/Geist-SemiBold.ttf")),
    readFile(join(FONTS_DIR, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: BG,
        backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Geist Mono",
          fontSize: 22,
          color: MUTED,
          letterSpacing: 3,
        }}
      >
        [ SOURCE-AVAILABLE · SELF-HOST FREE ]
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Geist SemiBold",
          fontSize: 84,
          color: TEXT,
          letterSpacing: -2,
          lineHeight: 1.05,
        }}
      >
        <div style={{ display: "flex" }}>Every asset,</div>
        <div style={{ display: "flex", alignItems: "center" }}>
          accounted for.
          <div
            style={{
              display: "flex",
              width: 36,
              height: 68,
              marginLeft: 12,
              backgroundColor: ACCENT,
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "Geist Mono",
          fontSize: 22,
          color: MUTED,
          borderTop: `1px solid ${LINE}`,
          paddingTop: 24,
        }}
      >
        <span>Asset Tracker</span>
        <span>IT asset management</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist SemiBold", data: sansSemiBold, weight: 600 },
        { name: "Geist Mono", data: mono, weight: 400 },
      ],
    },
  );
}
