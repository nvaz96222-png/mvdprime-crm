import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1A2B4A",
          width: "192px",
          height: "192px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "38px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 80, fontWeight: 900, color: "#ffffff", fontFamily: "sans-serif", lineHeight: 1 }}>
            M
          </span>
          <span style={{ fontSize: 54, fontWeight: 900, color: "#0D7377", fontFamily: "sans-serif", lineHeight: 1 }}>
            P
          </span>
        </div>
        <span style={{ fontSize: 17, color: "#94a3b8", fontFamily: "sans-serif", letterSpacing: "4px", marginTop: "4px" }}>
          RE
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
