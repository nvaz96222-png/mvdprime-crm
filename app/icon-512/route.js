import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1A2B4A",
          width: "512px",
          height: "512px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "96px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 210, fontWeight: 900, color: "#ffffff", fontFamily: "sans-serif", lineHeight: 1 }}>
            M
          </span>
          <span style={{ fontSize: 140, fontWeight: 900, color: "#0D7377", fontFamily: "sans-serif", lineHeight: 1 }}>
            P
          </span>
        </div>
        <span style={{ fontSize: 44, color: "#94a3b8", fontFamily: "sans-serif", letterSpacing: "12px", marginTop: "8px" }}>
          RE
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
